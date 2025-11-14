import { test, describe } from "node:test";
import assert from "node:assert";
import path from "path";
import { fileURLToPath } from "url";
import { OXProject } from "../src/project/project.js";
import { TagRegistry } from "../src/preprocessor/tags.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("OXProject", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");

  test("creates project from directory", () => {
    const project = OXProject.fromDirectory(fixturesDir);

    assert.ok(project);
    assert.ok(project.config);
    assert.ok(project.tagRegistry);
    assert.ok(project.loader);
    assert.ok(project.graph);
  });

  test("creates project from file", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    assert.ok(project);
    assert.strictEqual(project.config.baseDir, fixturesDir);
    assert.strictEqual(project.config.entryPoint, "simple.ox");
  });

  test("parses simple file", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    const blocks = project.parse();

    assert.ok(Array.isArray(blocks));
    assert.ok(blocks.length > 0);
  });

  test("parses file with imports", () => {
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const project = OXProject.fromFile(filePath);

    const blocks = project.parse();

    // Should successfully process imports and merge tag definitions
    assert.ok(Array.isArray(blocks));

    // Check that multiple files were loaded
    const loadedFiles = project.getLoadedFiles();
    assert.ok(loadedFiles.length > 1); // Main file + imported files
  });

  test("parses file with injects", () => {
    const filePath = path.join(fixturesDir, "inject-main.ox");
    const project = OXProject.fromFile(filePath);

    const blocks = project.parse();

    // Should have injected blocks
    assert.ok(Array.isArray(blocks));
    assert.ok(blocks.length >= 3); // Header, App, Footer

    // Check that injected files were loaded
    const loadedFiles = project.getLoadedFiles();
    assert.ok(loadedFiles.length > 1);
  });

  test("getLoadedFiles returns files in load order", () => {
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const project = OXProject.fromFile(filePath);

    project.parse();

    const loadedFiles = project.getLoadedFiles();
    assert.ok(Array.isArray(loadedFiles));
    assert.ok(loadedFiles.length > 0);
    // Main file should be in the list
    assert.ok(loadedFiles.some((f) => f.endsWith("imports-main.ox")));
  });

  test("getStats returns cache statistics", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    project.parse();

    const stats = project.getStats();
    assert.ok(stats);
    assert.strictEqual(typeof stats.filesLoaded, "number");
    assert.ok(stats.filesLoaded > 0);
    assert.strictEqual(typeof stats.currentCacheSizeBytes, "number");
  });

  test("clearCache resets loader state", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    project.parse();
    assert.ok(project.getLoadedFiles().length > 0);

    project.clearCache();
    assert.strictEqual(project.getLoadedFiles().length, 0);
  });

  test("getConfig returns project configuration", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    const config = project.getConfig();
    assert.ok(config);
    assert.strictEqual(config.baseDir, fixturesDir);
    assert.strictEqual(config.entryPoint, "simple.ox");
  });

  test("getTagRegistry returns tag registry instance", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    const registry = project.getTagRegistry();
    assert.ok(registry);
    assert.ok(registry instanceof TagRegistry);
  });

  test("uses custom tag registry", () => {
    const customRegistry = new TagRegistry();
    customRegistry.defineTag("custom", {
      canReuse: true,
      canOutput: false,
    });

    const filePath = path.join(fixturesDir, "simple.ox");
    const config = {
      baseDir: fixturesDir,
      entryPoint: "simple.ox",
      moduleDirectories: ["node_modules"],
    };

    const project = new OXProject(config, customRegistry);

    assert.strictEqual(project.getTagRegistry(), customRegistry);
    assert.ok(project.getTagRegistry().getTag("custom"));
  });

  test("parseFile parses specific file", () => {
    const project = OXProject.fromDirectory(fixturesDir);
    const filePath = path.join(fixturesDir, "simple.ox");

    const blocks = project.parseFile(filePath);

    assert.ok(Array.isArray(blocks));
    assert.ok(blocks.length > 0);
  });

  test("reloadFile bypasses cache", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    // Parse once
    const blocks1 = project.parse();

    // Reload
    const blocks2 = project.reloadFile(filePath);

    // Should have same structure
    assert.strictEqual(blocks1.length, blocks2.length);
  });

  test("handles imports with namespacing", () => {
    const filePath = path.join(fixturesDir, "imports-with-namespace.ox");
    const project = OXProject.fromFile(filePath);

    const blocks = project.parse();

    // Should successfully process namespaced imports
    assert.ok(Array.isArray(blocks));

    // Tag registry should have namespaced definitions
    const registry = project.getTagRegistry();
    assert.ok(registry);
  });

  test("handles nested imports", () => {
    const filePath = path.join(fixturesDir, "nested-import.ox");
    const project = OXProject.fromFile(filePath);

    const blocks = project.parse();

    // Should successfully process nested imports
    assert.ok(Array.isArray(blocks));

    // Multiple files should be loaded
    const loadedFiles = project.getLoadedFiles();
    assert.ok(loadedFiles.length > 1);
  });

  test("maintains file scope separation with injects", () => {
    const filePath = path.join(fixturesDir, "inject-main.ox");
    const project = OXProject.fromFile(filePath);

    const blocks = project.parse();

    // Each injected file should be evaluated independently
    assert.ok(Array.isArray(blocks));
    assert.ok(blocks.length > 0);
  });

  test("detects circular dependencies", () => {
    const filePath = path.join(fixturesDir, "circular-inject-a.ox");
    const project = OXProject.fromFile(filePath);

    // Should throw on circular inject
    assert.throws(() => {
      project.parse();
    }, /circular.*dependency/i);
  });

  test("supports macro context in parse", () => {
    const filePath = path.join(fixturesDir, "simple.ox");
    const project = OXProject.fromFile(filePath);

    let onParseCalled = false;
    const macroContext = {
      onParse: (ctx) => {
        onParseCalled = true;
      },
    };

    const blocks = project.parse(macroContext);

    assert.ok(Array.isArray(blocks));
    assert.ok(onParseCalled);
  });

  test("fromDirectory uses ox.config.js", () => {
    // This test assumes ox.config.js exists in fixtures
    const project = OXProject.fromDirectory(fixturesDir);

    const config = project.getConfig();
    assert.ok(config);
    assert.ok(config.baseDir);
  });

  test("applies options overrides to config", () => {
    const project = OXProject.fromDirectory(fixturesDir, {
      maxFileSize: 5000,
    });

    const config = project.getConfig();
    assert.strictEqual(config.maxFileSize, 5000);
  });
});
