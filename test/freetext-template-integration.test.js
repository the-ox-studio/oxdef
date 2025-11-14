import { test, describe } from "node:test";
import assert from "node:assert";
import { parse } from "../src/parser/parser.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";

describe("Free Text - Template Integration", () => {
  test("should preserve free text in foreach loop", () => {
    const input = `
      <set items = {1, 2, 3}>
      [Document
        <foreach (item in items)>
          [Item]
          \`\`\`Text content\`\`\`
        </foreach>
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    // Should have 3 Item blocks (one per iteration)
    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].children.length, 6); // 3 × (Item + FreeText)

    // Verify free text blocks are present
    const freeTextBlocks = expanded[0].children.filter(
      (c) => c.type === "FreeText",
    );
    assert.strictEqual(freeTextBlocks.length, 3);
    assert.strictEqual(freeTextBlocks[0].value, "Text content");
  });

  test("should preserve free text in while loop", () => {
    const input = `
      <set count = 0>
      [Document
        <while (count < 2)>
          \`\`\`Iteration\`\`\`
          <set count = (count + 1)>
        </while>
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    // Should have 2 free text blocks
    assert.strictEqual(expanded.length, 1);
    const freeTextBlocks = expanded[0].children.filter(
      (c) => c.type === "FreeText",
    );
    assert.strictEqual(freeTextBlocks.length, 2);
  });

  test("should preserve free text in if branches", () => {
    const input = `
      <set flag = true>
      [Document
        <if (flag)>
          \`\`\`Then branch\`\`\`
        <else>
          \`\`\`Else branch\`\`\`
        </if>
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].children.length, 1);
    assert.strictEqual(expanded[0].children[0].type, "FreeText");
    assert.strictEqual(expanded[0].children[0].value, "Then branch");
  });

  test("should handle mixed content (blocks + free text) in templates", () => {
    const input = `
      <set items = {1, 2}>
      [Document
        <foreach (item in items)>
          \`\`\`Header\`\`\`
          [Block]
          \`\`\`Footer\`\`\`
        </foreach>
      ]
    `;

    const ast = parse(input);
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);
    const expander = new TemplateExpander(transaction, dataSourceProcessor);

    const expanded = expander.expandTemplates(ast);

    assert.strictEqual(expanded.length, 1);
    // Should have 6 children: 2 iterations × 3 nodes each
    assert.strictEqual(expanded[0].children.length, 6);

    const types = expanded[0].children.map((c) => c.type);
    assert.deepStrictEqual(types, [
      "FreeText",
      "Block",
      "FreeText",
      "FreeText",
      "Block",
      "FreeText",
    ]);
  });
});
