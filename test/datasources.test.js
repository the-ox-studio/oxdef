import { test, describe } from "node:test";
import assert from "node:assert";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";
import { parse } from "../src/parser/parser.js";

describe("Transaction", () => {
  test("creates transaction with variables", () => {
    const tx = new Transaction({
      variables: {
        width: 100,
        height: 200,
      },
    });

    assert.strictEqual(tx.getVariable("width"), 100);
    assert.strictEqual(tx.getVariable("height"), 200);
  });

  test("creates transaction with functions", () => {
    const tx = new Transaction({
      functions: {
        add: (a, b) => a + b,
        multiply: (a, b) => a * b,
      },
    });

    assert.strictEqual(tx.hasFunction("add"), true);
    assert.strictEqual(tx.hasFunction("multiply"), true);

    const addFn = tx.getFunction("add");
    assert.strictEqual(addFn(2, 3), 5);
  });

  test("adds and retrieves data sources", () => {
    const tx = new Transaction();

    const mockDataSource = async () => ({ data: "test" });
    tx.addDataSource("users", mockDataSource);

    assert.strictEqual(tx.hasDataSource("users"), true);
  });

  test("supports data source wrappers with transaction access", () => {
    const tx = new Transaction({
      variables: {
        limit: 10,
      },
    });

    const wrapper = (transaction) => {
      const limit = transaction.getVariable("limit");
      return async () => {
        return { limit, data: "test" };
      };
    };

    tx.addDataSource("users", wrapper);
    assert.strictEqual(tx.hasDataSource("users"), true);
  });

  test("fetches data source successfully", async () => {
    const tx = new Transaction();

    tx.addDataSource("users", async () => {
      return [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
    });

    const result = await tx.fetchDataSource("users");
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "Alice");
  });

  test("caches data source results", async () => {
    const tx = new Transaction();

    let callCount = 0;
    tx.addDataSource("users", async () => {
      callCount++;
      return { data: "test" };
    });

    await tx.fetchDataSource("users");
    await tx.fetchDataSource("users");

    // Should only call once due to caching
    assert.strictEqual(callCount, 1);
  });

  test("handles data source timeout", async () => {
    const tx = new Transaction({
      config: { timeout: 100 },
    });

    tx.addDataSource("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { data: "test" };
    });

    try {
      await tx.fetchDataSource("slow");
      assert.fail("Should have thrown timeout error");
    } catch (error) {
      assert.ok(error.message.includes("timed out"));
      assert.strictEqual(error.source, "slow");
    }
  });

  test("captures data source errors", async () => {
    const tx = new Transaction();

    tx.addDataSource("failing", async () => {
      throw new Error("Database connection failed");
    });

    try {
      await tx.fetchDataSource("failing");
      assert.fail("Should have thrown");
    } catch (error) {
      assert.strictEqual(error.source, "failing");
      assert.strictEqual(error.message, "Database connection failed");
      assert.ok(error.timestamp);
    }

    // Error should be cached
    assert.strictEqual(tx.hasDataSourceError("failing"), true);
  });

  test("fetches multiple data sources in parallel", async () => {
    const tx = new Transaction();

    tx.addDataSource("users", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [{ id: 1 }];
    });

    tx.addDataSource("posts", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [{ id: 1 }];
    });

    const start = Date.now();
    const { results } = await tx.fetchDataSources(["users", "posts"]);
    const duration = Date.now() - start;

    // Should be parallel (< 30ms), not sequential (> 20ms)
    assert.ok(duration < 30);
    assert.ok(results.users);
    assert.ok(results.posts);
  });

  test("handles mixed success and failure in parallel fetch", async () => {
    const tx = new Transaction();

    tx.addDataSource("users", async () => [{ id: 1 }]);
    tx.addDataSource("failing", async () => {
      throw new Error("Failed");
    });

    const { results, errors } = await tx.fetchDataSources(["users", "failing"]);

    assert.ok(results.users);
    assert.ok(errors.failing);
    assert.strictEqual(errors.failing.message, "Failed");
  });

  test("clones transaction", () => {
    const tx = new Transaction({
      variables: { x: 10 },
      functions: { add: (a, b) => a + b },
    });

    const cloned = tx.clone();

    assert.strictEqual(cloned.getVariable("x"), 10);
    assert.strictEqual(cloned.hasFunction("add"), true);

    // Modifications should be independent
    cloned.setVariable("x", 20);
    assert.strictEqual(tx.getVariable("x"), 10);
    assert.strictEqual(cloned.getVariable("x"), 20);
  });

  test("clears data source cache", async () => {
    const tx = new Transaction();

    let callCount = 0;
    tx.addDataSource("users", async () => {
      callCount++;
      return { data: "test" };
    });

    await tx.fetchDataSource("users");
    assert.strictEqual(callCount, 1);

    tx.clearDataSourceCache();

    await tx.fetchDataSource("users");
    assert.strictEqual(callCount, 2); // Called again after cache clear
  });
});

describe("DataSourceProcessor", () => {
  test("detects simple data source in AST", () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    const sources = processor.detectDataSources(doc);

    assert.strictEqual(sources.length, 1);
    assert.strictEqual(sources[0].name, "users");
    assert.strictEqual(sources[0].isNested, false);
  });

  test("detects nested data sources", () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);
    tx.addDataSource("posts", async () => []);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
        <on-data posts>
          [PostList]
        </on-data>
      </on-data>
    `;

    const doc = parse(input);
    const sources = processor.detectDataSources(doc);

    assert.strictEqual(sources.length, 2);
    assert.strictEqual(sources[0].name, "users");
    assert.strictEqual(sources[0].isNested, false);
    assert.strictEqual(sources[1].name, "posts");
    assert.strictEqual(sources[1].isNested, true);
    assert.strictEqual(sources[1].parent, "users");
  });

  test("detects parallel data sources", () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);
    tx.addDataSource("posts", async () => []);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
      </on-data>

      <on-data posts>
        [PostList]
      </on-data>
    `;

    const doc = parse(input);
    const sources = processor.detectDataSources(doc);

    assert.strictEqual(sources.length, 2);
    assert.strictEqual(sources[0].isNested, false);
    assert.strictEqual(sources[1].isNested, false);
  });

  test("validates data sources exist in transaction", () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
      </on-data>

      <on-data missing>
        [MissingList]
      </on-data>
    `;

    const doc = parse(input);
    processor.detectDataSources(doc);

    assert.throws(() => {
      processor.validateDataSources();
    }, /Undefined data sources: missing/);
  });

  test("creates execution plan for parallel sources", () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);
    tx.addDataSource("posts", async () => []);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
      </on-data>

      <on-data posts>
        [PostList]
      </on-data>
    `;

    const doc = parse(input);
    const sources = processor.detectDataSources(doc);
    const plan = processor.getExecutionPlan(sources);

    assert.strictEqual(plan.length, 1); // One level
    assert.strictEqual(plan[0].level, 0);
    assert.strictEqual(plan[0].sources.length, 2);
    assert.strictEqual(plan[0].isParallel, true);
  });

  test("creates execution plan for nested sources", () => {
    const tx = new Transaction();
    tx.addDataSource("users", async () => []);
    tx.addDataSource("posts", async () => []);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
        <on-data posts>
          [PostList]
        </on-data>
      </on-data>
    `;

    const doc = parse(input);
    const sources = processor.detectDataSources(doc);
    const plan = processor.getExecutionPlan(sources);

    assert.strictEqual(plan.length, 2); // Two levels
    assert.strictEqual(plan[0].level, 0);
    assert.strictEqual(plan[0].sources[0], "users");
    assert.strictEqual(plan[1].level, 1);
    assert.strictEqual(plan[1].sources[0], "posts");
  });

  test("executes data sources according to plan", async () => {
    const tx = new Transaction();

    const executionOrder = [];

    tx.addDataSource("users", async () => {
      executionOrder.push("users");
      return [{ id: 1 }];
    });

    tx.addDataSource("posts", async () => {
      executionOrder.push("posts");
      return [{ id: 1 }];
    });

    const processor = new DataSourceProcessor(tx);

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

    // Both should be executed (order doesn't matter for parallel)
    assert.strictEqual(executionOrder.length, 2);
    assert.ok(executionOrder.includes("users"));
    assert.ok(executionOrder.includes("posts"));
  });

  test("executes nested data sources in order", async () => {
    const tx = new Transaction();

    const executionOrder = [];

    tx.addDataSource("users", async () => {
      executionOrder.push("users");
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [{ id: 1 }];
    });

    tx.addDataSource("posts", async () => {
      executionOrder.push("posts");
      return [{ id: 1 }];
    });

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
        <on-data posts>
          [PostList]
        </on-data>
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    // Should execute in order: users first, then posts
    assert.deepStrictEqual(executionOrder, ["users", "posts"]);
  });

  test("tracks successful and failed data sources", async () => {
    const tx = new Transaction();

    tx.addDataSource("users", async () => [{ id: 1 }]);
    tx.addDataSource("failing", async () => {
      throw new Error("Failed");
    });

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
      </on-data>

      <on-data failing>
        [FailList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    assert.strictEqual(processor.isDataSourceSuccessful("users"), true);
    assert.strictEqual(processor.isDataSourceFailed("failing"), true);
  });

  test("retrieves data source results", async () => {
    const tx = new Transaction();

    tx.addDataSource("users", async () => [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const data = processor.getDataSourceData("users");
    assert.strictEqual(data.length, 2);
    assert.strictEqual(data[0].name, "Alice");
  });

  test("retrieves data source errors", async () => {
    const tx = new Transaction();

    tx.addDataSource("failing", async () => {
      const error = new Error("Connection failed");
      error.code = "ECONNREFUSED";
      throw error;
    });

    const processor = new DataSourceProcessor(tx);

    const input = `
      <on-data failing>
        [FailList]
      </on-data>
    `;

    const doc = parse(input);
    await processor.executeDataSources(doc);

    const error = processor.getDataSourceError("failing");
    assert.strictEqual(error.message, "Connection failed");
    assert.strictEqual(error.code, "ECONNREFUSED");
    assert.strictEqual(error.source, "failing");
    assert.ok(error.timestamp);
  });
});
