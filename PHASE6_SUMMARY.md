# Phase 6 Implementation Summary - Data Sources & Async Handling

## Overview

Phase 6 implements the data source system, which enables OX to fetch external data asynchronously during preprocessing. This allows templates to access database queries, API calls, or any async data sources before rendering.

**Status:** ✅ **COMPLETE** - All 102 tests passing

---

## What Was Implemented

### 1. Transaction System (`src/transaction/transaction.js`)

**Purpose:** Manages variables, functions, and data sources for OX preprocessing.

**Features Implemented:**
- Variable management (get, set, has, delete, getAll)
- Function management for expressions
- Data source registration with wrapper support
- Async data source execution with timeout handling
- Result and error caching
- Transaction cloning for independent copies

**Key Methods:**
```javascript
// Variable management
transaction.setVariable(name, value)
transaction.getVariable(name)

// Function management
transaction.addFunction(name, func)
transaction.getFunction(name)

// Data source management
transaction.addDataSource(name, asyncFunc)
transaction.fetchDataSource(name)
transaction.fetchDataSources([names]) // Parallel fetch

// Caching
transaction.getDataSourceResult(name)
transaction.getDataSourceError(name)
transaction.clearDataSourceCache()
```

**Data Source Patterns:**

**Option A - Direct async function:**
```javascript
transaction.addDataSource('users', async () => {
  return await db.query("SELECT * FROM users");
});
```

**Option B - Wrapper with transaction access:**
```javascript
transaction.addDataSource('posts', (tx) => {
  const limit = tx.getVariable('limit') || 10;
  return async () => {
    return await db.query("SELECT * FROM posts LIMIT ?", [limit]);
  };
});
```

### 2. Data Source Processor (`src/preprocessor/datasources.js`)

**Purpose:** Detects, validates, and executes data sources in OX AST.

**Features Implemented:**
- Recursive detection of `<on-data>` blocks in templates
- Dependency graph building for nested data sources
- Validation that all referenced sources exist
- Execution plan generation (parallel vs sequential)
- Async execution with error handling

**Key Methods:**
```javascript
processor.detectDataSources(document) // Returns source info array
processor.validateDataSources()       // Throws if sources missing
processor.getExecutionPlan(sources)   // Returns execution strategy
processor.executeDataSources(document) // Fetches all data
processor.getDataSourceData(name)     // Get successful result
processor.getDataSourceError(name)    // Get error info
```

**Detection Capabilities:**
- Top-level `<on-data>` blocks
- Nested `<on-data>` blocks (sequential execution)
- Parallel `<on-data>` blocks (concurrent execution)
- Data sources inside conditionals (`<if>`)
- Data sources inside loops (`<foreach>`, `<while>`)
- Data sources inside regular blocks

### 3. Error Handling

**Structured Error Format:**
```javascript
{
  message: "Database connection failed",
  code: "ECONNREFUSED",
  source: "users",  // Data source name
  timestamp: 1234567890,
  originalError: Error // Original error object
}
```

**Timeout Handling:**
- Configurable timeout per transaction
- Automatic timeout detection
- Proper error caching for failed sources

**Parallel Fetch Error Handling:**
- Uses `Promise.allSettled` to not fail fast
- Individual errors cached per source
- Successful results still accessible

---

## Architecture

### Data Source Flow

```
1. Parse OX → Document with templates
2. Detect Data Sources → Find all <on-data> blocks
3. Validate → Check all sources exist in transaction
4. Build Execution Plan → Determine parallel vs sequential
5. Execute → Fetch data with timeout handling
6. Cache Results/Errors → Store in transaction
7. Template Expansion (Phase 8) → Use fetched data
```

### Parallel vs Sequential Execution

**Parallel (top-level data sources):**
```ox
<on-data users>
  [UserList]
</on-data>

<on-data posts>
  [PostList]
</on-data>
```

Both fetched concurrently using `Promise.all()`.

**Sequential (nested data sources):**
```ox
<on-data users>
  [UserSection]
  <on-data posts>
    [PostSection]
  </on-data>
</on-data>
```

Execution order:
1. Fetch `users`
2. Wait for completion
3. Fetch `posts`

### Dependency Graph

The processor builds a graph tracking parent-child relationships:
```
users (level 0, no parent)
  └─ posts (level 1, parent: users)
      └─ comments (level 2, parent: posts)
```

Levels determine execution order for proper nesting.

---

## Usage Examples

### Basic Data Source

```javascript
import { Transaction } from './transaction/transaction.js';
import { DataSourceProcessor } from './preprocessor/datasources.js';
import { parse } from './parser/parser.js';

// Create transaction with data source
const tx = new Transaction();
tx.addDataSource('users', async () => {
  return [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];
});

// Parse OX
const doc = parse(`
  <on-data users>
    <foreach (user in users)>
      [User (name: (user.name))]
    </foreach>
  </on-data>
`);

// Execute data sources
const processor = new DataSourceProcessor(tx);
await processor.executeDataSources(doc);

// Access results
const users = processor.getDataSourceData('users');
console.log(users); // [{ id: 1, name: 'Alice' }, ...]
```

### Timeout Configuration

```javascript
const tx = new Transaction({
  config: {
    timeout: 5000  // 5 seconds
  }
});

tx.addDataSource('slow', async () => {
  // This will timeout after 5 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));
  return { data: 'test' };
});

try {
  await tx.fetchDataSource('slow');
} catch (error) {
  console.log(error.message); // "Data source 'slow' timed out after 5000ms"
  console.log(error.code);    // "FETCH_ERROR"
  console.log(error.source);  // "slow"
}
```

### Parallel Fetching

```javascript
tx.addDataSource('users', async () => [...]);
tx.addDataSource('posts', async () => [...]);
tx.addDataSource('comments', async () => [...]);

// Fetch all in parallel
const { results, errors } = await tx.fetchDataSources(['users', 'posts', 'comments']);

console.log(results.users);    // User data
console.log(results.posts);    // Post data
console.log(errors.comments);  // Error if fetch failed
```

### Error Handling in OX

```ox
<on-data users>
  [UserList]
  
<on-error>
  [ErrorBlock (
    message: ($error.message),
    code: ($error.code)
  )]
  
  <if ($error.code == "TIMEOUT")>
    [RetryButton]
  </if>
</on-error>
</on-data>
```

---

## Test Coverage

**New Test Suites:** 2
- Transaction (23 tests)
- DataSourceProcessor (12 tests)

**Total Tests:** 102/102 passing ✅

### Transaction Tests Cover:
- Variable management
- Function management
- Data source registration (direct & wrapper)
- Successful data fetching
- Result caching
- Timeout handling
- Error capturing and caching
- Parallel fetching
- Mixed success/failure scenarios
- Transaction cloning
- Cache clearing

### DataSourceProcessor Tests Cover:
- Simple data source detection
- Nested data source detection
- Parallel data source detection
- Validation of undefined sources
- Execution plan for parallel sources
- Execution plan for nested sources
- Async execution with proper ordering
- Success/failure tracking
- Result retrieval
- Error retrieval

---

## Files Created/Modified

### New Files:
- `src/transaction/transaction.js` - Transaction class (290 lines)
- `src/preprocessor/datasources.js` - DataSourceProcessor class (225 lines)
- `test/datasources.test.js` - Comprehensive tests (505 lines)

### Key Features:

**Transaction (290 lines):**
- Variable/function management
- Data source registration
- Async execution with timeout
- Caching system
- Clone functionality

**DataSourceProcessor (225 lines):**
- AST traversal for `<on-data>` detection
- Dependency graph building
- Execution planning
- Async execution coordination
- Error/success tracking

---

## Integration with Existing Phases

Phase 6 fits into the preprocessing pipeline:

```
Phase 1-4: Tag Expansion & Module Injection
  ↓
Phase 5: Module Property Injection
  ↓
Phase 6: Data Source Detection & Execution ← YOU ARE HERE
  ↓
Phase 7: (Merged with Phase 6 - data fetching)
  ↓
Phase 8: Template Expansion (uses fetched data)
  ↓
Phase 9: Expression Resolution
  ↓
Phase 10: Tree Output
```

**Ready for Phase 8:** Template Expansion will use the cached data source results.

---

## Performance Characteristics

**Time Complexity:**
- Detection: O(n) where n = nodes in AST
- Execution: O(m * t) where m = data sources, t = avg fetch time
- Parallel fetch: O(t) for independent sources

**Space Complexity:**
- O(m) for cached results/errors
- O(d) for dependency graph where d = dependencies

**Optimizations:**
- Result caching prevents redundant fetches
- Parallel execution for independent sources
- Timeout prevents hanging operations
- Error caching for fast failure on retry

---

## API Surface

### Transaction API
```javascript
// Create
const tx = new Transaction(config)

// Variables
tx.setVariable(name, value)
tx.getVariable(name)
tx.hasVariable(name)
tx.deleteVariable(name)
tx.getAllVariables()

// Functions
tx.addFunction(name, func)
tx.getFunction(name)
tx.hasFunction(name)
tx.removeFunction(name)

// Data Sources
tx.addDataSource(name, source)
tx.setDataSource(name, source)
tx.hasDataSource(name)
tx.removeDataSource(name)
tx.getDataSourceNames()

// Execution
await tx.fetchDataSource(name)
await tx.fetchDataSources(names)

// Results
tx.getDataSourceResult(name)
tx.hasDataSourceResult(name)
tx.getDataSourceError(name)
tx.hasDataSourceError(name)
tx.clearDataSourceCache()

// Management
tx.reset()
tx.clone()
```

### DataSourceProcessor API
```javascript
// Create
const processor = new DataSourceProcessor(transaction)

// Detection
const sources = processor.detectDataSources(document)
processor.validateDataSources()

// Planning
const plan = processor.getExecutionPlan(sources)
processor.getSourceLevel(sourceName, depth)

// Execution
await processor.executeDataSources(document)

// Results
processor.isDataSourceSuccessful(name)
processor.isDataSourceFailed(name)
processor.getDataSourceData(name)
processor.getDataSourceError(name)

// Management
processor.reset()
```

---

## Known Limitations

1. **No retry logic** - Failed fetches don't auto-retry (by design, user can implement)
2. **No progress callbacks** - Can't track fetch progress (could add in future)
3. **No cancellation** - Can't cancel in-flight requests (could use AbortController)
4. **Global timeout** - Same timeout for all sources (could make per-source)

These are intentional simplifications that can be added if needed.

---

## Next Steps

**Phase 8: Template Expansion**
- Expand `<set>` variable declarations
- Expand `<if>/<elseif>/<else>` conditionals
- Expand `<foreach>` and `<while>` loops
- Expand `<on-data>` with fetched data
- Expand `<on-error>` for failed fetches
- Variable scoping and shadowing

**Phase 9: Expression Resolution**
- Parse expression tokens
- Resolve `$parent`, `$this`, `$BlockId` references
- Evaluate arithmetic, logical, comparison operators
- Call user-supplied functions
- Two-pass resolution for forward references

---

## Summary

Phase 6 is **complete and fully tested**. The transaction and data source system provides a clean, flexible interface for async data fetching with proper error handling, caching, and parallel execution support.

**Key Achievements:**
- ✅ Transaction class with comprehensive management
- ✅ Data source detection in templates
- ✅ Parallel and sequential execution strategies
- ✅ Timeout and error handling
- ✅ Result caching for performance
- ✅ 35 new tests (all passing)
- ✅ Clean API design
- ✅ Ready for Phase 8 integration

**Status:** Ready for Phase 8 - Template Expansion
