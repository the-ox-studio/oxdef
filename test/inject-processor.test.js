import { test, describe } from "node:test";
import assert from "node:assert";
import path from "path";
import { fileURLToPath } from "url";
import { FileLoader } from "../src/project/loader.js";
import { ImportGraph } from "../src/project/import-graph.js";
import { InjectProcessor } from "../src/project/inject-processor.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";
import { Transaction } from "../src/transaction/transaction.js";
import { TagRegistry } from "../src/preprocessor/tags.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("InjectProcessor", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "multi-file");
  const config = {
    baseDir: fixturesDir,
    moduleDirectories: ["node_modules"],
  };

  /**
   * Helper function to evaluate a file (parse + preprocess)
   * This simulates what the OXProject would do
   */
  function evaluateFile(filePath, ast, config) {
    // Create a transaction for preprocessing
    const transaction = new Transaction();
    const tagRegistry = new TagRegistry();
    const dataSourceProcessor = new DataSourceProcessor(transaction);

    // Preprocess the AST (this evaluates templates, references, etc.)
    const expander = new TemplateExpander(transaction, dataSourceProcessor);
    const result = expander.expandTemplates(ast);

    // Return the evaluated blocks
    return result || [];
  }

  test("extracts inject directives from AST", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    const injects = processor.extractInjects(ast);

    // Should find 3 injects: 2 top-level and 1 block-child
    assert.strictEqual(injects.length, 3);

    // Check top-level injects
    const topLevelInjects = injects.filter((i) => i.type === "top-level");
    assert.strictEqual(topLevelInjects.length, 2);
    assert.ok(topLevelInjects.some((i) => i.path === "./header.ox"));
    assert.ok(topLevelInjects.some((i) => i.path === "./footer.ox"));

    // Check block-child inject
    const blockInjects = injects.filter((i) => i.type === "block-child");
    assert.strictEqual(blockInjects.length, 1);
    assert.strictEqual(blockInjects[0].path, "./content.ox");
    assert.strictEqual(blockInjects[0].parentBlock, "App");
  });

  test("processes top-level inject", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    // Process injects
    const modifiedAst = processor.processInjects(ast, filePath, config);

    // Should have 3 blocks: Header (injected), App, Footer (injected)
    assert.strictEqual(modifiedAst.blocks.length, 3);
    assert.strictEqual(modifiedAst.blocks[0].id, "Header");
    assert.strictEqual(modifiedAst.blocks[1].id, "App");
    assert.strictEqual(modifiedAst.blocks[2].id, "Footer");

    // Header should have Logo child
    assert.strictEqual(modifiedAst.blocks[0].children.length, 1);
    assert.strictEqual(modifiedAst.blocks[0].children[0].id, "Logo");
  });

  test("processes block-child inject", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    // Process injects
    const modifiedAst = processor.processInjects(ast, filePath, config);

    // App block should have Content as first child (injected)
    const appBlock = modifiedAst.blocks.find((b) => b.id === "App");
    assert.ok(appBlock);
    assert.strictEqual(appBlock.children.length, 1);
    assert.strictEqual(appBlock.children[0].id, "Content");

    // Content should have 2 Article children
    assert.strictEqual(appBlock.children[0].children.length, 2);
    assert.strictEqual(appBlock.children[0].children[0].id, "Article");
    assert.strictEqual(appBlock.children[0].children[1].id, "Article");
  });

  test("maintains file scope separation for variables", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    // Create a test file that uses variables
    const mainPath = path.join(fixturesDir, "scope-test.ox");
    const { ast } = loader.loadFile(mainPath);

    // Process the file (which has <set theme = "dark">)
    const modifiedAst = processor.processInjects(ast, mainPath, config);

    // Settings block should exist
    assert.strictEqual(modifiedAst.blocks.length, 1);
    assert.strictEqual(modifiedAst.blocks[0].id, "Settings");

    // Note: The actual variable evaluation happens during preprocessing,
    // not during inject processing. This test validates the structure.
  });

  test("detects circular inject dependencies", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "circular-inject-a.ox");
    const { ast } = loader.loadFile(filePath);

    // Should throw when processing circular injects
    assert.throws(
      () => processor.processInjects(ast, filePath, config),
      /circular.*dependency/i,
      "Should detect circular inject dependency",
    );
  });

  test("resolves relative inject paths correctly", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    // Extract injects to verify paths
    const injects = processor.extractInjects(ast);

    // All paths should be relative
    assert.ok(injects.every((i) => i.path.startsWith("./")));
  });

  test("throws error for invalid inject path", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    // Create a mock inject node with invalid path
    const injectNode = {
      type: "Inject",
      path: null,
    };

    const currentFile = path.join(fixturesDir, "inject-main.ox");

    assert.throws(
      () => processor.processInject(injectNode, currentFile, config),
      /must have a valid path string/,
      "Should throw for invalid path",
    );
  });

  test("throws error for non-Inject node", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    // Create a mock node that's not an Inject
    const wrongNode = {
      type: "Block",
      identifier: "Test",
    };

    const currentFile = path.join(fixturesDir, "inject-main.ox");

    assert.throws(
      () => processor.processInject(wrongNode, currentFile, config),
      /Expected Inject node/,
      "Should throw for non-Inject node",
    );
  });

  test("clears inject arrays after processing", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    // Process injects
    const modifiedAst = processor.processInjects(ast, filePath, config);

    // Injects array should be cleared
    assert.deepStrictEqual(modifiedAst.injects, []);

    // Block injects should also be cleared
    const appBlock = modifiedAst.blocks.find((b) => b.id === "App");
    assert.deepStrictEqual(appBlock.injects, []);
  });

  test("processes nested inject correctly", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    // Create a file with nested structure
    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    const modifiedAst = processor.processInjects(ast, filePath, config);

    // Verify structure
    assert.ok(modifiedAst.blocks.length > 0);

    // All inject directives should be replaced with actual blocks
    const hasInjectNodes = (node) => {
      if (node.injects && node.injects.length > 0) return true;
      if (node.blocks) {
        return node.blocks.some((b) => hasInjectNodes(b));
      }
      return false;
    };

    assert.strictEqual(
      hasInjectNodes(modifiedAst),
      false,
      "All inject nodes should be processed",
    );
  });

  test("handles inject with non-existent file", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    // Create a mock inject node pointing to non-existent file
    const injectNode = {
      type: "Inject",
      path: "./non-existent.ox",
    };

    const currentFile = path.join(fixturesDir, "inject-main.ox");

    assert.throws(
      () => processor.processInject(injectNode, currentFile, config),
      /File not found/,
      "Should throw for non-existent file",
    );
  });

  test("tracks inject in graph during processing", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "header.ox");
    const { ast } = loader.loadFile(filePath);

    // Process (no injects in header.ox, but validates graph tracking)
    processor.processInjects(ast, filePath, config);

    // Graph should be empty after processing
    assert.strictEqual(graph.getStack().length, 0);
  });

  test("evaluates injected file independently", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    // Process injects
    const modifiedAst = processor.processInjects(ast, filePath, config);

    // Each injected file should be evaluated as a separate tree
    // Header.ox has Logo as child, and this relationship should be preserved
    const headerBlock = modifiedAst.blocks.find((b) => b.id === "Header");
    assert.ok(headerBlock);
    assert.ok(headerBlock.children.length > 0);

    // Footer.ox is a single block with properties
    const footerBlock = modifiedAst.blocks.find((b) => b.id === "Footer");
    assert.ok(footerBlock);
    assert.ok(footerBlock.properties.copyright);
  });

  test("validateInjectLocations accepts valid AST", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    const filePath = path.join(fixturesDir, "inject-main.ox");
    const { ast } = loader.loadFile(filePath);

    // Should not throw for valid inject locations
    assert.doesNotThrow(() => processor.validateInjectLocations(ast));
  });

  test("containsInjectReference detects inject in object", () => {
    const loader = new FileLoader(config);
    const graph = new ImportGraph();
    const processor = new InjectProcessor(loader, graph, evaluateFile);

    // Test with inject node
    const injectNode = { type: "Inject", path: "./test.ox" };
    assert.strictEqual(processor.containsInjectReference(injectNode), true);

    // Test with nested object
    const nested = { value: { nested: injectNode } };
    assert.strictEqual(processor.containsInjectReference(nested), true);

    // Test with array
    const array = [1, 2, injectNode];
    assert.strictEqual(processor.containsInjectReference(array), true);

    // Test with normal value
    assert.strictEqual(processor.containsInjectReference("string"), false);
    assert.strictEqual(processor.containsInjectReference(123), false);
    assert.strictEqual(processor.containsInjectReference(null), false);
  });
});
