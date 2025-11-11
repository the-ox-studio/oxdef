import { test, describe } from "node:test";
import assert from "node:assert";
import { tokenize, TokenType } from "../src/lexer/tokenizer.js";

describe("Tokenizer", () => {
  test("tokenizes simple block", () => {
    const input = "[Container]";
    const tokens = tokenize(input);

    assert.strictEqual(tokens.length, 4); // Including EOF
    assert.strictEqual(tokens[0].type, TokenType.LBRACKET);
    assert.strictEqual(tokens[1].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[1].value, "Container");
    assert.strictEqual(tokens[2].type, TokenType.RBRACKET);
    assert.strictEqual(tokens[3].type, TokenType.EOF);
  });

  test("tokenizes block with properties", () => {
    const input = "[Box (width: 100, height: 50)]";
    const tokens = tokenize(input);

    assert.strictEqual(tokens[0].type, TokenType.LBRACKET);
    assert.strictEqual(tokens[1].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[1].value, "Box");
    assert.strictEqual(tokens[2].type, TokenType.LPAREN);
    assert.strictEqual(tokens[3].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[3].value, "width");
    assert.strictEqual(tokens[4].type, TokenType.COLON);
    assert.strictEqual(tokens[5].type, TokenType.NUMBER);
    assert.strictEqual(tokens[5].value, 100);
    assert.strictEqual(tokens[6].type, TokenType.COMMA);
  });

  test("tokenizes strings", () => {
    const tokens1 = tokenize('"hello world"');
    assert.strictEqual(tokens1[0].type, TokenType.STRING);
    assert.strictEqual(tokens1[0].value, "hello world");

    const tokens2 = tokenize("'single quotes'");
    assert.strictEqual(tokens2[0].type, TokenType.STRING);
    assert.strictEqual(tokens2[0].value, "single quotes");
  });

  test("tokenizes escape sequences in strings", () => {
    const tokens = tokenize('"line1\\nline2\\ttab"');
    assert.strictEqual(tokens[0].type, TokenType.STRING);
    assert.strictEqual(tokens[0].value, "line1\nline2\ttab");
  });

  test("tokenizes numbers", () => {
    const tokens1 = tokenize("123");
    assert.strictEqual(tokens1[0].type, TokenType.NUMBER);
    assert.strictEqual(tokens1[0].value, 123);

    const tokens2 = tokenize("45.67");
    assert.strictEqual(tokens2[0].type, TokenType.NUMBER);
    assert.strictEqual(tokens2[0].value, 45.67);

    const tokens3 = tokenize("-89.5");
    assert.strictEqual(tokens3[0].type, TokenType.NUMBER);
    assert.strictEqual(tokens3[0].value, -89.5);
  });

  test("tokenizes booleans", () => {
    const tokens1 = tokenize("true");
    assert.strictEqual(tokens1[0].type, TokenType.BOOLEAN);
    assert.strictEqual(tokens1[0].value, true);

    const tokens2 = tokenize("false");
    assert.strictEqual(tokens2[0].type, TokenType.BOOLEAN);
    assert.strictEqual(tokens2[0].value, false);
  });

  test("tokenizes null", () => {
    const tokens = tokenize("null");
    assert.strictEqual(tokens[0].type, TokenType.NULL);
    assert.strictEqual(tokens[0].value, null);
  });

  test("tokenizes arrays", () => {
    const input = "{1, 2, 3}";
    const tokens = tokenize(input);

    assert.strictEqual(tokens[0].type, TokenType.LBRACE);
    assert.strictEqual(tokens[1].type, TokenType.NUMBER);
    assert.strictEqual(tokens[2].type, TokenType.COMMA);
    assert.strictEqual(tokens[3].type, TokenType.NUMBER);
    assert.strictEqual(tokens[4].type, TokenType.COMMA);
    assert.strictEqual(tokens[5].type, TokenType.NUMBER);
    assert.strictEqual(tokens[6].type, TokenType.RBRACE);
  });

  test("tokenizes operators", () => {
    const input = "+ - * / % ** == != > < >= <= && || !";
    const tokens = tokenize(input);

    const expectedTypes = [
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.STAR,
      TokenType.SLASH,
      TokenType.PERCENT,
      TokenType.POWER,
      TokenType.EQ,
      TokenType.NEQ,
      TokenType.GT,
      TokenType.LT,
      TokenType.GTE,
      TokenType.LTE,
      TokenType.AND,
      TokenType.OR,
      TokenType.NOT,
      TokenType.EOF,
    ];

    assert.strictEqual(tokens.length, expectedTypes.length);
    tokens.forEach((token, i) => {
      assert.strictEqual(
        token.type,
        expectedTypes[i],
        `Token ${i} should be ${expectedTypes[i]}`,
      );
    });
  });

  test("tokenizes references", () => {
    const input = "$parent.width";
    const tokens = tokenize(input);

    assert.strictEqual(tokens[0].type, TokenType.DOLLAR);
    assert.strictEqual(tokens[1].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[1].value, "parent");
    assert.strictEqual(tokens[2].type, TokenType.DOT);
    assert.strictEqual(tokens[3].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[3].value, "width");
  });

  test("tokenizes tags", () => {
    const input1 = "@component";
    const tokens1 = tokenize(input1);
    assert.strictEqual(tokens1[0].type, TokenType.AT);
    assert.strictEqual(tokens1[1].type, TokenType.IDENTIFIER);

    const input2 = "#component(Button)";
    const tokens2 = tokenize(input2);
    assert.strictEqual(tokens2[0].type, TokenType.HASH);
    assert.strictEqual(tokens2[1].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens2[2].type, TokenType.LPAREN);
    assert.strictEqual(tokens2[3].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens2[4].type, TokenType.RPAREN);
  });

  test("tokenizes template markers", () => {
    const input = "<set name = value>";
    const tokens = tokenize(input);

    assert.strictEqual(tokens[0].type, TokenType.LT);
    assert.strictEqual(tokens[1].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[1].value, "set");
    assert.strictEqual(tokens[2].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[2].value, "name");
    assert.strictEqual(tokens[3].type, TokenType.EQUALS);
    assert.strictEqual(tokens[4].type, TokenType.IDENTIFIER);
    assert.strictEqual(tokens[4].value, "value");
    assert.strictEqual(tokens[5].type, TokenType.GT);
  });

  test("skips line comments", () => {
    const input = `
      [Container] // This is a comment
      [Child]
    `;
    const tokens = tokenize(input);

    // Should only have Container, Child tokens (no comment tokens)
    const identifiers = tokens.filter((t) => t.type === TokenType.IDENTIFIER);
    assert.strictEqual(identifiers.length, 2);
    assert.strictEqual(identifiers[0].value, "Container");
    assert.strictEqual(identifiers[1].value, "Child");
  });

  test("skips block comments", () => {
    const input = `
      [Container]
      /* This is a
         multi-line comment */
      [Child]
    `;
    const tokens = tokenize(input);

    const identifiers = tokens.filter((t) => t.type === TokenType.IDENTIFIER);
    assert.strictEqual(identifiers.length, 2);
    assert.strictEqual(identifiers[0].value, "Container");
    assert.strictEqual(identifiers[1].value, "Child");
  });

  test("tracks line and column numbers", () => {
    const input = `[Container
  [Child]]`;
    const tokens = tokenize(input);

    assert.strictEqual(tokens[0].line, 1); // [
    assert.strictEqual(tokens[0].column, 1);
    assert.strictEqual(tokens[1].line, 1); // Container
    assert.strictEqual(tokens[1].column, 2);
    assert.strictEqual(tokens[2].line, 2); // [
    assert.strictEqual(tokens[2].column, 3);
    assert.strictEqual(tokens[3].line, 2); // Child
    assert.strictEqual(tokens[3].column, 4);
  });

  test("throws error on unterminated string", () => {
    const input = '"unterminated';
    assert.throws(() => {
      tokenize(input);
    }, /Unterminated string/);
  });

  test("throws error on invalid character", () => {
    const input = "[Container ^]";
    assert.throws(() => {
      tokenize(input);
    }, /Unexpected character/);
  });

  test("tokenizes complex nested structure", () => {
    const input = `
      [Container (width: 100, padding: 20)
        [Header (height: 60)]
        [Content (y: ($parent.height - 60))]
      ]
    `;
    const tokens = tokenize(input);

    // Just verify it doesn't throw and produces tokens
    assert.ok(tokens.length > 0);
    assert.strictEqual(tokens[tokens.length - 1].type, TokenType.EOF);
  });
});
