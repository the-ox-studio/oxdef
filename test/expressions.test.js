import { test, describe } from "node:test";
import assert from "node:assert";
import { Transaction } from "../src/transaction/transaction.js";
import { ExpressionEvaluator } from "../src/preprocessor/expressions.js";
import { createLiteral, createExpression } from "../src/parser/ast.js";
import { tokenize } from "../src/lexer/tokenizer.js";

describe("ExpressionEvaluator - Literals", () => {
  test("evaluates number literals", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const node = createLiteral("number", 42);
    assert.strictEqual(evaluator.evaluate(node), 42);
  });

  test("evaluates string literals", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const node = createLiteral("string", "hello");
    assert.strictEqual(evaluator.evaluate(node), "hello");
  });

  test("evaluates boolean literals", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueNode = createLiteral("boolean", true);
    const falseNode = createLiteral("boolean", false);

    assert.strictEqual(evaluator.evaluate(trueNode), true);
    assert.strictEqual(evaluator.evaluate(falseNode), false);
  });

  test("evaluates null literal", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const node = createLiteral("null", null);
    assert.strictEqual(evaluator.evaluate(node), null);
  });
});

describe("ExpressionEvaluator - Variables", () => {
  test("evaluates simple variable reference", () => {
    const tx = new Transaction();
    tx.setVariable("x", 42);

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("x");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 42);
  });

  test("evaluates member access", () => {
    const tx = new Transaction();
    tx.setVariable("user", { name: "Alice", age: 30 });

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("user.name");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), "Alice");
  });

  test("evaluates nested member access", () => {
    const tx = new Transaction();
    tx.setVariable("data", {
      user: { profile: { name: "Bob" } },
    });

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("data.user.profile.name");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), "Bob");
  });

  test("throws on undefined variable", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("undefined_var");
    const node = createExpression(tokens);

    assert.throws(
      () => evaluator.evaluate(node),
      /Undefined variable: undefined_var/,
    );
  });

  test("throws on null property access", () => {
    const tx = new Transaction();
    tx.setVariable("user", null);

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("user.name");
    const node = createExpression(tokens);

    assert.throws(
      () => evaluator.evaluate(node),
      /Cannot access property 'name' of null/,
    );
  });
});

describe("ExpressionEvaluator - Arithmetic", () => {
  test("evaluates addition", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("5 + 3");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 8);
  });

  test("evaluates subtraction", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("10 - 4");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 6);
  });

  test("evaluates multiplication", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("6 * 7");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 42);
  });

  test("evaluates division", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("20 / 4");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 5);
  });

  test("evaluates modulo", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("17 % 5");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 2);
  });

  test("evaluates exponentiation", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("2 ** 8");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 256);
  });

  test("respects operator precedence", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("2 + 3 * 4");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 14); // not 20
  });

  test("handles parentheses", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("(2 + 3) * 4");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 20);
  });

  test("evaluates unary minus", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("-5");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), -5);
  });

  test("evaluates complex expression", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("10 + 2 * 3 - 4 / 2");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 14); // 10 + 6 - 2
  });
});

describe("ExpressionEvaluator - Comparison", () => {
  test("evaluates equality", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr = tokenize("5 == 5");
    const falseExpr = tokenize("5 == 6");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates inequality", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr = tokenize("5 != 6");
    const falseExpr = tokenize("5 != 5");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates less than", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr = tokenize("3 < 5");
    const falseExpr = tokenize("5 < 3");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates greater than", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr = tokenize("5 > 3");
    const falseExpr = tokenize("3 > 5");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates less than or equal", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr1 = tokenize("3 <= 5");
    const trueExpr2 = tokenize("5 <= 5");
    const falseExpr = tokenize("6 <= 5");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr1)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr2)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates greater than or equal", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr1 = tokenize("5 >= 3");
    const trueExpr2 = tokenize("5 >= 5");
    const falseExpr = tokenize("3 >= 5");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr1)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr2)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });
});

describe("ExpressionEvaluator - Logical", () => {
  test("evaluates logical AND", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr = tokenize("true && true");
    const falseExpr1 = tokenize("true && false");
    const falseExpr2 = tokenize("false && true");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr1)), false);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr2)), false);
  });

  test("evaluates logical OR", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr1 = tokenize("true || false");
    const trueExpr2 = tokenize("false || true");
    const falseExpr = tokenize("false || false");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr1)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr2)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates logical NOT", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const trueExpr = tokenize("!false");
    const falseExpr = tokenize("!true");

    assert.strictEqual(evaluator.evaluate(createExpression(trueExpr)), true);
    assert.strictEqual(evaluator.evaluate(createExpression(falseExpr)), false);
  });

  test("evaluates complex logical expression", () => {
    const tx = new Transaction();
    const evaluator = new ExpressionEvaluator(tx);

    const tokens = tokenize("(true && false) || (true && true)");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), true);
  });
});

describe("ExpressionEvaluator - Mixed Expressions", () => {
  test("evaluates expression with variables", () => {
    const tx = new Transaction();
    tx.setVariable("x", 10);
    tx.setVariable("y", 5);

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("x + y * 2");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), 20); // 10 + (5 * 2)
  });

  test("evaluates comparison with variables", () => {
    const tx = new Transaction();
    tx.setVariable("age", 25);

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("age >= 18");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), true);
  });

  test("evaluates complex condition", () => {
    const tx = new Transaction();
    tx.setVariable("isAdmin", true);
    tx.setVariable("age", 30);

    const evaluator = new ExpressionEvaluator(tx);
    const tokens = tokenize("isAdmin && age >= 18");
    const node = createExpression(tokens);

    assert.strictEqual(evaluator.evaluate(node), true);
  });
});
