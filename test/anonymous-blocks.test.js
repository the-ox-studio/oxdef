import { test, describe } from "node:test";
import assert from "node:assert";
import { Tokenizer } from "../src/lexer/tokenizer.js";
import { Parser } from "../src/parser/parser.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";
import {
  BlockRegistryBuilder,
  ReferenceResolver,
} from "../src/preprocessor/references.js";
import { ExpressionEvaluator } from "../src/preprocessor/expressions.js";

describe("Anonymous Blocks", () => {
  /**
   * Helper to parse and expand templates
   */
  function parseAndExpand(source) {
    const tokenizer = new Tokenizer(source);
    const tokens = tokenizer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);
    const blocks = expander.expandTemplates(ast);

    return { blocks: blocks || [] };
  }

  /**
   * Helper to parse, expand, and resolve references
   */
  function parseExpandAndResolve(source) {
    const ast = parseAndExpand(source);

    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    // Pass 1: Build registry
    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast.blocks);
    builder.finalize();

    // Pass 2: Resolve references
    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast.blocks);

    return { ast, registry };
  }

  describe("Parser - Anonymous Blocks", () => {
    test("should parse empty anonymous block", () => {
      const source = "[ ]";
      const ast = parseAndExpand(source);

      assert.strictEqual(ast.blocks.length, 1);
      assert.strictEqual(ast.blocks[0].type, "Block");
      assert.strictEqual(ast.blocks[0].id, null);
      assert.deepStrictEqual(ast.blocks[0].properties, {});
      assert.deepStrictEqual(ast.blocks[0].children, []);
    });

    test("should parse anonymous block with properties", () => {
      const source = "[ (x: 10, y: 20)]";
      const ast = parseAndExpand(source);

      assert.strictEqual(ast.blocks.length, 1);
      assert.strictEqual(ast.blocks[0].id, null);
      assert.strictEqual(ast.blocks[0].properties.x.value, 10);
      assert.strictEqual(ast.blocks[0].properties.y.value, 20);
    });

    test("should parse anonymous block with children", () => {
      const source = `
        [
          [Child1]
          [Child2]
        ]
      `;
      const ast = parseAndExpand(source);

      assert.strictEqual(ast.blocks.length, 1);
      assert.strictEqual(ast.blocks[0].id, null);
      assert.strictEqual(ast.blocks[0].children.length, 2);
      assert.strictEqual(ast.blocks[0].children[0].id, "Child1");
      assert.strictEqual(ast.blocks[0].children[1].id, "Child2");
    });

    test("should parse mixed named and anonymous blocks", () => {
      const source = `
        [Container
          [Header]
          [ (data: "anon1")]
          [ (data: "anon2")]
          [Footer]
        ]
      `;
      const ast = parseAndExpand(source);

      const container = ast.blocks[0];
      assert.strictEqual(container.id, "Container");
      assert.strictEqual(container.children.length, 4);
      assert.strictEqual(container.children[0].id, "Header");
      assert.strictEqual(container.children[1].id, null);
      assert.strictEqual(container.children[2].id, null);
      assert.strictEqual(container.children[3].id, "Footer");
    });

    test("should parse anonymous block with tag instance", () => {
      const source = `
        @myTag [MyTag (value: 100)]
        #myTag [ ]
      `;
      const ast = parseAndExpand(source);

      assert.strictEqual(ast.blocks.length, 2);
      assert.strictEqual(ast.blocks[0].id, "MyTag");
      assert.strictEqual(ast.blocks[1].id, null);
      assert.strictEqual(ast.blocks[1].tags.length, 1);
      assert.strictEqual(ast.blocks[1].tags[0].name, "myTag");
    });
  });

  describe("BlockRegistry - Index Tracking", () => {
    test("should track block indices in registry", () => {
      const source = `
        [Container
          [First]
          [ (data: "second")]
          [Third]
        ]
      `;
      const { registry } = parseExpandAndResolve(source);

      const container = registry.blocks.keys().next().value;
      const children = registry.getChildren(container);

      assert.strictEqual(children.length, 3);

      const firstContext = registry.getContext(children[0]);
      const secondContext = registry.getContext(children[1]);
      const thirdContext = registry.getContext(children[2]);

      assert.strictEqual(firstContext.index, 0);
      assert.strictEqual(secondContext.index, 1);
      assert.strictEqual(thirdContext.index, 2);
    });

    test("should find sibling by index", () => {
      const source = `
        [Container
          [Alpha]
          [ (value: 42)]
          [Gamma]
        ]
      `;
      const { registry } = parseExpandAndResolve(source);

      const container = registry.blocks.keys().next().value;
      const children = registry.getChildren(container);
      const alpha = children[0];

      const siblingByIndex0 = registry.findSibling(alpha, 0);
      const siblingByIndex1 = registry.findSibling(alpha, 1);
      const siblingByIndex2 = registry.findSibling(alpha, 2);

      assert.strictEqual(siblingByIndex0.id, "Alpha");
      assert.strictEqual(siblingByIndex1.id, null);
      assert.strictEqual(siblingByIndex2.id, "Gamma");
    });

    test("should find sibling by ID (backward compatibility)", () => {
      const source = `
        [Container
          [Alpha]
          [Beta]
        ]
      `;
      const { registry } = parseExpandAndResolve(source);

      const container = registry.blocks.keys().next().value;
      const children = registry.getChildren(container);
      const alpha = children[0];

      const beta = registry.findSibling(alpha, "Beta");
      assert.strictEqual(beta.id, "Beta");
    });

    test("should get children array for block", () => {
      const source = `
        [Parent
          [Child1]
          [ ]
          [Child3]
        ]
      `;
      const { registry } = parseExpandAndResolve(source);

      const parent = registry.blocks.keys().next().value;
      const children = registry.getChildren(parent);

      assert.strictEqual(children.length, 3);
      assert.strictEqual(children[0].id, "Child1");
      assert.strictEqual(children[1].id, null);
      assert.strictEqual(children[2].id, "Child3");
    });
  });

  describe("Reference Resolution - children property", () => {
    test("should resolve $parent.children in expression", () => {
      const source = `
        [Container
          [ (x: 10)]
          [ (x: 20)]
          [Display (total: ($parent.children[0].x + $parent.children[1].x))]
        ]
      `;
      const { ast } = parseExpandAndResolve(source);

      const container = ast.blocks[0];
      const display = container.children[2];

      assert.strictEqual(display.properties.total.value, 30);
    });

    test("should access anonymous blocks by index", () => {
      const source = `
        [Parent
          [ (value: 100)]
          [ (value: 200)]
          [Reader (first: ($parent.children[0].value), second: ($parent.children[1].value))]
        ]
      `;
      const { ast } = parseExpandAndResolve(source);

      const parent = ast.blocks[0];
      const reader = parent.children[2];

      assert.strictEqual(reader.properties.first.value, 100);
      assert.strictEqual(reader.properties.second.value, 200);
    });

    test("should access named block by index", () => {
      const source = `
        [Container
          [Header (title: "Top")]
          [Footer (title: "Bottom")]
          [Display (headerTitle: ($parent.children[0].title))]
        ]
      `;
      const { ast } = parseExpandAndResolve(source);

      const container = ast.blocks[0];
      const display = container.children[2];

      assert.strictEqual(display.properties.headerTitle.value, "Top");
    });

    test("should handle mixed named and indexed access", () => {
      const source = `
        [Container
          [Header (title: "Top")]
          [ (data: "middle")]
          [Footer (title: "Bottom")]
          [Display (
            byName: ($Header.title),
            byIndex: ($parent.children[0].title),
            anon: ($parent.children[1].data)
          )]
        ]
      `;
      const { ast } = parseExpandAndResolve(source);

      const container = ast.blocks[0];
      const display = container.children[3];

      assert.strictEqual(display.properties.byName.value, "Top");
      assert.strictEqual(display.properties.byIndex.value, "Top");
      assert.strictEqual(display.properties.anon.value, "middle");
    });
  });

  describe("Expression Evaluator - Array Indexing", () => {
    test("should support bracket notation with numeric index", () => {
      const source = `
        [Container
          [ (value: 10)]
          [ (value: 20)]
          [ (value: 30)]
          [Display (
            first: ($parent.children[0].value)
          )]
        ]
      `;
      const { ast } = parseExpandAndResolve(source);

      const container = ast.blocks[0];
      const display = container.children[3];
      assert.strictEqual(display.properties.first.value, 10);
    });

    test("should support multiple bracket accesses", () => {
      const source = `
        [Container
          [ (value: 100)]
          [ (value: 200)]
          [ (value: 300)]
          [Display (
            first: ($parent.children[0].value),
            second: ($parent.children[1].value)
          )]
        ]
      `;
      const { ast } = parseExpandAndResolve(source);

      const container = ast.blocks[0];
      const display = container.children[3];
      assert.strictEqual(display.properties.first.value, 100);
      assert.strictEqual(display.properties.second.value, 200);
    });
  });

  describe("Integration - Anonymous Blocks with Templates", () => {
    test("should work with conditional templates", () => {
      const source = `
        <set showAnon = true>
        [Container
          <if (true)>
            [ (data: "conditional")]
          </if>
        ]
      `;
      const ast = parseAndExpand(source);

      const container = ast.blocks[0];
      assert.strictEqual(container.children.length, 1);
      assert.strictEqual(container.children[0].id, null);
      assert.strictEqual(
        container.children[0].properties.data.value,
        "conditional",
      );
    });

    test("should parse nested anonymous blocks", () => {
      const source = `
        [Outer
          [
            [ (data: "nested")]
          ]
        ]
      `;
      const ast = parseAndExpand(source);

      const outer = ast.blocks[0];
      assert.strictEqual(outer.id, "Outer");
      assert.strictEqual(outer.children.length, 1);
      assert.strictEqual(outer.children[0].id, null);
      assert.strictEqual(outer.children[0].children.length, 1);
      assert.strictEqual(outer.children[0].children[0].id, null);
      assert.strictEqual(
        outer.children[0].children[0].properties.data.value,
        "nested",
      );
    });
  });
});
