import { test, describe } from "node:test";
import assert from "node:assert";
import path from "path";
import { fileURLToPath } from "url";
import { FileLoader } from "../src/project/loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("FileLoader", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = { baseDir: fixturesDir };

  test("loads and parses a simple file", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    const result = loader.loadFile(filePath);

    assert.ok(result.ast, "Should have AST");
    assert.ok(result.content, "Should have content");
    assert.strictEqual(result.filePath, path.normalize(filePath));
    assert.strictEqual(result.ast.type, "Document");
    assert.strictEqual(result.ast.blocks.length, 1);
    assert.strictEqual(result.ast.blocks[0].id, "Container");
  });

  test("caches loaded files", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    const result1 = loader.loadFile(filePath);
    const result2 = loader.loadFile(filePath);

    // Should return same cached object
    assert.strictEqual(result1, result2);
    assert.strictEqual(loader.getLoadedFiles().length, 1);
  });

  test("hasLoaded returns true for loaded files", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    assert.strictEqual(loader.hasLoaded(filePath), false);

    loader.loadFile(filePath);

    assert.strictEqual(loader.hasLoaded(filePath), true);
  });

  test("getCache returns cached result", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    assert.strictEqual(loader.getCache(filePath), null);

    const result = loader.loadFile(filePath);

    assert.strictEqual(loader.getCache(filePath), result);
  });

  test("getLoadedFiles returns files in load order", () => {
    const loader = new FileLoader(config);
    const file1 = path.join(fixturesDir, "simple.ox");
    const file2 = path.join(fixturesDir, "with-tag.ox");

    loader.loadFile(file1);
    loader.loadFile(file2);

    const loaded = loader.getLoadedFiles();
    assert.strictEqual(loaded.length, 2);
    assert.strictEqual(loaded[0], path.normalize(file1));
    assert.strictEqual(loaded[1], path.normalize(file2));
  });

  test("clearCache removes all cached files", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    loader.loadFile(filePath);
    assert.strictEqual(loader.hasLoaded(filePath), true);

    loader.clearCache();

    assert.strictEqual(loader.hasLoaded(filePath), false);
    assert.strictEqual(loader.getLoadedFiles().length, 0);
  });

  test("reloadFile forces fresh load", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    const result1 = loader.loadFile(filePath);
    const result2 = loader.reloadFile(filePath);

    // Should be different objects (fresh parse)
    assert.notStrictEqual(result1, result2);

    // But should have same structure
    assert.strictEqual(result1.filePath, result2.filePath);
    assert.strictEqual(loader.getLoadedFiles().length, 1);
  });

  test("throws error for missing file", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "missing.ox");

    assert.throws(
      () => loader.loadFile(filePath),
      /File not found/
    );
  });

  test("throws error for invalid extension", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "file.txt");

    assert.throws(
      () => loader.loadFile(filePath),
      /Invalid file extension.*must have \.ox extension/
    );
  });

  test("getStats returns cache statistics", () => {
    const loader = new FileLoader(config);
    const file1 = path.join(fixturesDir, "simple.ox");
    const file2 = path.join(fixturesDir, "with-tag.ox");

    loader.loadFile(file1);
    loader.loadFile(file2);

    const stats = loader.getStats();
    assert.strictEqual(stats.filesLoaded, 2);
    assert.strictEqual(stats.cacheSize, 2);
    assert.strictEqual(stats.loadOrder.length, 2);
  });

  test("normalizes paths for consistent caching", () => {
    const loader = new FileLoader(config);
    const filePath = path.join(fixturesDir, "simple.ox");

    // Load with different path representations
    const result1 = loader.loadFile(filePath);
    const result2 = loader.loadFile(path.normalize(filePath));

    // Should return same cached object
    assert.strictEqual(result1, result2);
    assert.strictEqual(loader.getLoadedFiles().length, 1);
  });
});
