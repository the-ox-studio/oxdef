import { test, describe } from "node:test";
import assert from "node:assert";
import { parse } from "../src/parser/parser.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";

describe("Two-Pass Integration - $parent references", () => {
  test("should resolve $parent.property in nested blocks", () => {
    const input = `
      [Container (width: 400, height: 300)
        [Header (width: ($parent.width), height: 50)]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    // Verify the Header has parent's width
    const container = expanded[0];
    const header = container.children[0];

    assert.strictEqual(header.id, "Header");
    assert.strictEqual(header.properties.width.type, "Literal");
    assert.strictEqual(header.properties.width.value, 400);
  });

  test("should resolve $parent.parent chaining", () => {
    const input = `
      [App (size: 500)
        [Container (padding: 10)
          [Content (width: ($parent.parent.size))]
        ]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const app = expanded[0];
    const container = app.children[0];
    const content = container.children[0];

    assert.strictEqual(content.properties.width.type, "Literal");
    assert.strictEqual(content.properties.width.value, 500);
  });

  test("should resolve $parent in arithmetic expressions", () => {
    const input = `
      [Container (width: 400, padding: 20)
        [Content (width: ($parent.width - $parent.padding * 2))]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const container = expanded[0];
    const content = container.children[0];

    assert.strictEqual(content.properties.width.type, "Literal");
    assert.strictEqual(content.properties.width.value, 360); // 400 - 20 * 2
  });
});

describe("Two-Pass Integration - $this references", () => {
  test("should resolve $this.property", () => {
    const input = `
      [Box (width: 100, doubled: ($this.width * 2))]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const box = expanded[0];
    assert.strictEqual(box.properties.doubled.type, "Literal");
    assert.strictEqual(box.properties.doubled.value, 200);
  });
});

describe("Two-Pass Integration - $BlockId references", () => {
  test("should resolve sibling block references", () => {
    const input = `
      [Layout
        [Sidebar (width: 250)]
        [Content (width: ($Sidebar.width + 100))]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const layout = expanded[0];
    const content = layout.children[1];

    assert.strictEqual(content.properties.width.type, "Literal");
    assert.strictEqual(content.properties.width.value, 350); // 250 + 100
  });

  test("should resolve forward references (sibling defined later)", () => {
    const input = `
      [Layout
        [Content (margin: ($Sidebar.width))]
        [Sidebar (width: 250)]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const layout = expanded[0];
    const content = layout.children[0];

    assert.strictEqual(content.properties.margin.type, "Literal");
    assert.strictEqual(content.properties.margin.value, 250);
  });
});

describe("Two-Pass Integration - Complex scenarios", () => {
  test("should handle mixed reference types in one expression", () => {
    const input = `
      [App (baseSize: 100)
        [Sidebar (width: 200)]
        [Content (width: ($parent.baseSize + $Sidebar.width))]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const app = expanded[0];
    const content = app.children[1];

    assert.strictEqual(content.properties.width.type, "Literal");
    assert.strictEqual(content.properties.width.value, 300); // 100 + 200
  });

  test("should handle references with conditional templates", () => {
    const input = `
      <set showBox = true>

      [Container (width: 500)
        <if (showBox)>
          [Box (width: ($parent.width))]
        </if>
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const container = expanded[0];
    const box = container.children[0];

    assert.strictEqual(box.id, "Box");
    assert.strictEqual(box.properties.width.type, "Literal");
    assert.strictEqual(box.properties.width.value, 500);
  });

  test("should resolve references without breaking non-reference expressions", () => {
    const input = `
      <set multiplier = 3>

      [Container (width: 400)
        [Box (
          value: (multiplier * 10),
          parentWidth: ($parent.width),
          total: ($parent.width + multiplier)
        )]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    const container = expanded[0];
    const box = container.children[0];

    // Non-reference expression should work
    assert.strictEqual(box.properties.value.type, "Literal");
    assert.strictEqual(box.properties.value.value, 30);

    // Reference expression should work
    assert.strictEqual(box.properties.parentWidth.type, "Literal");
    assert.strictEqual(box.properties.parentWidth.value, 400);

    // Mixed expression should work
    assert.strictEqual(box.properties.total.type, "Literal");
    assert.strictEqual(box.properties.total.value, 403);
  });
});

describe("Two-Pass Integration - Error handling", () => {
  test("should throw error for $parent on root block", () => {
    const input = `
      [Root (width: ($parent.size))]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    assert.throws(() => expander.expandTemplates(ast), {
      subtype: "NoParentBlock",
    });
  });

  test("should throw error for undefined sibling reference", () => {
    const input = `
      [Layout
        [Content (width: ($NonExistent.width))]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    assert.throws(() => expander.expandTemplates(ast), {
      subtype: "BlockNotFound",
    });
  });

  test("should throw error for undefined property reference", () => {
    const input = `
      [Container (width: 400)
        [Box (height: ($parent.nonExistent))]
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    assert.throws(() => expander.expandTemplates(ast), {
      subtype: "PropertyNotFound",
    });
  });
});
