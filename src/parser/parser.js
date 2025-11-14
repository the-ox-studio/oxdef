import { tokenize, TokenType } from "../lexer/tokenizer.js";
import { ParseError, createLocation } from "../errors/errors.js";
import {
  createDocument,
  createBlock,
  createTag,
  createProperty,
  createLiteral,
  createArray,
  createExpression,
  createSet,
  createIf,
  createForeach,
  createWhile,
  createOnData,
  createImport,
  createInject,
  createFreeText,
} from "./ast.js";
import { processFreeText } from "../preprocessor/whitespace.js";

/**
 * Recursive descent parser for OX language
 */
export class Parser {
  constructor(tokens, filename = "<input>", options = {}) {
    this.tokens = tokens;
    this.filename = filename;
    this.pos = 0;
    this.options = {
      mergeFreeText: true, // Default: merge adjacent free text blocks with identical tags
      ...options,
    };
  }

  /**
   * Get current token
   */
  current() {
    return this.tokens[this.pos];
  }

  /**
   * Peek ahead n tokens
   */
  peek(n = 1) {
    return this.tokens[this.pos + n];
  }

  /**
   * Check if at end
   */
  isAtEnd() {
    return this.current().type === TokenType.EOF;
  }

  /**
   * Advance to next token
   */
  advance() {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  /**
   * Check if current token matches type
   */
  check(type) {
    if (this.isAtEnd()) return false;
    return this.current().type === type;
  }

  /**
   * Match and consume token if type matches
   */
  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        return this.advance();
      }
    }
    return null;
  }

  /**
   * Expect token of specific type or throw error
   */
  expect(type, message) {
    if (this.check(type)) {
      return this.advance();
    }
    this.error(message || `Expected ${type} but got ${this.current().type}`);
  }

  /**
   * Create error at current position
   */
  error(message) {
    const token = this.current();
    const location = createLocation(this.filename, token.line, token.column);
    throw new ParseError(message, location);
  }

  /**
   * Get location from token
   */
  getLocation(token) {
    return createLocation(this.filename, token.line, token.column);
  }

  /**
   * Parse entire document
   */
  parse() {
    const doc = createDocument();

    while (!this.isAtEnd()) {
      // Check for templates, tags, or blocks
      if (this.check(TokenType.LT)) {
        const template = this.parseTemplate();
        if (template.type === "Import") {
          doc.imports.push(template);
        } else if (template.type === "Inject") {
          // Keep injects inline with blocks to preserve order
          doc.blocks.push(template);
        } else {
          doc.templates.push(template);
        }
      } else if (this.check(TokenType.AT) || this.check(TokenType.HASH)) {
        // Tags followed by block
        doc.blocks.push(this.parseBlock());
      } else if (this.check(TokenType.LBRACKET)) {
        doc.blocks.push(this.parseBlock());
      } else {
        this.error(`Unexpected token ${this.current().type}`);
      }
    }

    return doc;
  }

  /**
   * Parse a block: [Identifier (properties) children...]
   * Or with tags: @tag [Identifier...] or #tag [Identifier...]
   */
  parseBlock() {
    // Parse tags (@ or #) that come before the block
    const tags = [];
    while (this.check(TokenType.AT) || this.check(TokenType.HASH)) {
      tags.push(this.parseTag());
    }

    const startToken = this.expect(TokenType.LBRACKET);
    const location = this.getLocation(startToken);

    // Parse identifier (now optional - allows anonymous blocks)
    let id = null;
    if (this.check(TokenType.IDENTIFIER)) {
      const idToken = this.advance();
      id = idToken.value;
    }

    // Parse properties (optional)
    let properties = {};
    if (this.check(TokenType.LPAREN)) {
      properties = this.parseProperties();
    }

    // Parse children (until ])
    const children = [];
    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      if (this.check(TokenType.LBRACKET)) {
        children.push(this.parseBlock());
      } else if (this.check(TokenType.AT) || this.check(TokenType.HASH)) {
        // Check if tags are followed by free text or another block
        const tagsPeek = [];
        let peekPos = this.pos;

        // Collect all consecutive tags
        while (
          peekPos < this.tokens.length &&
          (this.tokens[peekPos].type === TokenType.AT ||
            this.tokens[peekPos].type === TokenType.HASH)
        ) {
          peekPos++;
          // Skip tag name
          if (
            peekPos < this.tokens.length &&
            this.tokens[peekPos].type === TokenType.IDENTIFIER
          ) {
            peekPos++;
          }
          // Skip optional argument
          if (
            peekPos < this.tokens.length &&
            this.tokens[peekPos].type === TokenType.LPAREN
          ) {
            peekPos++;
            if (
              peekPos < this.tokens.length &&
              this.tokens[peekPos].type === TokenType.IDENTIFIER
            ) {
              peekPos++;
            }
            if (
              peekPos < this.tokens.length &&
              this.tokens[peekPos].type === TokenType.RPAREN
            ) {
              peekPos++;
            }
          }
        }

        // Check what follows the tags
        if (
          peekPos < this.tokens.length &&
          this.tokens[peekPos].type === TokenType.FREE_TEXT_CONTENT
        ) {
          // Tags followed by free text
          children.push(this.parseFreeText());
        } else {
          // Tags followed by block
          children.push(this.parseBlock());
        }
      } else if (this.check(TokenType.FREE_TEXT_CONTENT)) {
        // Free text without tags
        children.push(this.parseFreeText());
      } else if (this.check(TokenType.LT)) {
        // Template inside block
        const template = this.parseTemplate();
        // Keep injects inline with children to preserve order
        children.push(template);
      } else {
        this.error(`Unexpected token ${this.current().type} in block body`);
      }
    }

    this.expect(TokenType.RBRACKET, "Expected ] to close block");

    // Merge adjacent free text blocks with identical tags (if enabled)
    const mergedChildren = this.mergeFreeTextBlocks(children);

    return createBlock(id, properties, mergedChildren, tags, location);
  }

  /**
   * Parse a tag: @identifier or @identifier(arg) or #identifier or #identifier(arg)
   */
  parseTag() {
    const tagTypeToken = this.match(TokenType.AT, TokenType.HASH);
    const tagType =
      tagTypeToken.type === TokenType.AT ? "definition" : "instance";
    const location = this.getLocation(tagTypeToken);

    const nameToken = this.expect(TokenType.IDENTIFIER, "Expected tag name");
    const name = nameToken.value;

    let argument = null;
    if (this.check(TokenType.LPAREN)) {
      this.advance(); // (
      const argToken = this.expect(
        TokenType.IDENTIFIER,
        "Expected tag argument",
      );
      argument = argToken.value;
      this.expect(TokenType.RPAREN, "Expected ) after tag argument");
    }

    return createTag(tagType, name, argument, location);
  }

  /**
   * Parse free text block: ```content```
   * Optionally preceded by tags: #tag ```content```
   */
  parseFreeText() {
    // Parse any tags that precede the free text
    const tags = [];
    while (this.check(TokenType.AT) || this.check(TokenType.HASH)) {
      tags.push(this.parseTag());
    }

    // Expect free text content
    const token = this.expect(
      TokenType.FREE_TEXT_CONTENT,
      "Expected free text content",
    );
    const location = this.getLocation(token);
    const rawText = token.value;

    // Process whitespace using dedent algorithm
    const processedText = processFreeText(rawText, tags);

    return createFreeText(processedText, tags, location);
  }

  /**
   * Helper method to parse a child element (block, free text, or template)
   * Used in parseBlock and template methods (if, foreach, etc.)
   */
  parseChild() {
    if (this.check(TokenType.LBRACKET)) {
      return this.parseBlock();
    } else if (this.check(TokenType.AT) || this.check(TokenType.HASH)) {
      // Check if tags are followed by free text or another block
      let peekPos = this.pos;

      // Collect all consecutive tags
      while (
        peekPos < this.tokens.length &&
        (this.tokens[peekPos].type === TokenType.AT ||
          this.tokens[peekPos].type === TokenType.HASH)
      ) {
        peekPos++;
        // Skip tag name
        if (
          peekPos < this.tokens.length &&
          this.tokens[peekPos].type === TokenType.IDENTIFIER
        ) {
          peekPos++;
        }
        // Skip optional argument
        if (
          peekPos < this.tokens.length &&
          this.tokens[peekPos].type === TokenType.LPAREN
        ) {
          peekPos++;
          if (
            peekPos < this.tokens.length &&
            this.tokens[peekPos].type === TokenType.IDENTIFIER
          ) {
            peekPos++;
          }
          if (
            peekPos < this.tokens.length &&
            this.tokens[peekPos].type === TokenType.RPAREN
          ) {
            peekPos++;
          }
        }
      }

      // Check what follows the tags
      if (
        peekPos < this.tokens.length &&
        this.tokens[peekPos].type === TokenType.FREE_TEXT_CONTENT
      ) {
        return this.parseFreeText();
      } else {
        return this.parseBlock();
      }
    } else if (this.check(TokenType.FREE_TEXT_CONTENT)) {
      return this.parseFreeText();
    } else if (this.check(TokenType.LT)) {
      return this.parseTemplate();
    } else {
      return null;
    }
  }

  /**
   * Merge adjacent free text blocks with identical tags
   * @param {Array} children - Array of child nodes
   * @returns {Array} - Array with merged free text blocks
   */
  mergeFreeTextBlocks(children) {
    // If merging is disabled, return children as-is
    if (!this.options.mergeFreeText) {
      return children;
    }

    const merged = [];
    let i = 0;

    while (i < children.length) {
      const current = children[i];

      // If not a free text node, just add it and continue
      if (current.type !== "FreeText") {
        merged.push(current);
        i++;
        continue;
      }

      // Start collecting adjacent free text blocks with identical tags
      const blocksToMerge = [current];
      let j = i + 1;

      while (j < children.length && children[j].type === "FreeText") {
        const next = children[j];

        // Check if tags are identical
        if (this.tagsAreEqual(current.tags, next.tags)) {
          blocksToMerge.push(next);
          j++;
        } else {
          break;
        }
      }

      // If we found multiple blocks to merge, merge them
      if (blocksToMerge.length > 1) {
        const mergedText = blocksToMerge
          .map((block) => block.value)
          .join("\n\n");
        const mergedNode = createFreeText(
          mergedText,
          current.tags,
          current.location,
        );
        merged.push(mergedNode);
      } else {
        // Just one block, add it as-is
        merged.push(current);
      }

      i = j;
    }

    return merged;
  }

  /**
   * Check if two tag arrays are equal
   * @param {Array} tags1 - First tag array
   * @param {Array} tags2 - Second tag array
   * @returns {boolean} - True if tags are equal
   */
  tagsAreEqual(tags1, tags2) {
    // Both empty or undefined - equal
    if ((!tags1 || tags1.length === 0) && (!tags2 || tags2.length === 0)) {
      return true;
    }

    // Different lengths - not equal
    if (!tags1 || !tags2 || tags1.length !== tags2.length) {
      return false;
    }

    // Compare each tag
    for (let i = 0; i < tags1.length; i++) {
      const tag1 = tags1[i];
      const tag2 = tags2[i];

      if (
        tag1.tagType !== tag2.tagType ||
        tag1.name !== tag2.name ||
        tag1.argument !== tag2.argument
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse properties: (key1: value1, key2: value2, ...)
   */
  parseProperties() {
    this.expect(TokenType.LPAREN);
    const properties = {};

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const keyToken = this.expect(
        TokenType.IDENTIFIER,
        "Expected property key",
      );
      const key = keyToken.value;

      this.expect(TokenType.COLON, "Expected : after property key");

      const value = this.parseValue();
      properties[key] = value;

      // Optional comma
      if (!this.check(TokenType.RPAREN)) {
        this.expect(TokenType.COMMA, "Expected , between properties");
      }
    }

    this.expect(TokenType.RPAREN);
    return properties;
  }

  /**
   * Parse a value (literal, array, or expression)
   */
  parseValue() {
    const token = this.current();
    const location = this.getLocation(token);

    // Expression: (...)
    if (this.check(TokenType.LPAREN)) {
      return this.parseExpression();
    }

    // Array: {...}
    if (this.check(TokenType.LBRACE)) {
      return this.parseArray();
    }

    // Literals
    if (this.check(TokenType.STRING)) {
      const t = this.advance();
      return createLiteral("string", t.value, location);
    }

    if (this.check(TokenType.NUMBER)) {
      const t = this.advance();
      return createLiteral("number", t.value, location);
    }

    if (this.check(TokenType.BOOLEAN)) {
      const t = this.advance();
      return createLiteral("boolean", t.value, location);
    }

    if (this.check(TokenType.NULL)) {
      this.advance();
      return createLiteral("null", null, location);
    }

    // Unquoted identifier as string
    if (this.check(TokenType.IDENTIFIER)) {
      const t = this.advance();
      return createLiteral("string", t.value, location);
    }

    this.error(`Unexpected value token: ${token.type}`);
  }

  /**
   * Parse expression: (tokens...)
   */
  parseExpression() {
    const startToken = this.expect(TokenType.LPAREN);
    const location = this.getLocation(startToken);
    const tokens = [];

    let depth = 1;
    while (depth > 0 && !this.isAtEnd()) {
      const token = this.current();

      if (token.type === TokenType.LPAREN) {
        depth++;
      } else if (token.type === TokenType.RPAREN) {
        depth--;
        if (depth === 0) break;
      }

      tokens.push(token);
      this.advance();
    }

    this.expect(TokenType.RPAREN, "Expected ) to close expression");

    return createExpression(tokens, location);
  }

  /**
   * Parse array: {item1, item2, ...}
   */
  parseArray() {
    const startToken = this.expect(TokenType.LBRACE);
    const location = this.getLocation(startToken);
    const elements = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      elements.push(this.parseValue());

      if (!this.check(TokenType.RBRACE)) {
        this.expect(TokenType.COMMA, "Expected , between array elements");
      }
    }

    this.expect(TokenType.RBRACE, "Expected } to close array");

    return createArray(elements, location);
  }

  /**
   * Parse template: <keyword ...>
   */
  parseTemplate() {
    this.expect(TokenType.LT);

    const keywordToken = this.expect(
      TokenType.IDENTIFIER,
      "Expected template keyword",
    );
    const keyword = keywordToken.value;
    const location = this.getLocation(keywordToken);

    switch (keyword) {
      case "set":
        return this.parseSet(location);
      case "if":
        return this.parseIf(location);
      case "foreach":
        return this.parseForeach(location);
      case "while":
        return this.parseWhile(location);
      case "on-data":
        return this.parseOnData(location);
      case "import":
        return this.parseImport(location);
      case "inject":
        return this.parseInject(location);
      default:
        this.error(`Unknown template keyword: ${keyword}`);
    }
  }

  /**
   * Parse <set name = value>
   */
  parseSet(location) {
    const nameToken = this.expect(
      TokenType.IDENTIFIER,
      "Expected variable name",
    );
    const name = nameToken.value;

    this.expect(TokenType.EQUALS, "Expected = in set statement");

    const value = this.parseValue();

    this.expect(TokenType.GT, "Expected > to close set statement");

    return createSet(name, value, location);
  }

  /**
   * Parse <if (condition)>...<elseif>...<else>...</if>
   */
  parseIf(location) {
    const condition = this.parseExpression();
    this.expect(TokenType.GT, "Expected > after if condition");

    // Parse then blocks
    const thenBlocks = [];
    while (!this.isAtEnd()) {
      // Check if we've hit a closing tag or else/elseif
      if (this.check(TokenType.LT)) {
        const peekKeyword = this.peek(1);
        if (peekKeyword && peekKeyword.type === TokenType.IDENTIFIER) {
          if (peekKeyword.value === "else" || peekKeyword.value === "elseif") {
            break;
          }
        }
        if (peekKeyword && peekKeyword.type === TokenType.SLASH) {
          break;
        }
      }

      const child = this.parseChild();
      if (child) {
        thenBlocks.push(child);
      } else {
        break;
      }
    }

    // Parse elseif/else branches
    const elseIfBranches = [];
    let elseBlocks = [];

    while (this.check(TokenType.LT)) {
      const peekKeyword = this.peek(1);
      if (peekKeyword && peekKeyword.type === TokenType.IDENTIFIER) {
        if (peekKeyword.value === "elseif") {
          this.advance(); // <
          this.advance(); // elseif
          const elseIfCondition = this.parseExpression();
          this.expect(TokenType.GT);

          const elseIfBody = [];
          while (!this.isAtEnd()) {
            // Check if we've hit a closing tag or else/elseif
            if (this.check(TokenType.LT)) {
              const peekKeyword = this.peek(1);
              if (peekKeyword && peekKeyword.type === TokenType.IDENTIFIER) {
                if (
                  peekKeyword.value === "else" ||
                  peekKeyword.value === "elseif"
                ) {
                  break;
                }
              }
              if (peekKeyword && peekKeyword.type === TokenType.SLASH) {
                break;
              }
            }

            const child = this.parseChild();
            if (child) {
              elseIfBody.push(child);
            } else {
              break;
            }
          }

          elseIfBranches.push({
            condition: elseIfCondition,
            blocks: elseIfBody,
          });
        } else if (peekKeyword.value === "else") {
          this.advance(); // <
          this.advance(); // else
          this.expect(TokenType.GT);

          while (!this.isAtEnd()) {
            // Check if we've hit the closing </if> tag
            if (this.check(TokenType.LT)) {
              const peekKeyword = this.peek(1);
              if (peekKeyword && peekKeyword.type === TokenType.SLASH) {
                break;
              }
            }

            const child = this.parseChild();
            if (child) {
              elseBlocks.push(child);
            } else {
              break;
            }
          }
          break; // else is always last
        } else if (
          peekKeyword.value === "if" &&
          this.peek(0).type === TokenType.SLASH
        ) {
          // </if>
          break;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Expect </if>
    this.expect(TokenType.LT);
    this.expect(TokenType.SLASH, "Expected / in closing if tag");
    const closeKeyword = this.expect(TokenType.IDENTIFIER);
    if (closeKeyword.value !== "if") {
      this.error(`Expected </if> but got </${closeKeyword.value}>`);
    }
    this.expect(TokenType.GT);

    return createIf(
      condition,
      thenBlocks,
      elseIfBranches,
      elseBlocks,
      location,
    );
  }

  /**
   * Parse <foreach (item in collection)>...</foreach>
   */
  parseForeach(location) {
    this.expect(TokenType.LPAREN);

    const itemToken = this.expect(
      TokenType.IDENTIFIER,
      "Expected item variable",
    );
    const itemVar = itemToken.value;

    let indexVar = null;
    if (this.check(TokenType.COMMA)) {
      this.advance(); // ,
      const indexToken = this.expect(
        TokenType.IDENTIFIER,
        "Expected index variable",
      );
      indexVar = indexToken.value;
    }

    const inToken = this.expect(TokenType.IDENTIFIER, 'Expected "in" keyword');
    if (inToken.value !== "in") {
      this.error('Expected "in" in foreach statement');
    }

    const collectionToken = this.expect(
      TokenType.IDENTIFIER,
      "Expected collection name",
    );
    const collection = collectionToken.value;

    this.expect(TokenType.RPAREN);
    this.expect(TokenType.GT);

    // Parse body
    const body = [];
    while (!this.isAtEnd()) {
      // Check if we've hit the closing tag
      if (this.check(TokenType.LT)) {
        const peekSlash = this.peek(1);
        if (peekSlash && peekSlash.type === TokenType.SLASH) {
          break; // Found </foreach>
        }
      }

      const child = this.parseChild();
      if (child) {
        body.push(child);
      } else {
        break;
      }
    }

    // Expect </foreach>
    this.expect(TokenType.LT);
    this.expect(TokenType.SLASH);
    const closeKeyword = this.expect(TokenType.IDENTIFIER);
    if (closeKeyword.value !== "foreach") {
      this.error(`Expected </foreach> but got </${closeKeyword.value}>`);
    }
    this.expect(TokenType.GT);

    return createForeach(itemVar, indexVar, collection, body, location);
  }

  /**
   * Parse <while (condition)>...</while>
   */
  parseWhile(location) {
    const condition = this.parseExpression();
    this.expect(TokenType.GT);

    const body = [];
    while (!this.isAtEnd()) {
      // Check if we've hit the closing tag
      if (this.check(TokenType.LT)) {
        const peekSlash = this.peek(1);
        if (peekSlash && peekSlash.type === TokenType.SLASH) {
          break; // Found </while>
        }
      }

      const child = this.parseChild();
      if (child) {
        body.push(child);
      } else {
        break;
      }
    }

    // Expect </while>
    this.expect(TokenType.LT);
    this.expect(TokenType.SLASH);
    const closeKeyword = this.expect(TokenType.IDENTIFIER);
    if (closeKeyword.value !== "while") {
      this.error(`Expected </while> but got </${closeKeyword.value}>`);
    }
    this.expect(TokenType.GT);

    return createWhile(condition, body, location);
  }

  /**
   * Parse <on-data sourceName>...<on-error>...</on-data>
   */
  parseOnData(location) {
    const sourceToken = this.expect(
      TokenType.IDENTIFIER,
      "Expected data source name",
    );
    const sourceName = sourceToken.value;

    this.expect(TokenType.GT);

    const dataBlocks = [];
    const errorBlocks = [];

    let inErrorBlock = false;

    while (!this.isAtEnd()) {
      if (this.check(TokenType.LT)) {
        const peekKeyword = this.peek(1);
        if (
          peekKeyword &&
          peekKeyword.type === TokenType.IDENTIFIER &&
          peekKeyword.value === "on-error"
        ) {
          this.advance(); // <
          this.advance(); // on-error
          this.expect(TokenType.GT);
          inErrorBlock = true;
          continue;
        } else if (peekKeyword && peekKeyword.type === TokenType.SLASH) {
          // Closing tag
          break;
        } else {
          // Template inside on-data
          const template = this.parseTemplate();
          if (inErrorBlock) {
            errorBlocks.push(template);
          } else {
            dataBlocks.push(template);
          }
        }
      } else if (this.check(TokenType.AT) || this.check(TokenType.HASH)) {
        const block = this.parseBlock();
        if (inErrorBlock) {
          errorBlocks.push(block);
        } else {
          dataBlocks.push(block);
        }
      } else if (this.check(TokenType.LBRACKET)) {
        const block = this.parseBlock();
        if (inErrorBlock) {
          errorBlocks.push(block);
        } else {
          dataBlocks.push(block);
        }
      } else {
        break;
      }
    }

    // Expect </on-data>
    this.expect(TokenType.LT);
    this.expect(TokenType.SLASH);
    const closeKeyword = this.expect(TokenType.IDENTIFIER);
    if (closeKeyword.value !== "on-data") {
      this.error(`Expected </on-data> but got </${closeKeyword.value}>`);
    }
    this.expect(TokenType.GT);

    return createOnData(sourceName, dataBlocks, errorBlocks, location);
  }

  /**
   * Parse <import "path"> or <import "path" as alias>
   */
  parseImport(location) {
    const pathToken = this.expect(TokenType.STRING, "Expected import path");
    const path = pathToken.value;

    let alias = null;
    if (this.check(TokenType.IDENTIFIER) && this.current().value === "as") {
      this.advance(); // as
      const aliasToken = this.expect(
        TokenType.IDENTIFIER,
        "Expected alias name",
      );
      alias = aliasToken.value;
    }

    this.expect(TokenType.GT);

    return createImport(path, alias, location);
  }

  /**
   * Parse <inject "path">
   */
  parseInject(location) {
    const pathToken = this.expect(TokenType.STRING, "Expected inject path");
    const path = pathToken.value;

    this.expect(TokenType.GT);

    return createInject(path, location);
  }
}

/**
 * Convenience function to parse OX code
 */
export function parse(input, filename = "<input>") {
  const tokens = tokenize(input, filename);
  const parser = new Parser(tokens, filename);
  return parser.parse();
}

/**
 * Parse with macro system support
 * @param {string} input - OX source code
 * @param {string} filename - Filename for error reporting
 * @param {Object} macroContext - Macro context from createMacroContext()
 * @returns {Object} Parsed AST (or early if finish() called)
 */
export function parseWithMacros(
  input,
  filename = "<input>",
  macroContext = null,
) {
  const tokens = tokenize(input, filename);
  const parser = new Parser(tokens, filename);
  const tree = parser.parse();

  // Execute onParse hook if provided
  if (macroContext && macroContext.init.onParse) {
    // Execute onParse callback (this sets tree internally via macros object)
    const shouldContinue = macroContext._executeOnParse(tree, parser);

    // If finish() was called, return current tree
    if (!shouldContinue) {
      return tree;
    }
  }

  return tree;
}
