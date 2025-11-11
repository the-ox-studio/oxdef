import { test, describe } from "node:test";
import assert from "node:assert";
import { parse } from "../src/parser/parser.js";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";

describe("TemplateExpander - OnData", () => {
  test("expands on-data block with successful fetch", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "UserList");
  });

  test("expands on-error block with failed fetch", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => {
      throw new Error("Database connection failed");
    });

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      <on-error>
        [ErrorBlock]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "ErrorBlock");
  });

  test("makes data source result available as variable", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    // Before expansion, users variable doesn't exist
    assert.strictEqual(tx.getVariable("users"), undefined);

    expander.expandTemplates(doc);

    // After expansion, the variable should be cleaned up
    assert.strictEqual(tx.getVariable("users"), undefined);
  });

  test("makes error available as $error variable", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => {
      const error = new Error("Connection failed");
      error.code = "ECONNREFUSED";
      throw error;
    });

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      <on-error>
        [ErrorBlock]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    // Before expansion, $error doesn't exist
    assert.strictEqual(tx.getVariable("$error"), undefined);

    expander.expandTemplates(doc);

    // After expansion, $error should be cleaned up
    assert.strictEqual(tx.getVariable("$error"), undefined);
  });

  test("handles nested on-data blocks", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [{ id: 1, name: "Alice" }]);
    tx.addDataSource("posts", async () => [{ id: 1, title: "Hello" }]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserSection
          <on-data posts>
            [PostSection]
          </on-data>
        ]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    // Should have UserSection with PostSection as child
    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "UserSection");
    // PostSection should be in the children
    assert.ok(expanded[0].children.some((child) => child.id === "PostSection"));
  });

  test("handles multiple parallel on-data blocks", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [{ id: 1 }]);
    tx.addDataSource("posts", async () => [{ id: 1 }]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>

      <on-data posts>
        [PostList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 2);
    assert.strictEqual(expanded[0].id, "UserList");
    assert.strictEqual(expanded[1].id, "PostList");
  });

  test("handles mixed success and error blocks", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [{ id: 1 }]);
    tx.addDataSource("failing", async () => {
      throw new Error("Failed");
    });

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>

      <on-data failing>
        [FailList]
      <on-error>
        [ErrorBlock]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 2);
    assert.strictEqual(expanded[0].id, "UserList");
    assert.strictEqual(expanded[1].id, "ErrorBlock");
  });

  test("preserves block children when expanding", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [{ id: 1 }]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList
          [Child1]
          [Child2]
        ]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "UserList");
    assert.strictEqual(expanded[0].children.length, 2);
    assert.strictEqual(expanded[0].children[0].id, "Child1");
    assert.strictEqual(expanded[0].children[1].id, "Child2");
  });

  test("handles empty data source results", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    // Should still expand even with empty data
    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "UserList");
  });

  test("cleans up variables after expansion", async () => {
    const tx = new Transaction();
    tx.setVariable("users", "existing value");

    tx.addDataSource("users", async () => [{ id: 1 }]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    expander.expandTemplates(doc);

    // Should restore original value
    assert.strictEqual(tx.getVariable("users"), "existing value");
  });

  test("cleans up $error variable after expansion", async () => {
    const tx = new Transaction();
    tx.setVariable("$error", "existing error");

    tx.addDataSource("users", async () => {
      throw new Error("Failed");
    });

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      <on-error>
        [ErrorBlock]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    expander.expandTemplates(doc);

    // Should restore original $error value
    assert.strictEqual(tx.getVariable("$error"), "existing error");
  });

  test("handles on-data with no error block when fetch fails", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => {
      throw new Error("Failed");
    });

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    // Should return empty array when no error block provided
    assert.strictEqual(expanded.length, 0);
  });

  test("expands multiple levels of nesting", async () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => [{ id: 1 }]);
    tx.addDataSource("posts", async () => [{ id: 1 }]);
    tx.addDataSource("comments", async () => [{ id: 1 }]);

    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor);

    const input = `
      <on-data users>
        [Users
          <on-data posts>
            [Posts
              <on-data comments>
                [Comments]
              </on-data>
            ]
          </on-data>
        ]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const expanded = expander.expandTemplates(doc);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "Users");

    // Find Posts in children
    const posts = expanded[0].children.find((c) => c.id === "Posts");
    assert.ok(posts);

    // Find Comments in Posts children
    const comments = posts.children.find((c) => c.id === "Comments");
    assert.ok(comments);
  });
});
