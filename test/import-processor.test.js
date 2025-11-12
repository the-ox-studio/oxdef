import { test, describe } from "node:test";
import assert from "node:assert";
import path from "path";
import { fileURLToPath } from "url";
import { FileLoader } from "../src/project/loader.js";
import { ImportProcessor } from "../src/project/import-processor.js";
import { resolveImportPath } from "../src/project/resolver.js";
import { ImportGraph } from "../src/project/import-graph.js";
import { TagRegistry } from "../src/preprocessor/tags.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("ImportProcessor", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = {
    baseDir: fixturesDir,
    moduleDirectories: ["node_modules"],
  };

  function createTestEnvironment() {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const tagRegistry = new TagRegistry();

    // Define required tags in registry
    tagRegistry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });
    tagRegistry.defineTag("widget", {
      block: { canReuse: true, canOutput: false },
    });
    tagRegistry.defineTag("layout", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new ImportProcessor(loader, graph, tagRegistry);

    return { loader, graph, tagRegistry, processor };
  }

  test("extracts import directives from AST", () => {
    const { loader, processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(filePath);

    const imports = processor.extractImports(ast);

    assert.strictEqual(imports.length, 1);
    assert.strictEqual(imports[0].type, "Import");
    assert.strictEqual(imports[0].path, "./tags-library.ox");
    assert.strictEqual(imports[0].alias, null);
  });

  test("extracts multiple imports with namespaces", () => {
    const { loader, processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-with-namespace.ox");
    const { ast } = loader.loadFile(filePath);

    const imports = processor.extractImports(ast);

    assert.strictEqual(imports.length, 2);
    assert.strictEqual(imports[0].path, "./tags-library.ox");
    assert.strictEqual(imports[0].alias, "lib");
    assert.strictEqual(imports[1].path, "./more-tags.ox");
    assert.strictEqual(imports[1].alias, "ui");
  });

  test("extracts tag definitions from imported file", () => {
    const { loader, processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "tags-library.ox");
    const { ast } = loader.loadFile(filePath);

    const definitions = processor.extractTagDefinitions(ast);

    assert.strictEqual(definitions.size, 2);
    assert.ok(definitions.has("component(Button)"));
    assert.ok(definitions.has("component(Input)"));

    // Should NOT include regular blocks
    assert.strictEqual(definitions.has("RegularBlock"), false);
  });

  test("processes single import and merges tag definitions", () => {
    const { loader, processor, tagRegistry } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(filePath);

    const result = processor.processImports(ast, filePath);

    assert.strictEqual(result.imports.length, 1);
    assert.strictEqual(result.totalDefinitions, 2);

    // Check tag definitions are in registry
    assert.ok(tagRegistry.instances.has("component(Button)"));
    assert.ok(tagRegistry.instances.has("component(Input)"));
  });

  test("processes imports with namespacing", () => {
    const { loader, processor, tagRegistry } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-with-namespace.ox");
    const { ast } = loader.loadFile(filePath);

    const result = processor.processImports(ast, filePath);

    assert.strictEqual(result.imports.length, 2);
    assert.strictEqual(result.imports[0].alias, "lib");
    assert.strictEqual(result.imports[1].alias, "ui");

    // Check namespaced definitions are registered with namespace prefix
    assert.ok(tagRegistry.instances.has("lib.component(Button)"));
    assert.ok(tagRegistry.instances.has("lib.component(Input)"));
    assert.ok(tagRegistry.instances.has("ui.widget(Panel)"));
    assert.ok(tagRegistry.instances.has("ui.widget(Card)"));
  });

  test("merges tag definitions without namespace (last import wins)", () => {
    const { processor, tagRegistry, loader } = createTestEnvironment();

    // Manually create two files with same tag
    const definitions1 = new Map([
      [
        "component(Button)",
        {
          tag: { name: "component", argument: "Button" },
          block: { id: "Button1" },
          key: "component(Button)",
        },
      ],
    ]);

    const definitions2 = new Map([
      [
        "component(Button)",
        {
          tag: { name: "component", argument: "Button" },
          block: { id: "Button2" },
          key: "component(Button)",
        },
      ],
    ]);

    processor.mergeTagDefinitions(definitions1, null);
    processor.mergeTagDefinitions(definitions2, null);

    // Second definition should win
    const instance = tagRegistry.instances.get("component(Button)");
    assert.strictEqual(instance.id, "Button2");
  });

  test("keeps namespaced definitions separate", () => {
    const { processor, tagRegistry } = createTestEnvironment();

    const definitions = new Map([
      [
        "component(Button)",
        {
          tag: { name: "component", argument: "Button" },
          block: { id: "Button1" },
          key: "component(Button)",
        },
      ],
    ]);

    processor.mergeTagDefinitions(definitions, "lib1");
    processor.mergeTagDefinitions(definitions, "lib2");

    assert.ok(tagRegistry.instances.has("lib1.component(Button)"));
    assert.ok(tagRegistry.instances.has("lib2.component(Button)"));
  });

  test("throws error for nested imports", () => {
    const { processor } = createTestEnvironment();

    const ast = {
      type: "Document",
      blocks: [
        {
          type: "Block",
          id: "Container",
          children: [
            {
              type: "Import",
              path: "./nested.ox",
              alias: null,
            },
          ],
        },
      ],
    };

    assert.throws(
      () => processor.extractImports(ast),
      /Import must be at document top-level/,
    );
  });

  test("validates import paths are resolved correctly", () => {
    const { loader, processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(filePath);

    const imports = processor.extractImports(ast);
    const importNode = imports[0];

    const resolvedPath = resolveImportPath(importNode.path, filePath, config);

    assert.ok(resolvedPath.endsWith("tags-library.ox"));
    assert.ok(path.isAbsolute(resolvedPath));
  });

  test("processes recursive imports", () => {
    const { processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "nested-import.ox");

    const processedFiles = processor.processFileImportsRecursive(filePath);

    // Should process both nested-import.ox and tags-library.ox
    assert.ok(processedFiles.size >= 2);
    assert.ok(
      Array.from(processedFiles).some((f) => f.includes("nested-import.ox")),
    );
    assert.ok(
      Array.from(processedFiles).some((f) => f.includes("tags-library.ox")),
    );
  });

  test("getTagDefinitions returns current registry instances", () => {
    const { loader, processor, tagRegistry } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(filePath);

    processor.processImports(ast, filePath);

    const definitions = processor.getTagDefinitions();

    assert.strictEqual(definitions, tagRegistry.instances);
    assert.ok(definitions.size > 0);
  });

  test("clearImportedTags removes all definitions", () => {
    const { loader, processor, tagRegistry } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(filePath);

    processor.processImports(ast, filePath);
    assert.ok(tagRegistry.instances.size > 0);

    processor.clearImportedTags();
    assert.strictEqual(tagRegistry.instances.size, 0);
  });

  test("handles files with no imports", () => {
    const { loader, processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "simple.ox");
    const { ast } = loader.loadFile(filePath);

    const imports = processor.extractImports(ast);

    assert.strictEqual(imports.length, 0);
  });

  test("handles files with tag definitions but no imports", () => {
    const { loader, processor } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "tags-library.ox");
    const { ast } = loader.loadFile(filePath);

    const definitions = processor.extractTagDefinitions(ast);

    assert.strictEqual(definitions.size, 2);
    assert.ok(definitions.has("component(Button)"));
    assert.ok(definitions.has("component(Input)"));
  });

  test("processImport returns correct structure", () => {
    const { loader, processor } = createTestEnvironment();
    const mainPath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(mainPath);

    const imports = processor.extractImports(ast);
    const result = processor.processImport(imports[0], mainPath);

    assert.strictEqual(result.path, "./tags-library.ox");
    assert.ok(result.resolvedPath.endsWith("tags-library.ox"));
    assert.strictEqual(result.alias, null);
    assert.ok(result.definitions instanceof Map);
    assert.strictEqual(result.definitions.size, 2);
  });

  test("tracks import dependencies in graph", () => {
    const { loader, processor, graph } = createTestEnvironment();
    const filePath = path.join(fixturesDir, "imports-main.ox");
    const { ast } = loader.loadFile(filePath);

    processor.processImports(ast, filePath);

    const graphData = graph.toJSON();
    assert.ok(graphData.edges.length > 0);

    const dep = graphData.edges.find((d) => d.type === "import");
    assert.ok(dep, "Should have import dependency");
  });
});
