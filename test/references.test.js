import { test, describe } from "node:test";
import assert from "node:assert";
import {
  BlockRegistry,
  BlockRegistryBuilder,
  ReferenceResolver,
} from "../src/preprocessor/references.js";
import { ExpressionEvaluator } from "../src/preprocessor/expressions.js";
import { TokenType } from "../src/lexer/tokenizer.js";
import { Transaction } from "../src/transaction/transaction.js";

describe("BlockRegistry", () => {
  test("should register a block", () => {
    const registry = new BlockRegistry();
    const blockNode = { type: "Block", id: "TestBlock", properties: {} };

    const context = registry.register(blockNode);

    assert.ok(context);
    assert.strictEqual(context.node, blockNode);
    assert.strictEqual(context.parent, null);
    assert.deepStrictEqual(context.children, []);
    assert.deepStrictEqual(context.siblings, []);
  });

  test("should track parent-child relationships", () => {
    const registry = new BlockRegistry();
    const parent = { type: "Block", id: "Parent", properties: {} };
    const child = { type: "Block", id: "Child", properties: {} };

    registry.register(parent);
    registry.register(child, parent);

    const childContext = registry.getContext(child);
    assert.strictEqual(childContext.parent, parent);
  });

  test("should build siblings after registration", () => {
    const registry = new BlockRegistry();
    const parent = { type: "Block", id: "Parent", properties: {} };
    const child1 = { type: "Block", id: "Child1", properties: {} };
    const child2 = { type: "Block", id: "Child2", properties: {} };
    const child3 = { type: "Block", id: "Child3", properties: {} };

    registry.register(parent);
    registry.register(child1, parent);
    registry.register(child2, parent);
    registry.register(child3, parent);
    registry.buildSiblings();

    const child1Context = registry.getContext(child1);
    assert.deepStrictEqual(child1Context.siblings, [child2, child3]);

    const child2Context = registry.getContext(child2);
    assert.deepStrictEqual(child2Context.siblings, [child1, child3]);
  });

  test("should find sibling by ID", () => {
    const registry = new BlockRegistry();
    const parent = { type: "Block", id: "Parent", properties: {} };
    const child1 = { type: "Block", id: "Sidebar", properties: {} };
    const child2 = { type: "Block", id: "Content", properties: {} };

    registry.register(parent);
    registry.register(child1, parent);
    registry.register(child2, parent);
    registry.buildSiblings();

    const sibling = registry.findSibling(child1, "Content");
    assert.strictEqual(sibling, child2);
  });

  test("should return null for non-existent sibling", () => {
    const registry = new BlockRegistry();
    const parent = { type: "Block", id: "Parent", properties: {} };
    const child = { type: "Block", id: "Child", properties: {} };

    registry.register(parent);
    registry.register(child, parent);
    registry.buildSiblings();

    const sibling = registry.findSibling(child, "NonExistent");
    assert.strictEqual(sibling, null);
  });
});

describe("BlockRegistryBuilder", () => {
  test("should build registry from simple AST", () => {
    const builder = new BlockRegistryBuilder();
    const ast = [
      {
        type: "Block",
        id: "TestBlock",
        properties: {
          width: { type: "Literal", valueType: "number", value: 100 },
        },
        children: [],
      },
    ];

    const registry = builder.build(ast);
    builder.finalize();

    const blockNode = ast[0];
    const context = registry.getContext(blockNode);

    assert.ok(context);
    assert.strictEqual(context.properties.width, 100);
  });

  test("should build registry from nested AST", () => {
    const builder = new BlockRegistryBuilder();
    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {
          size: { type: "Literal", valueType: "number", value: 200 },
        },
        children: [
          {
            type: "Block",
            id: "Child1",
            properties: {
              width: { type: "Literal", valueType: "number", value: 100 },
            },
            children: [],
          },
          {
            type: "Block",
            id: "Child2",
            properties: {
              width: { type: "Literal", valueType: "number", value: 100 },
            },
            children: [],
          },
        ],
      },
    ];

    const registry = builder.build(ast);
    builder.finalize();

    const parentNode = ast[0];
    const child1Node = ast[0].children[0];
    const child2Node = ast[0].children[1];

    const parentContext = registry.getContext(parentNode);
    assert.strictEqual(parentContext.properties.size, 200);
    assert.strictEqual(parentContext.parent, null);

    const child1Context = registry.getContext(child1Node);
    assert.strictEqual(child1Context.parent, parentNode);
    assert.deepStrictEqual(child1Context.siblings, [child2Node]);

    const child2Context = registry.getContext(child2Node);
    assert.strictEqual(child2Context.parent, parentNode);
    assert.deepStrictEqual(child2Context.siblings, [child1Node]);
  });

  test("should skip Expression properties in Pass 1", () => {
    const builder = new BlockRegistryBuilder();
    const ast = [
      {
        type: "Block",
        id: "TestBlock",
        properties: {
          width: { type: "Literal", valueType: "number", value: 100 },
          height: {
            type: "Expression",
            tokens: [
              { type: TokenType.DOLLAR, value: "$" },
              { type: TokenType.IDENTIFIER, value: "parent" },
            ],
          },
        },
        children: [],
      },
    ];

    const registry = builder.build(ast);
    builder.finalize();

    const blockNode = ast[0];
    const context = registry.getContext(blockNode);

    assert.strictEqual(context.properties.width, 100);
    assert.strictEqual(context.properties.height, undefined); // Expression not stored
  });
});

describe("ReferenceResolver - $this references", () => {
  test("should resolve $this.property", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "TestBlock",
        properties: {
          width: { type: "Literal", valueType: "number", value: 100 },
          doubled: {
            type: "Expression",
            tokens: [
              { type: TokenType.DOLLAR, value: "$" },
              { type: TokenType.IDENTIFIER, value: "this" },
              { type: TokenType.DOT, value: "." },
              { type: TokenType.IDENTIFIER, value: "width" },
              { type: TokenType.STAR, value: "*" },
              { type: TokenType.NUMBER, value: 2 },
              { type: TokenType.EOF, value: null },
            ],
            location: { line: 1, column: 1 },
          },
        },
        children: [],
      },
    ];

    // Pass 1: Build registry
    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    // Pass 2: Resolve references
    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast);

    const blockNode = ast[0];
    assert.strictEqual(blockNode.properties.doubled.type, "Literal");
    assert.strictEqual(blockNode.properties.doubled.value, 200);
  });

  test("should throw error if $this property not found", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "TestBlock",
        properties: {
          width: { type: "Literal", valueType: "number", value: 100 },
          invalid: {
            type: "Expression",
            tokens: [
              { type: TokenType.DOLLAR, value: "$" },
              { type: TokenType.IDENTIFIER, value: "this" },
              { type: TokenType.DOT, value: "." },
              { type: TokenType.IDENTIFIER, value: "nonExistent" },
              { type: TokenType.EOF, value: null },
            ],
            location: { line: 1, column: 1 },
          },
        },
        children: [],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);

    assert.throws(() => resolver.resolve(ast), {
      subtype: "PropertyNotFound",
    });
  });
});

describe("ReferenceResolver - $parent references", () => {
  test("should resolve $parent.property", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {
          size: { type: "Literal", valueType: "number", value: 200 },
        },
        children: [
          {
            type: "Block",
            id: "Child",
            properties: {
              width: {
                type: "Expression",
                tokens: [
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "parent" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "size" },
                  { type: TokenType.EOF, value: null },
                ],
                location: { line: 1, column: 1 },
              },
            },
            children: [],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast);

    const childNode = ast[0].children[0];
    assert.strictEqual(childNode.properties.width.type, "Literal");
    assert.strictEqual(childNode.properties.width.value, 200);
  });

  test("should resolve $parent.parent chaining", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Grandparent",
        properties: {
          size: { type: "Literal", valueType: "number", value: 300 },
        },
        children: [
          {
            type: "Block",
            id: "Parent",
            properties: {},
            children: [
              {
                type: "Block",
                id: "Child",
                properties: {
                  width: {
                    type: "Expression",
                    tokens: [
                      { type: TokenType.DOLLAR, value: "$" },
                      { type: TokenType.IDENTIFIER, value: "parent" },
                      { type: TokenType.DOT, value: "." },
                      { type: TokenType.IDENTIFIER, value: "parent" },
                      { type: TokenType.DOT, value: "." },
                      { type: TokenType.IDENTIFIER, value: "size" },
                      { type: TokenType.EOF, value: null },
                    ],
                    location: { line: 1, column: 1 },
                  },
                },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast);

    const childNode = ast[0].children[0].children[0];
    assert.strictEqual(childNode.properties.width.type, "Literal");
    assert.strictEqual(childNode.properties.width.value, 300);
  });

  test("should throw error if $parent used on root block", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Root",
        properties: {
          width: {
            type: "Expression",
            tokens: [
              { type: TokenType.DOLLAR, value: "$" },
              { type: TokenType.IDENTIFIER, value: "parent" },
              { type: TokenType.DOT, value: "." },
              { type: TokenType.IDENTIFIER, value: "size" },
              { type: TokenType.EOF, value: null },
            ],
            location: { line: 1, column: 1 },
          },
        },
        children: [],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);

    assert.throws(() => resolver.resolve(ast), {
      subtype: "NoParentBlock",
    });
  });
});

describe("ReferenceResolver - $BlockId references", () => {
  test("should resolve $BlockId.property for sibling", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {},
        children: [
          {
            type: "Block",
            id: "Sidebar",
            properties: {
              width: { type: "Literal", valueType: "number", value: 250 },
            },
            children: [],
          },
          {
            type: "Block",
            id: "Content",
            properties: {
              width: {
                type: "Expression",
                tokens: [
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "Sidebar" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "width" },
                  { type: TokenType.EOF, value: null },
                ],
                location: { line: 1, column: 1 },
              },
            },
            children: [],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast);

    const contentNode = ast[0].children[1];
    assert.strictEqual(contentNode.properties.width.type, "Literal");
    assert.strictEqual(contentNode.properties.width.value, 250);
  });

  test("should throw error if sibling block not found", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {},
        children: [
          {
            type: "Block",
            id: "Child",
            properties: {
              width: {
                type: "Expression",
                tokens: [
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "NonExistent" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "width" },
                  { type: TokenType.EOF, value: null },
                ],
                location: { line: 1, column: 1 },
              },
            },
            children: [],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);

    assert.throws(() => resolver.resolve(ast), {
      subtype: "BlockNotFound",
    });
  });
});

describe("ReferenceResolver - Complex expressions", () => {
  test("should resolve references in arithmetic expressions", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {
          width: { type: "Literal", valueType: "number", value: 100 },
          padding: { type: "Literal", valueType: "number", value: 20 },
        },
        children: [
          {
            type: "Block",
            id: "Child",
            properties: {
              width: {
                type: "Expression",
                tokens: [
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "parent" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "width" },
                  { type: TokenType.MINUS, value: "-" },
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "parent" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "padding" },
                  { type: TokenType.STAR, value: "*" },
                  { type: TokenType.NUMBER, value: 2 },
                  { type: TokenType.EOF, value: null },
                ],
                location: { line: 1, column: 1 },
              },
            },
            children: [],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast);

    const childNode = ast[0].children[0];
    assert.strictEqual(childNode.properties.width.type, "Literal");
    assert.strictEqual(childNode.properties.width.value, 60); // 100 - (20 * 2)
  });

  test("should resolve multiple different reference types in one expression", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {
          baseSize: { type: "Literal", valueType: "number", value: 100 },
        },
        children: [
          {
            type: "Block",
            id: "Sidebar",
            properties: {
              width: { type: "Literal", valueType: "number", value: 200 },
            },
            children: [],
          },
          {
            type: "Block",
            id: "Content",
            properties: {
              width: {
                type: "Expression",
                // $parent.baseSize + $Sidebar.width
                tokens: [
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "parent" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "baseSize" },
                  { type: TokenType.PLUS, value: "+" },
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "Sidebar" },
                  { type: TokenType.DOT, value: "." },
                  { type: TokenType.IDENTIFIER, value: "width" },
                  { type: TokenType.EOF, value: null },
                ],
                location: { line: 1, column: 1 },
              },
            },
            children: [],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);
    resolver.resolve(ast);

    const contentNode = ast[0].children[1];
    assert.strictEqual(contentNode.properties.width.type, "Literal");
    assert.strictEqual(contentNode.properties.width.value, 300); // 100 + 200
  });
});

describe("ReferenceResolver - Edge cases", () => {
  test("should throw error for incomplete reference (missing property)", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "Parent",
        properties: {},
        children: [
          {
            type: "Block",
            id: "Child",
            properties: {
              value: {
                type: "Expression",
                tokens: [
                  { type: TokenType.DOLLAR, value: "$" },
                  { type: TokenType.IDENTIFIER, value: "parent" },
                  { type: TokenType.EOF, value: null },
                ],
                location: { line: 1, column: 1 },
              },
            },
            children: [],
          },
        ],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);

    assert.throws(() => resolver.resolve(ast), {
      subtype: "IncompleteReference",
    });
  });

  test("should throw error for invalid reference name", () => {
    const transaction = new Transaction();
    const evaluator = new ExpressionEvaluator(transaction);

    const ast = [
      {
        type: "Block",
        id: "TestBlock",
        properties: {
          value: {
            type: "Expression",
            tokens: [
              { type: TokenType.DOLLAR, value: "$" },
              { type: TokenType.IDENTIFIER, value: "invalid" },
              { type: TokenType.EOF, value: null },
            ],
            location: { line: 1, column: 1 },
          },
        },
        children: [],
      },
    ];

    const builder = new BlockRegistryBuilder();
    const registry = builder.build(ast);
    builder.finalize();

    const resolver = new ReferenceResolver(registry, evaluator);

    assert.throws(() => resolver.resolve(ast), {
      subtype: "InvalidReference",
    });
  });
});
