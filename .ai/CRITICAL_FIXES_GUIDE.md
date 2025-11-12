# Critical Fixes Guide - OX Multi-File System

**Priority**: URGENT  
**Impact**: 4 failing tests blocking production  
**Estimated Time**: 8-14 hours total

---

## Issue 1: Inject Parser Storage Inconsistency 🔴

### Problem
Parser stores `<inject>` directives in `doc.blocks` array, but `InjectProcessor.extractInjects()` expects them in `doc.injects` array.

### Impact
- 2 tests failing in `inject-processor.test.js`
- 2-4 tests failing in `project.test.js`
- All inject functionality broken

### Root Cause Analysis

**File**: `C:\Dev\Desinda\Tools\oxdefinition\src\parser\parser.js`  
**Line 127**:
```javascript
} else if (template.type === "Inject") {
  // Keep injects inline with blocks to preserve order
  doc.blocks.push(template);  // ❌ Wrong - stores in blocks
}
```

**File**: `C:\Dev\Desinda\Tools\oxdefinition\src\project\inject-processor.js`  
**Line 70-75**:
```javascript
extractInjects(ast) {
  const injects = [];
  
  // Extract top-level injects
  if (ast.injects && Array.isArray(ast.injects)) {  // ✅ Expects injects array
    for (const injectNode of ast.injects) {
```

### Solution: Choose One Approach

#### Option A: Fix Parser (RECOMMENDED)
**Why**: Matches design intent - separate imports and injects arrays  
**Effort**: 1 hour  
**Risk**: Low

**File to modify**: `C:\Dev\Desinda\Tools\oxdefinition\src\parser\parser.js`

**Line 125-129** (change from):
```javascript
} else if (template.type === "Inject") {
  // Keep injects inline with blocks to preserve order
  doc.blocks.push(template);
}
```

**To**:
```javascript
} else if (template.type === "Inject") {
  // Top-level injects go in injects array (processed before blocks)
  doc.injects.push(template);
}
```

**Additional changes needed**:

**Line 254-267** (in `parseBlock()` method):
```javascript
// Current code already correctly stores block-level injects:
} else if (this.check(TokenType.LT)) {
  // Template inside block
  const template = this.parseTemplate();
  if (template.type === "Inject") {
    injects.push(template);  // ✅ Already correct
  } else {
    children.push(template);
  }
}
```
This part is already correct - no change needed.

#### Option B: Fix InjectProcessor
**Why**: Preserve backward compatibility  
**Effort**: 2 hours  
**Risk**: Medium (more complex logic)

**File to modify**: `C:\Dev\Desinda\Tools\oxdefinition\src\project\inject-processor.js`

**Line 70-80** (change from):
```javascript
extractInjects(ast) {
  const injects = [];
  
  // Extract top-level injects
  if (ast.injects && Array.isArray(ast.injects)) {
    for (const injectNode of ast.injects) {
      injects.push({
        type: "top-level",
        path: injectNode.path,
        node: injectNode,
      });
    }
  }
```

**To**:
```javascript
extractInjects(ast) {
  const injects = [];
  
  // Extract top-level injects from injects array
  if (ast.injects && Array.isArray(ast.injects)) {
    for (const injectNode of ast.injects) {
      injects.push({
        type: "top-level",
        path: injectNode.path,
        node: injectNode,
      });
    }
  }
  
  // ALSO check blocks array for Inject nodes (backward compatibility)
  if (ast.blocks && Array.isArray(ast.blocks)) {
    for (const block of ast.blocks) {
      if (block.type === "Inject") {
        injects.push({
          type: "top-level",
          path: block.path,
          node: block,
        });
      }
    }
  }
```

**Recommendation**: Use Option A (fix parser) - cleaner and matches design intent.

### Testing the Fix

```bash
# Run specific test file
npm test test/inject-processor.test.js

# Should now see:
# ✔ extracts inject directives from AST
# ✔ processes top-level inject
# ✔ detects circular inject dependencies
```

### Verification Steps

1. Fix parser.js line 127
2. Run `npm test test/inject-processor.test.js`
3. Verify 14/14 passing (currently 12/14)
4. Run full test suite: `npm test`
5. Verify 72/72 passing (currently 68/72)

---

## Issue 2: No Cache Eviction Strategy 🔴

### Problem
FileLoader has a hard 100MB cache limit. When exceeded, it throws an error instead of evicting old entries.

### Impact
- Memory leak in long-running processes
- Server applications will crash after processing ~100MB of OX files
- No graceful degradation

### Current Behavior

**File**: `C:\Dev\Desinda\Tools\oxdefinition\src\project\loader.js`  
**Lines 68-76**:
```javascript
// Security: Check aggregate cache size limit
if (this.currentCacheSize + stats.size > this.maxCacheSize) {
  throw new Error(
    `Cache size limit exceeded. Current: ${(this.currentCacheSize / 1024 / 1024).toFixed(2)}MB, ` +
    `File: ${(stats.size / 1024 / 1024).toFixed(2)}MB, ` +
    `Limit: ${(this.maxCacheSize / 1024 / 1024).toFixed(1)}MB. ` +
    `Consider increasing maxCacheSize or clearing cache.`
  );
}
```

### Solution: Implement LRU Eviction

**File to modify**: `C:\Dev\Desinda\Tools\oxdefinition\src\project\loader.js`

**Step 1: Add eviction method** (add after line 170):

```javascript
/**
 * Evict least-recently-used file from cache
 * 
 * @returns {boolean} True if file was evicted, false if cache empty
 */
evictLRU() {
  if (this.loadOrder.length === 0) {
    return false;
  }

  // Get oldest file (first in load order)
  const oldestFile = this.loadOrder.shift();
  const entry = this.cache.get(oldestFile);

  if (entry) {
    // Update cache size
    this.currentCacheSize -= entry.size;
    
    // Remove from cache
    this.cache.delete(oldestFile);
    
    return true;
  }

  return false;
}

/**
 * Evict files until there's enough space
 * 
 * @param {number} requiredSpace - Space needed in bytes
 * @returns {number} Number of files evicted
 */
evictUntilSpace(requiredSpace) {
  let evicted = 0;
  
  while (this.currentCacheSize + requiredSpace > this.maxCacheSize) {
    if (!this.evictLRU()) {
      break; // Cache is empty
    }
    evicted++;
  }
  
  return evicted;
}
```

**Step 2: Update loadFile method** (lines 68-76, replace throw with eviction):

**Change from**:
```javascript
// Security: Check aggregate cache size limit
if (this.currentCacheSize + stats.size > this.maxCacheSize) {
  throw new Error(
    `Cache size limit exceeded. Current: ${(this.currentCacheSize / 1024 / 1024).toFixed(2)}MB, ` +
    `File: ${(stats.size / 1024 / 1024).toFixed(2)}MB, ` +
    `Limit: ${(this.maxCacheSize / 1024 / 1024).toFixed(1)}MB. ` +
    `Consider increasing maxCacheSize or clearing cache.`
  );
}
```

**To**:
```javascript
// Security: Check aggregate cache size limit
if (this.currentCacheSize + stats.size > this.maxCacheSize) {
  // Try to evict old entries to make space
  const evicted = this.evictUntilSpace(stats.size);
  
  // If still not enough space (file too large for cache), throw
  if (this.currentCacheSize + stats.size > this.maxCacheSize) {
    throw new Error(
      `File too large for cache: ${(stats.size / 1024 / 1024).toFixed(2)}MB. ` +
      `Cache limit: ${(this.maxCacheSize / 1024 / 1024).toFixed(1)}MB. ` +
      `Evicted ${evicted} files but still not enough space. ` +
      `Consider increasing maxCacheSize.`
    );
  }
}
```

**Step 3: Add configuration option** (constructor, line 28):

**Change from**:
```javascript
constructor(config, options = {}) {
  this.config = config;
  this.maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
  this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE;
```

**To**:
```javascript
constructor(config, options = {}) {
  this.config = config;
  this.maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
  this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE;
  this.enableCacheEviction = options.enableCacheEviction !== false; // Default: true
```

**Step 4: Use flag in loadFile** (update the eviction code):

```javascript
if (this.currentCacheSize + stats.size > this.maxCacheSize) {
  if (this.enableCacheEviction) {
    // Try to evict old entries to make space
    const evicted = this.evictUntilSpace(stats.size);
    
    // If still not enough space, throw
    if (this.currentCacheSize + stats.size > this.maxCacheSize) {
      throw new Error(
        `File too large for cache: ${(stats.size / 1024 / 1024).toFixed(2)}MB. ` +
        `Evicted ${evicted} files but still not enough space.`
      );
    }
  } else {
    // Old behavior: throw immediately
    throw new Error(`Cache size limit exceeded...`);
  }
}
```

### Testing the Fix

**Create test file**: `test/cache-eviction.test.js`

```javascript
import { test, describe } from "node:test";
import assert from "node:assert";
import path from "path";
import { fileURLToPath } from "url";
import { FileLoader } from "../src/project/loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Cache Eviction", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = {
    baseDir: fixturesDir,
    moduleDirectories: ["node_modules"],
  };

  test("evicts old entries when cache full", () => {
    const loader = new FileLoader(config, {
      maxFileSize: 10 * 1024 * 1024,
      maxCacheSize: 200, // Very small cache
      enableCacheEviction: true,
    });

    const file1 = path.join(fixturesDir, "simple.ox");
    const file2 = path.join(fixturesDir, "tags-library.ox");
    const file3 = path.join(fixturesDir, "imports-main.ox");

    // Load files (should evict file1 when loading file3)
    loader.loadFile(file1);
    const loaded1 = loader.getLoadedFiles();
    assert.strictEqual(loaded1.length, 1);

    loader.loadFile(file2);
    const loaded2 = loader.getLoadedFiles();
    assert.strictEqual(loaded2.length, 2);

    loader.loadFile(file3);
    const loaded3 = loader.getLoadedFiles();
    
    // Should have evicted file1
    assert.ok(loaded3.length <= 2);
    assert.ok(!loader.hasLoaded(file1));
    assert.ok(loader.hasLoaded(file2));
    assert.ok(loader.hasLoaded(file3));
  });

  test("throws if file too large for cache", () => {
    const loader = new FileLoader(config, {
      maxFileSize: 10 * 1024 * 1024,
      maxCacheSize: 10, // Tiny cache (smaller than any file)
      enableCacheEviction: true,
    });

    const file = path.join(fixturesDir, "simple.ox");

    assert.throws(
      () => loader.loadFile(file),
      /File too large for cache/,
      "Should throw when file is larger than cache limit"
    );
  });

  test("respects enableCacheEviction: false", () => {
    const loader = new FileLoader(config, {
      maxCacheSize: 200,
      enableCacheEviction: false, // Disable eviction
    });

    const file1 = path.join(fixturesDir, "simple.ox");
    const file2 = path.join(fixturesDir, "tags-library.ox");

    loader.loadFile(file1);

    // Should throw instead of evicting
    assert.throws(
      () => loader.loadFile(file2),
      /Cache size limit exceeded/
    );
  });
});
```

Run test:
```bash
npm test test/cache-eviction.test.js
```

---

## Issue 3: Missing Input Validation 🔴

### Problem
Public API methods don't validate inputs, leading to confusing runtime errors.

### Impact
- Poor developer experience
- Difficult debugging
- Potential security issues

### Solution: Add Validation Guards

**File**: `C:\Dev\Desinda\Tools\oxdefinition\src\project\project.js`

**Add validation helper** (after imports, line 11):

```javascript
/**
 * Validate inputs with helpful error messages
 */
class InputValidator {
  static validateDirectory(dir, paramName = "directory") {
    if (!dir || typeof dir !== "string") {
      throw new TypeError(
        `${paramName} must be a non-empty string, got ${typeof dir}`
      );
    }

    if (!fs.existsSync(dir)) {
      throw new Error(`${paramName} does not exist: ${dir}`);
    }

    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
      throw new Error(`${paramName} is not a directory: ${dir}`);
    }
  }

  static validateFilePath(filePath, paramName = "filePath") {
    if (!filePath || typeof filePath !== "string") {
      throw new TypeError(
        `${paramName} must be a non-empty string, got ${typeof filePath}`
      );
    }

    if (filePath.length > 4096) {
      throw new Error(
        `${paramName} is too long (${filePath.length} chars, max 4096)`
      );
    }

    if (!filePath.endsWith(".ox")) {
      throw new Error(
        `${paramName} must have .ox extension: ${filePath}`
      );
    }
  }

  static validateOptions(options, paramName = "options") {
    if (options !== null && typeof options !== "object") {
      throw new TypeError(
        `${paramName} must be an object or null, got ${typeof options}`
      );
    }
  }

  static validateMacroContext(context, paramName = "macroContext") {
    if (context !== null && typeof context !== "object") {
      throw new TypeError(
        `${paramName} must be an object or null, got ${typeof context}`
      );
    }
  }
}
```

**Update factory methods** (lines 23-35):

**fromDirectory - change from**:
```javascript
static fromDirectory(projectDir, options = {}) {
  const config = loadConfig(projectDir);
```

**To**:
```javascript
static fromDirectory(projectDir, options = {}) {
  InputValidator.validateDirectory(projectDir, "projectDir");
  InputValidator.validateOptions(options, "options");
  
  const config = loadConfig(projectDir);
```

**fromFile - change from**:
```javascript
static fromFile(filePath, options = {}) {
  const baseDir = path.dirname(filePath);
```

**To**:
```javascript
static fromFile(filePath, options = {}) {
  InputValidator.validateFilePath(filePath, "filePath");
  InputValidator.validateOptions(options, "options");
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  const baseDir = path.dirname(filePath);
```

**Update parse methods** (lines 61-75):

**parse - add validation**:
```javascript
parse(macroContext = null) {
  InputValidator.validateMacroContext(macroContext, "macroContext");
  
  // ... rest of method
}
```

**parseFile - add validation**:
```javascript
parseFile(filePath, macroContext = null) {
  InputValidator.validateFilePath(filePath, "filePath");
  InputValidator.validateMacroContext(macroContext, "macroContext");
  
  // ... rest of method
}
```

### Testing the Fix

**Add to existing test file**: `test/project.test.js`

```javascript
describe("OXProject Input Validation", () => {
  test("fromDirectory throws on invalid directory", () => {
    assert.throws(
      () => OXProject.fromDirectory(null),
      /must be a non-empty string/
    );

    assert.throws(
      () => OXProject.fromDirectory(123),
      /must be a non-empty string/
    );

    assert.throws(
      () => OXProject.fromDirectory("/nonexistent/path"),
      /does not exist/
    );
  });

  test("fromFile throws on invalid file path", () => {
    assert.throws(
      () => OXProject.fromFile(null),
      /must be a non-empty string/
    );

    assert.throws(
      () => OXProject.fromFile("file.txt"),
      /must have \.ox extension/
    );

    assert.throws(
      () => OXProject.fromFile("/nonexistent/file.ox"),
      /does not exist/
    );
  });

  test("parse throws on invalid macro context", () => {
    const project = OXProject.fromDirectory(fixturesDir);

    assert.throws(
      () => project.parse("invalid"),
      /must be an object or null/
    );

    assert.throws(
      () => project.parse(123),
      /must be an object or null/
    );
  });

  test("accepts valid inputs", () => {
    // Should not throw
    const project = OXProject.fromDirectory(fixturesDir);
    assert.doesNotThrow(() => project.parse(null));
    assert.doesNotThrow(() => project.parse({}));
    assert.doesNotThrow(() => project.parse({ onParse: () => {} }));
  });
});
```

---

## Testing Checklist

After implementing all fixes:

```bash
# 1. Run individual test suites
npm test test/inject-processor.test.js  # Should be 14/14
npm test test/cache-eviction.test.js     # Should be 3/3
npm test test/project.test.js            # Should be 24/24 (added validation tests)

# 2. Run full test suite
npm test

# 3. Expected results
# ✔ Transaction (12/12)
# ✔ DataSourceProcessor (11/11)
# ✔ ExpressionEvaluator (30/30)
# ✔ ImportProcessor (16/16)
# ✔ InjectProcessor (14/14) ← Fixed
# ✔ OXProject (24/24) ← Fixed with validation tests
# ✔ Security (24/24)
# ✔ Cache Eviction (3/3) ← New
#
# Total: 134/134 tests passing ✅

# 4. Manual integration test
node -e "
const { OXProject } = require('./src/project/project.js');
const project = OXProject.fromDirectory('./test/fixtures/multi-file');
const blocks = project.parse();
console.log('Parsed blocks:', blocks.length);
console.log('✅ Manual test passed');
"
```

---

## Completion Criteria

### Issue 1: Inject Parser ✅
- [ ] Parser.js line 127 fixed
- [ ] All 14 inject tests passing
- [ ] Manual test of inject functionality works

### Issue 2: Cache Eviction ✅
- [ ] evictLRU() method added
- [ ] evictUntilSpace() method added
- [ ] loadFile() uses eviction instead of throwing
- [ ] Configuration option added
- [ ] 3 new cache tests passing

### Issue 3: Input Validation ✅
- [ ] InputValidator class added
- [ ] All factory methods validated
- [ ] All parse methods validated
- [ ] 4 new validation tests passing

### Final Verification ✅
- [ ] Full test suite passing (134/134 expected)
- [ ] No regressions in existing functionality
- [ ] Documentation updated
- [ ] Ready for production deployment

---

## Time Estimates

| Issue | Estimated Time | Priority |
|-------|---------------|----------|
| Issue 1: Parser Fix | 1-2 hours | P0 (Critical) |
| Issue 2: Cache Eviction | 4-6 hours | P0 (Critical) |
| Issue 3: Input Validation | 2-3 hours | P0 (Critical) |
| Testing & Verification | 1-2 hours | P0 (Critical) |
| **Total** | **8-13 hours** | **Critical Path** |

---

## Getting Help

### If You Get Stuck

1. **Check test output**: `npm test -- --reporter spec` for detailed errors
2. **Read design docs**: `.ai/Multi_File_System.md` for architecture
3. **Review full analysis**: `.ai/Comprehensive_Architecture_Review.md`
4. **Check git history**: `git log --oneline` to see recent changes

### Common Issues

**Problem**: Tests still failing after parser fix  
**Solution**: Clear node cache: `rm -rf node_modules/.cache`

**Problem**: Cache eviction not working  
**Solution**: Verify `loadOrder` array is being maintained correctly

**Problem**: Validation too strict  
**Solution**: Adjust validator rules or add `skipValidation` option

---

**Created**: November 12, 2025  
**Last Updated**: November 12, 2025  
**Status**: Ready for Implementation
