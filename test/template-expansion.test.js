import { test, describe } from "node:test";
import assert from "node:assert";
import { parse } from "../src/parser/parser.js";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";

describe("Template Expansion - <set>", () => {
  test("sets variable with literal value", () => {
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <set x = 42>
      [Block]
    `;

    const doc = parse(input);
    expander.expandTemplates(doc);

    assert.strictEqual(tx.getVariable("x"), 42);
  });

  test("sets variable with expression", () => {
    const tx = new Transaction();
    tx.setVariable("base", 10);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <set result = (base * 2 + 5)>
    `;

    const doc = parse(input);
    expander.expandTemplates(doc);

    assert.strictEqual(tx.getVariable("result"), 25);
  });

  test("set template produces no blocks", () => {
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <set x = 10>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 0);
  });

  test("sets multiple variables in sequence", () => {
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <set a = 1>
      <set b = 2>
      <set c = (a + b)>
    `;

    const doc = parse(input);
    expander.expandTemplates(doc);

    assert.strictEqual(tx.getVariable("a"), 1);
    assert.strictEqual(tx.getVariable("b"), 2);
    assert.strictEqual(tx.getVariable("c"), 3);
  });
});

describe("Template Expansion - <if>", () => {
  test("expands then block when condition is true", () => {
    const tx = new Transaction();
    tx.setVariable("enabled", true);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (enabled)>
        [ThenBlock]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "ThenBlock");
  });

  test("does not expand then block when condition is false", () => {
    const tx = new Transaction();
    tx.setVariable("enabled", false);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (enabled)>
        [ThenBlock]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 0);
  });

  test("expands else block when condition is false", () => {
    const tx = new Transaction();
    tx.setVariable("enabled", false);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (enabled)>
        [ThenBlock]
      <else>
        [ElseBlock]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "ElseBlock");
  });

  test("expands elseif block when condition matches", () => {
    const tx = new Transaction();
    tx.setVariable("mode", "medium");

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (mode == "low")>
        [LowBlock]
      <elseif (mode == "medium")>
        [MediumBlock]
      <elseif (mode == "high")>
        [HighBlock]
      <else>
        [DefaultBlock]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "MediumBlock");
  });

  test("evaluates first matching elseif only", () => {
    const tx = new Transaction();
    tx.setVariable("x", 10);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (x > 100)>
        [VeryHigh]
      <elseif (x > 5)>
        [High]
      <elseif (x > 0)>
        [Positive]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "High");
  });

  test("handles complex conditions", () => {
    const tx = new Transaction();
    tx.setVariable("age", 25);
    tx.setVariable("hasLicense", true);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (age >= 18 && hasLicense)>
        [CanDrive]
      <else>
        [CannotDrive]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "CanDrive");
  });

  test("expands multiple blocks in branch", () => {
    const tx = new Transaction();
    tx.setVariable("show", true);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (show)>
        [Block1]
        [Block2]
        [Block3]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
    assert.strictEqual(expanded[0].id, "Block1");
    assert.strictEqual(expanded[1].id, "Block2");
    assert.strictEqual(expanded[2].id, "Block3");
  });
});

describe("Template Expansion - <foreach>", () => {
  test("expands blocks for each item in array", () => {
    const tx = new Transaction();
    tx.setVariable("items", [1, 2, 3]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        [Item]
      </foreach>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
    assert.strictEqual(expanded[0].id, "Item");
    assert.strictEqual(expanded[1].id, "Item");
    assert.strictEqual(expanded[2].id, "Item");
  });

  test("makes item available as variable", () => {
    const tx = new Transaction();
    tx.setVariable("users", [
      { name: "Alice" },
      { name: "Bob" },
      { name: "Charlie" },
    ]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (user in users)>
        [User (name: (user.name))]
      </foreach>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
    assert.strictEqual(expanded[0].properties.name.value, "Alice");
    assert.strictEqual(expanded[1].properties.name.value, "Bob");
    assert.strictEqual(expanded[2].properties.name.value, "Charlie");
  });

  test("provides index variable when specified", () => {
    const tx = new Transaction();
    tx.setVariable("items", ["a", "b", "c"]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item, i in items)>
        [Item (index: (i), value: (item))]
      </foreach>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
    assert.strictEqual(expanded[0].properties.index.value, 0);
    assert.strictEqual(expanded[0].properties.value.value, "a");
    assert.strictEqual(expanded[1].properties.index.value, 1);
    assert.strictEqual(expanded[1].properties.value.value, "b");
    assert.strictEqual(expanded[2].properties.index.value, 2);
    assert.strictEqual(expanded[2].properties.value.value, "c");
  });

  test("handles empty array", () => {
    const tx = new Transaction();
    tx.setVariable("items", []);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        [Item]
      </foreach>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 0);
  });

  test("cleans up item variable after loop", () => {
    const tx = new Transaction();
    tx.setVariable("items", [1, 2, 3]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        [Block]
      </foreach>
    `;

    const doc = parse(input);
    expander.expandTemplates(doc);

    assert.strictEqual(tx.getVariable("item"), undefined);
  });

  test("restores previous item variable value", () => {
    const tx = new Transaction();
    tx.setVariable("item", "original");
    tx.setVariable("items", [1, 2, 3]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        [Block]
      </foreach>
    `;

    const doc = parse(input);
    expander.expandTemplates(doc);

    assert.strictEqual(tx.getVariable("item"), "original");
  });

  test("throws on non-array collection", () => {
    const tx = new Transaction();
    tx.setVariable("items", "not an array");

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        [Item]
      </foreach>
    `;

    const doc = parse(input);

    assert.throws(
      () => expander.expandTemplates(doc),
      /Foreach collection must be an array/,
    );
  });
});

describe("Template Expansion - <while>", () => {
  test("expands blocks while condition is true", () => {
    const tx = new Transaction();
    tx.setVariable("count", 0);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <while (count < 3)>
        <set count = (count + 1)>
        [Block]
      </while>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
    assert.strictEqual(tx.getVariable("count"), 3);
  });

  test("does not expand when condition is initially false", () => {
    const tx = new Transaction();
    tx.setVariable("count", 10);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <while (count < 3)>
        [Block]
      </while>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 0);
  });

  test("prevents infinite loops with max iterations", () => {
    const tx = new Transaction();
    tx.setVariable("x", 1);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <while (x > 0)>
        [Block]
      </while>
    `;

    const doc = parse(input);

    assert.throws(
      () => expander.expandTemplates(doc),
      /While loop exceeded maximum iterations/,
    );
  });

  test("handles complex loop with variable updates", () => {
    const tx = new Transaction();
    tx.setVariable("i", 0);
    tx.setVariable("sum", 0);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <while (i < 5)>
        <set sum = (sum + i)>
        <set i = (i + 1)>
        [Iteration]
      </while>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 5);
    assert.strictEqual(tx.getVariable("sum"), 10); // 0+1+2+3+4
    assert.strictEqual(tx.getVariable("i"), 5);
  });
});

describe("Template Expansion - Nested Templates", () => {
  test("handles nested if templates", () => {
    const tx = new Transaction();
    tx.setVariable("outer", true);
    tx.setVariable("inner", true);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (outer)>
        [Outer
          <if (inner)>
            [Inner]
          </if>
        ]
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "Outer");
    assert.strictEqual(expanded[0].children.length, 1);
    assert.strictEqual(expanded[0].children[0].id, "Inner");
  });

  test("handles foreach inside if", () => {
    const tx = new Transaction();
    tx.setVariable("show", true);
    tx.setVariable("items", [1, 2, 3]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (show)>
        <foreach (item in items)>
          [Item]
        </foreach>
      </if>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
  });

  test("handles if inside foreach", () => {
    const tx = new Transaction();
    tx.setVariable("items", [1, 2, 3, 4, 5]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        <if (item % 2 == 0)>
          [EvenItem]
        <else>
          [OddItem]
        </if>
      </foreach>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 5);
    assert.strictEqual(expanded[0].id, "OddItem"); // 1
    assert.strictEqual(expanded[1].id, "EvenItem"); // 2
    assert.strictEqual(expanded[2].id, "OddItem"); // 3
    assert.strictEqual(expanded[3].id, "EvenItem"); // 4
    assert.strictEqual(expanded[4].id, "OddItem"); // 5
  });

  test("handles set inside foreach", () => {
    const tx = new Transaction();
    tx.setVariable("items", [10, 20, 30]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <foreach (item in items)>
        <set doubled = (item * 2)>
        [Item (value: (doubled))]
      </foreach>
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 3);
    assert.strictEqual(expanded[0].properties.value.value, 20);
    assert.strictEqual(expanded[1].properties.value.value, 40);
    assert.strictEqual(expanded[2].properties.value.value, 60);
  });
});

describe("Template Expansion - Integration", () => {
  test("expands complex template combination", () => {
    const tx = new Transaction();
    tx.setVariable("darkMode", false);
    tx.setVariable("items", [
      { label: "Home", active: true },
      { label: "About", active: false },
    ]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <if (darkMode)>
        <set bgColor = "#222">
      <else>
        <set bgColor = "#fff">
      </if>

      [Container (background: (bgColor))
        <foreach (item in items)>
          <if (item.active)>
            [ActiveItem (label: (item.label))]
          <else>
            [InactiveItem (label: (item.label))]
          </if>
        </foreach>
      ]
    `;

    const doc = parse(input);
    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "Container");
    assert.strictEqual(expanded[0].properties.background.value, "#fff");
    assert.strictEqual(expanded[0].children.length, 2);
    assert.strictEqual(expanded[0].children[0].id, "ActiveItem");
    assert.strictEqual(expanded[0].children[0].properties.label.value, "Home");
    assert.strictEqual(expanded[0].children[1].id, "InactiveItem");
    assert.strictEqual(expanded[0].children[1].properties.label.value, "About");
  });
});
