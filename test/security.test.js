import { test, describe } from "node:test";
import assert from "node:assert";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { FileLoader } from "../src/project/loader.js";
import {
  resolveImportPath,
  resolveFileInPackage,
} from "../src/project/resolver.js";
import { ImportGraph } from "../src/project/import-graph.js";
import { ImportProcessor } from "../src/project/import-processor.js";
import { TagRegistry } from "../src/preprocessor/tags.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Security - Path Traversal Protection", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = {
    baseDir: fixturesDir,
    moduleDirectories: ["node_modules"],
  };

  test("blocks path traversal with ../../../", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");
    const maliciousPath = "../../../etc/passwd.ox";

    assert.throws(
      () => resolveImportPath(maliciousPath, currentFile, config),
      /Security.*outside project boundaries/,
      "Should block path traversal attempts",
    );
  });

  test("blocks absolute paths", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");
    // Use a path that starts with ./ to avoid package resolution
    const maliciousPath = "./../../../../../../../etc/passwd.ox";

    assert.throws(
      () => resolveImportPath(maliciousPath, currentFile, config),
      /Security.*outside project boundaries/,
      "Should block deep path traversal",
    );
  });

  test("blocks paths with null bytes", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");
    const maliciousPath = "./file\0.ox";

    assert.throws(
      () => resolveImportPath(maliciousPath, currentFile, config),
      /null byte/,
      "Should block null byte injection",
    );
  });

  test("blocks paths with invalid characters", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");
    const maliciousPath = "./file<>.ox";

    assert.throws(
      () => resolveImportPath(maliciousPath, currentFile, config),
      /invalid characters/,
      "Should block invalid filename characters",
    );
  });

  test("allows legitimate relative imports", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");
    const legitimatePath = "./tags-library.ox";

    // Should not throw
    const resolved = resolveImportPath(legitimatePath, currentFile, config);
    assert.ok(resolved.endsWith("tags-library.ox"));
    assert.ok(resolved.includes(fixturesDir));
  });

  test("allows legitimate parent directory imports", () => {
    const currentFile = path.join(fixturesDir, "subdir", "file.ox");
    const legitimatePath = "../simple.ox";

    // Create subdir for test
    const subdir = path.join(fixturesDir, "subdir");
    if (!fs.existsSync(subdir)) {
      fs.mkdirSync(subdir, { recursive: true });
    }
    const testFile = path.join(subdir, "file.ox");
    fs.writeFileSync(testFile, "[Test]");

    try {
      const resolved = resolveImportPath(legitimatePath, currentFile, config);
      assert.ok(resolved.endsWith("simple.ox"));
      assert.ok(resolved.includes(fixturesDir));
    } finally {
      // Cleanup
      fs.unlinkSync(testFile);
      fs.rmdirSync(subdir);
    }
  });
});

describe("Security - File Size Limits", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = {
    baseDir: fixturesDir,
    moduleDirectories: ["node_modules"],
  };

  test("blocks files over size limit", () => {
    // Create a fresh loader with isolated config to avoid cache
    const smallLimitConfig = {
      baseDir: fixturesDir,
      moduleDirectories: ["node_modules"],
    };
    // simple.ox is 50 bytes, so use a 40 byte limit to trigger the check
    const loader = new FileLoader(smallLimitConfig, { maxFileSize: 40 });
    const filePath = path.join(fixturesDir, "simple.ox");

    assert.throws(
      () => loader.loadFile(filePath),
      /File too large/,
      "Should block files exceeding size limit",
    );
  });

  test("allows files within size limit", () => {
    const loader = new FileLoader(config, { maxFileSize: 10 * 1024 * 1024 }); // 10MB
    const filePath = path.join(fixturesDir, "simple.ox");

    const result = loader.loadFile(filePath);
    assert.ok(result.ast);
    assert.ok(result.content);
  });

  test("evicts old files when cache is full", () => {
    const loader = new FileLoader(config, {
      maxFileSize: 10 * 1024 * 1024,
      maxCacheSize: 200, // Very small cache
      enableCacheEviction: true,
    });

    const file1 = path.join(fixturesDir, "simple.ox");
    const file2 = path.join(fixturesDir, "tags-library.ox");

    // Load first file
    loader.loadFile(file1);
    assert.ok(loader.hasLoaded(file1), "First file should be loaded");

    // Load second file - should evict first file due to cache size limit
    loader.loadFile(file2);
    assert.ok(loader.hasLoaded(file2), "Second file should be loaded");
    assert.ok(!loader.hasLoaded(file1), "First file should be evicted");

    // Verify cache size is within limit
    const stats = loader.getStats();
    assert.ok(
      stats.currentCacheSizeBytes <= 200,
      "Cache size should be within limit after eviction",
    );
  });

  test("blocks cache overflow when eviction is disabled", () => {
    const loader = new FileLoader(config, {
      maxFileSize: 10 * 1024 * 1024,
      maxCacheSize: 200, // Very small cache
      enableCacheEviction: false,
    });

    const file1 = path.join(fixturesDir, "simple.ox");
    const file2 = path.join(fixturesDir, "tags-library.ox");

    // Load first file
    loader.loadFile(file1);

    // Second file should throw because eviction is disabled
    assert.throws(
      () => loader.loadFile(file2),
      /Cache size limit exceeded/,
      "Should throw when eviction is disabled and cache is full",
    );
  });

  test("tracks cache size correctly", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    loader.loadFile(filePath);

    const stats = loader.getStats();
    assert.ok(stats.currentCacheSizeBytes > 0);
    assert.strictEqual(stats.filesLoaded, 1);
  });

  test("resets cache size on clearCache", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    loader.loadFile(filePath);
    assert.ok(loader.currentCacheSize > 0);

    loader.clearCache();
    assert.strictEqual(loader.currentCacheSize, 0);
  });
});

describe("Security - Import Depth Limits", () => {
  test("blocks imports deeper than max depth", () => {
    const graph = new ImportGraph({ maxDepth: 3 });

    // Push items to stack
    graph.push("/path/file1.ox", "import");
    graph.push("/path/file2.ox", "import");
    graph.push("/path/file3.ox", "import");

    // Fourth push should fail
    assert.throws(
      () => graph.push("/path/file4.ox", "import"),
      /Maximum.*depth exceeded/,
      "Should block imports exceeding max depth",
    );

    // Clean up
    graph.pop("/path/file3.ox");
    graph.pop("/path/file2.ox");
    graph.pop("/path/file1.ox");
  });

  test("allows imports within depth limit", () => {
    const graph = new ImportGraph({ maxDepth: 50 });

    // Should not throw
    graph.push("/path/file1.ox", "import");
    graph.push("/path/file2.ox", "import");

    const stack = graph.getStack();
    assert.strictEqual(stack.length, 2);

    // Clean up
    graph.pop("/path/file2.ox");
    graph.pop("/path/file1.ox");
  });

  test("provides clear error with import chain", () => {
    const graph = new ImportGraph({ maxDepth: 2 });

    graph.push("/path/file1.ox", "import");
    graph.push("/path/file2.ox", "import");

    try {
      graph.push("/path/file3.ox", "import");
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err.message.includes("file1.ox"));
      assert.ok(err.message.includes("file2.ox"));
      assert.ok(err.message.includes("file3.ox"));
    }

    // Clean up
    graph.pop("/path/file2.ox");
    graph.pop("/path/file1.ox");
  });
});

describe("Security - Input Validation", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = {
    baseDir: fixturesDir,
    moduleDirectories: ["node_modules"],
  };

  test("blocks empty import paths", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");

    assert.throws(
      () => resolveImportPath("", currentFile, config),
      /must be a non-empty string/,
      "Should block empty paths",
    );
  });

  test("blocks non-string import paths", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");

    assert.throws(
      () => resolveImportPath(null, currentFile, config),
      /must be a non-empty string/,
      "Should block non-string paths",
    );
  });

  test("blocks paths without .ox extension", () => {
    const currentFile = path.join(fixturesDir, "simple.ox");

    assert.throws(
      () => resolveImportPath("./file.txt", currentFile, config),
      /must include \.ox extension/,
      "Should require .ox extension",
    );
  });

  test("validates alias format", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const tagRegistry = new TagRegistry();
    const processor = new ImportProcessor(loader, graph, tagRegistry);

    // Invalid: starts with number
    assert.throws(
      () => processor.validateAlias("123invalid"),
      /must start with a letter or underscore/,
    );

    // Invalid: contains spaces
    assert.throws(
      () => processor.validateAlias("invalid alias"),
      /contain only letters, numbers/,
    );

    // Invalid: empty
    assert.throws(
      () => processor.validateAlias(""),
      /must be a non-empty string/,
    );
  });

  test("blocks reserved keywords as aliases", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const tagRegistry = new TagRegistry();
    const processor = new ImportProcessor(loader, graph, tagRegistry);

    assert.throws(
      () => processor.validateAlias("import"),
      /conflicts with reserved keyword/,
    );

    assert.throws(
      () => processor.validateAlias("foreach"),
      /conflicts with reserved keyword/,
    );
  });

  test("blocks overly long aliases", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const tagRegistry = new TagRegistry();
    const processor = new ImportProcessor(loader, graph, tagRegistry);

    const longAlias = "a".repeat(51);
    assert.throws(() => processor.validateAlias(longAlias), /too long/);
  });

  test("allows valid aliases", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const tagRegistry = new TagRegistry();
    const processor = new ImportProcessor(loader, graph, tagRegistry);

    // Should not throw
    processor.validateAlias("validAlias");
    processor.validateAlias("valid_alias");
    processor.validateAlias("_validAlias");
    processor.validateAlias("valid123");
  });
});

describe("Security - Package Resolution", () => {
  test("blocks package source directory escaping package boundaries", () => {
    const packageDir = "/fake/node_modules/evil-package";
    const maliciousConfig = {
      source: "../../../etc",
    };

    assert.throws(
      () => resolveFileInPackage("passwd.ox", packageDir, maliciousConfig),
      /escapes package boundaries/,
      "Should block source directory traversal",
    );
  });

  test("blocks file path escaping source directory", () => {
    const packageDir = "/fake/node_modules/package";
    const config = {
      source: "./ox",
    };

    assert.throws(
      () => resolveFileInPackage("../../outside.ox", packageDir, config),
      /escapes package source directory/,
      "Should block file path traversal",
    );
  });

  test("allows legitimate package file resolution", () => {
    const packageDir = "/fake/node_modules/package";
    const config = {
      source: "./ox",
    };

    const resolved = resolveFileInPackage(
      "components/button.ox",
      packageDir,
      config,
    );
    assert.ok(resolved.includes("ox"));
    assert.ok(resolved.includes("components"));
    assert.ok(resolved.includes("button.ox"));
  });
});
