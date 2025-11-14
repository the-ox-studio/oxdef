import { test, describe } from "node:test";
import assert from "node:assert";
import { tokenize } from "../src/lexer/tokenizer.js";
import { Parser } from "../src/parser/parser.js";
import { dedent } from "../src/preprocessor/whitespace.js";

describe("Free Text Blocks", () => {
  describe("Lexer", () => {
    test("should tokenize simple free text block", () => {
      const input = "```Hello, world!```";
      const tokens = tokenize(input);

      assert.strictEqual(tokens.length, 2); // FREE_TEXT_CONTENT + EOF
      assert.strictEqual(tokens[0].type, "FREE_TEXT_CONTENT");
      assert.strictEqual(tokens[0].value, "Hello, world!");
    });

    test("should tokenize empty free text block", () => {
      const input = "``````";
      const tokens = tokenize(input);

      assert.strictEqual(tokens[0].type, "FREE_TEXT_CONTENT");
      assert.strictEqual(tokens[0].value, "");
    });

    test("should tokenize free text with newlines", () => {
      const input = "```\nLine 1\nLine 2\n```";
      const tokens = tokenize(input);

      assert.strictEqual(tokens[0].type, "FREE_TEXT_CONTENT");
      assert.strictEqual(tokens[0].value, "\nLine 1\nLine 2\n");
    });

    test("should support four backticks for escaping", () => {
      const input = "````\nCode:\n```\ninner code\n```\n````";
      const tokens = tokenize(input);

      assert.strictEqual(tokens[0].type, "FREE_TEXT_CONTENT");
      assert.ok(tokens[0].value.includes("```"));
    });

    test("should throw error on unclosed free text block", () => {
      const input = "```Hello";

      assert.throws(() => tokenize(input), /Unterminated free text block/);
    });

    test("should throw error on less than 3 backticks", () => {
      const input = "``text``";

      assert.throws(
        () => tokenize(input),
        /free text blocks require at least 3 backticks/,
      );
    });
  });

  describe("Parser - Basic", () => {
    test("should parse free text as child of block", () => {
      const input = "[Document\n```Hello```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks.length, 1);
      assert.strictEqual(ast.blocks[0].children.length, 1);
      assert.strictEqual(ast.blocks[0].children[0].type, "FreeText");
      assert.strictEqual(ast.blocks[0].children[0].value, "Hello");
    });

    test("should parse multiple free text blocks (merged)", () => {
      const input = "[Document\n```First```\n```Second```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      // With merging enabled (default), should be merged
      assert.strictEqual(ast.blocks[0].children.length, 1);
      assert.strictEqual(ast.blocks[0].children[0].value, "First\n\nSecond");
    });

    test("should parse free text with tags", () => {
      const input = "[Document\n#markdown\n```# Heading```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const freeText = ast.blocks[0].children[0];
      assert.strictEqual(freeText.type, "FreeText");
      assert.strictEqual(freeText.tags.length, 1);
      assert.strictEqual(freeText.tags[0].name, "markdown");
      assert.strictEqual(freeText.value, "# Heading");
    });

    test("should parse free text with multiple tags", () => {
      const input = "[Document\n#markdown #highlight\n```code```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const freeText = ast.blocks[0].children[0];
      assert.strictEqual(freeText.tags.length, 2);
      assert.strictEqual(freeText.tags[0].name, "markdown");
      assert.strictEqual(freeText.tags[1].name, "highlight");
    });

    test("should parse empty free text block", () => {
      const input = "[Document\n``````\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children[0].value, "");
    });

    test("should parse mixed content", () => {
      const input = `[LoginForm
  \`\`\`Please login\`\`\`
  [Username]
  \`\`\`Enter password\`\`\`
  [Password]
]`;
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const children = ast.blocks[0].children;
      assert.strictEqual(children.length, 4);
      assert.strictEqual(children[0].type, "FreeText");
      assert.strictEqual(children[1].type, "Block");
      assert.strictEqual(children[2].type, "FreeText");
      assert.strictEqual(children[3].type, "Block");
    });
  });

  describe("Whitespace Processing", () => {
    test("should trim leading and trailing newlines", () => {
      const input = "\nHello\n";
      const result = dedent(input);
      assert.strictEqual(result, "Hello");
    });

    test("should remove common indentation", () => {
      const input = "\n  Line 1\n  Line 2\n";
      const result = dedent(input);
      assert.strictEqual(result, "Line 1\nLine 2");
    });

    test("should preserve relative indentation", () => {
      const input = "\n  Line 1\n    Line 2 (indented)\n  Line 3\n";
      const result = dedent(input);
      assert.strictEqual(result, "Line 1\n  Line 2 (indented)\nLine 3");
    });

    test("should handle empty lines", () => {
      const input = "\n  Line 1\n\n  Line 2\n";
      const result = dedent(input);
      assert.strictEqual(result, "Line 1\n\nLine 2");
    });

    test("should return empty string for empty input", () => {
      assert.strictEqual(dedent(""), "");
      assert.strictEqual(dedent("\n\n"), "");
      assert.strictEqual(dedent("   \n   \n"), "");
    });

    test("should handle tabs (convert to 4 spaces)", () => {
      const input = "\n\t\tLine 1\n\t\tLine 2\n";
      const result = dedent(input);
      assert.strictEqual(result, "Line 1\nLine 2");
    });

    test("should work with code indentation", () => {
      const input = '\n    def hello():\n        print("Hello")\n';
      const result = dedent(input);
      assert.strictEqual(result, 'def hello():\n    print("Hello")');
    });
  });

  describe("Block Merging", () => {
    test("should merge adjacent untagged free text blocks", () => {
      const input = "[Doc\n```First```\n```Second```\n```Third```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children.length, 1);
      assert.strictEqual(
        ast.blocks[0].children[0].value,
        "First\n\nSecond\n\nThird",
      );
    });

    test("should merge blocks with identical tags", () => {
      const input = "[Doc\n#markdown\n```First```\n#markdown\n```Second```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children.length, 1);
      assert.strictEqual(ast.blocks[0].children[0].value, "First\n\nSecond");
    });

    test("should not merge blocks with different tags", () => {
      const input = "[Doc\n#markdown\n```First```\n#html\n```Second```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children.length, 2);
      assert.strictEqual(ast.blocks[0].children[0].tags[0].name, "markdown");
      assert.strictEqual(ast.blocks[0].children[1].tags[0].name, "html");
    });

    test("should not merge when intervening content exists", () => {
      const input = "[Doc\n```First```\n[Block]\n```Second```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children.length, 3);
      assert.strictEqual(ast.blocks[0].children[0].type, "FreeText");
      assert.strictEqual(ast.blocks[0].children[1].type, "Block");
      assert.strictEqual(ast.blocks[0].children[2].type, "FreeText");
    });

    test("should respect mergeFreeText: false option", () => {
      const input = "[Doc\n```First```\n```Second```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens, "<input>", { mergeFreeText: false });
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children.length, 2);
      assert.strictEqual(ast.blocks[0].children[0].value, "First");
      assert.strictEqual(ast.blocks[0].children[1].value, "Second");
    });
  });

  describe("Edge Cases", () => {
    test("should handle free text with special characters", () => {
      const input = "[Doc\n```[Special] (chars) {array} <template>```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(
        ast.blocks[0].children[0].value,
        "[Special] (chars) {array} <template>",
      );
    });

    test("should handle free text with quotes", () => {
      const input = "[Doc\n```\"Double\" and 'Single' quotes```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(
        ast.blocks[0].children[0].value,
        "\"Double\" and 'Single' quotes",
      );
    });

    test("should handle unicode content", () => {
      const input = "[Doc\n```Hello 世界 🌍```\n]";
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();

      assert.strictEqual(ast.blocks[0].children[0].value, "Hello 世界 🌍");
    });
  });
});
