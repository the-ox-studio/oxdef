import { ParseError, createLocation } from "../errors/errors.js";

/**
 * Token types for OX language
 */
export const TokenType = {
  // Literals
  IDENTIFIER: "IDENTIFIER",
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  NULL: "NULL",

  // Delimiters
  LBRACKET: "LBRACKET", // [
  RBRACKET: "RBRACKET", // ]
  LPAREN: "LPAREN", // (
  RPAREN: "RPAREN", // )
  LBRACE: "LBRACE", // {
  RBRACE: "RBRACE", // }

  // Operators
  COLON: "COLON", // :
  COMMA: "COMMA", // ,
  DOT: "DOT", // .
  DOLLAR: "DOLLAR", // $
  AT: "AT", // @
  HASH: "HASH", // #
  EQUALS: "EQUALS", // =

  // Arithmetic operators
  PLUS: "PLUS", // +
  MINUS: "MINUS", // -
  STAR: "STAR", // *
  SLASH: "SLASH", // /
  PERCENT: "PERCENT", // %
  POWER: "POWER", // **

  // Comparison operators
  EQ: "EQ", // ==
  NEQ: "NEQ", // !=
  GT: "GT", // >
  LT: "LT", // <
  GTE: "GTE", // >=
  LTE: "LTE", // <=

  // Logical operators
  AND: "AND", // &&
  OR: "OR", // ||
  NOT: "NOT", // !

  // Special
  NEWLINE: "NEWLINE",
  EOF: "EOF",
  COMMENT: "COMMENT",

  // Free text blocks
  BACKTICK: "BACKTICK", // ` (for counting backticks)
  FREE_TEXT_CONTENT: "FREE_TEXT_CONTENT",
};

/**
 * Token class
 */
export class Token {
  constructor(type, value, line, column, raw = null) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
    this.raw = raw || value;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.column})`;
  }
}

/**
 * Tokenizer/Lexer for OX language
 */
export class Tokenizer {
  constructor(input, filename = "<input>") {
    this.input = input;
    this.filename = filename;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  /**
   * Get current character
   */
  current() {
    return this.input[this.pos];
  }

  /**
   * Peek ahead n characters
   */
  peek(n = 1) {
    return this.input[this.pos + n];
  }

  /**
   * Advance position
   */
  advance() {
    const char = this.current();
    this.pos++;
    if (char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  /**
   * Check if at end of input
   */
  isAtEnd() {
    return this.pos >= this.input.length;
  }

  /**
   * Skip whitespace (except newlines)
   */
  skipWhitespace() {
    while (!this.isAtEnd()) {
      const char = this.current();
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
      } else {
        break;
      }
    }
  }

  /**
   * Skip single-line comment
   */
  skipLineComment() {
    // Skip '//'
    this.advance();
    this.advance();

    while (!this.isAtEnd() && this.current() !== "\n") {
      this.advance();
    }
  }

  /**
   * Skip multi-line comment
   */
  skipBlockComment() {
    // Skip '/*'
    this.advance();
    this.advance();

    while (!this.isAtEnd()) {
      if (this.current() === "*" && this.peek() === "/") {
        this.advance(); // *
        this.advance(); // /
        break;
      }
      this.advance();
    }
  }

  /**
   * Create error at current position
   */
  error(message) {
    const location = createLocation(this.filename, this.line, this.column);
    return new ParseError(message, location);
  }

  /**
   * Read identifier
   */
  readIdentifier() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = "";

    while (!this.isAtEnd()) {
      const char = this.current();
      if (/[a-zA-Z0-9_\-]/.test(char)) {
        value += char;
        this.advance();
      } else {
        break;
      }
    }

    // Check for boolean keywords
    if (value === "true" || value === "false") {
      return new Token(
        TokenType.BOOLEAN,
        value === "true",
        startLine,
        startColumn,
        value,
      );
    }

    // Check for null keyword
    if (value === "null") {
      return new Token(TokenType.NULL, null, startLine, startColumn, value);
    }

    return new Token(TokenType.IDENTIFIER, value, startLine, startColumn);
  }

  /**
   * Read number
   */
  readNumber() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = "";

    // Handle negative numbers
    if (this.current() === "-") {
      value += this.advance();
    }

    // Read digits before decimal
    while (!this.isAtEnd() && /[0-9]/.test(this.current())) {
      value += this.advance();
    }

    // Read decimal part
    if (
      !this.isAtEnd() &&
      this.current() === "." &&
      /[0-9]/.test(this.peek())
    ) {
      value += this.advance(); // .
      while (!this.isAtEnd() && /[0-9]/.test(this.current())) {
        value += this.advance();
      }
    }

    const numValue = parseFloat(value);
    return new Token(TokenType.NUMBER, numValue, startLine, startColumn, value);
  }

  /**
   * Read free text block (triple backticks or more)
   * Returns token with delimiter count and raw content
   */
  readFreeTextBlock() {
    const startLine = this.line;
    const startColumn = this.column;

    // Count opening backticks (but we need to check for immediate closing)
    let totalBackticks = 0;
    while (!this.isAtEnd() && this.current() === "`") {
      totalBackticks++;
      this.advance();
    }

    // Need at least 3 backticks total
    if (totalBackticks < 3) {
      throw this.error(
        `Free text blocks require at least 3 backticks, found ${totalBackticks}`,
      );
    }

    // For an even number of backticks with no content in between,
    // split them in half (opening and closing)
    let delimiterCount;

    // Special case: if we have exactly 6 or more EVEN backticks and the next
    // character is NOT a backtick, this is likely an empty block like ``````
    if (
      totalBackticks >= 6 &&
      totalBackticks % 2 === 0 &&
      (this.isAtEnd() || this.current() !== "`")
    ) {
      delimiterCount = totalBackticks / 2;
      // Rewind to the middle point
      this.pos -= delimiterCount;
      this.column -= delimiterCount;
    } else if (this.isAtEnd() || this.current() !== "`") {
      // Content follows (or EOF with odd/less than 6 backticks)
      delimiterCount = totalBackticks;
    } else {
      // More backticks follow - could be empty block or content with backticks
      // For even numbers, assume empty block
      if (totalBackticks % 2 === 0) {
        delimiterCount = totalBackticks / 2;
        // "Unread" the second half by moving position back
        this.pos -= delimiterCount;
        this.column -= delimiterCount;
      } else {
        // Odd number - use all as opening
        delimiterCount = totalBackticks;
      }
    }

    // Consume content until we find closing delimiter
    let content = "";
    let foundClosing = false;

    while (!this.isAtEnd()) {
      // Check for potential closing delimiter
      if (this.current() === "`") {
        // Count consecutive backticks
        const checkPos = this.pos;
        const checkLine = this.line;
        const checkColumn = this.column;
        let closingCount = 0;

        while (!this.isAtEnd() && this.current() === "`") {
          closingCount++;
          this.advance();
        }

        // If we found matching delimiter count, we're done
        if (closingCount === delimiterCount) {
          foundClosing = true;
          break;
        } else {
          // Not a match, add the backticks to content and continue
          content += "`".repeat(closingCount);
        }
      } else {
        content += this.advance();
      }
    }

    if (!foundClosing) {
      throw this.error(
        `Unterminated free text block starting at ${startLine}:${startColumn} (expected ${delimiterCount} backticks)`,
      );
    }

    return new Token(
      TokenType.FREE_TEXT_CONTENT,
      content,
      startLine,
      startColumn,
      "`".repeat(delimiterCount) + content + "`".repeat(delimiterCount),
    );
  }

  /**
   * Read string (quoted)
   */
  readString() {
    const startLine = this.line;
    const startColumn = this.column;
    const quote = this.advance(); // ' or "
    let value = "";
    let escaped = false;

    while (!this.isAtEnd()) {
      const char = this.current();

      if (escaped) {
        // Handle escape sequences
        switch (char) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          case "r":
            value += "\r";
            break;
          case "\\":
            value += "\\";
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += char;
        }
        escaped = false;
        this.advance();
      } else if (char === "\\") {
        escaped = true;
        this.advance();
      } else if (char === quote) {
        this.advance(); // Closing quote
        return new Token(
          TokenType.STRING,
          value,
          startLine,
          startColumn,
          quote + value + quote,
        );
      } else {
        value += char;
        this.advance();
      }
    }

    throw this.error(
      `Unterminated string starting at ${startLine}:${startColumn}`,
    );
  }

  /**
   * Read next token
   */
  nextToken() {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return new Token(TokenType.EOF, null, this.line, this.column);
    }

    const char = this.current();
    const line = this.line;
    const column = this.column;

    // Comments
    if (char === "/" && this.peek() === "/") {
      this.skipLineComment();
      return this.nextToken(); // Skip comment and get next token
    }

    if (char === "/" && this.peek() === "*") {
      this.skipBlockComment();
      return this.nextToken(); // Skip comment and get next token
    }

    // Free text blocks (triple backticks)
    if (char === "`") {
      // Check if it's triple backticks or more
      let backtickCount = 0;
      let tempPos = this.pos;
      while (tempPos < this.input.length && this.input[tempPos] === "`") {
        backtickCount++;
        tempPos++;
      }

      if (backtickCount >= 3) {
        return this.readFreeTextBlock();
      }
      // Single or double backtick - treat as unexpected character
      throw this.error(
        `Unexpected backtick character (free text blocks require at least 3 backticks)`,
      );
    }

    // Strings
    if (char === '"' || char === "'") {
      return this.readString();
    }

    // Numbers
    if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(this.peek()))) {
      return this.readNumber();
    }

    // Identifiers
    if (/[a-zA-Z_]/.test(char)) {
      return this.readIdentifier();
    }

    // Two-character operators
    if (char === "=" && this.peek() === "=") {
      this.advance();
      this.advance();
      return new Token(TokenType.EQ, "==", line, column);
    }

    if (char === "!" && this.peek() === "=") {
      this.advance();
      this.advance();
      return new Token(TokenType.NEQ, "!=", line, column);
    }

    if (char === ">" && this.peek() === "=") {
      this.advance();
      this.advance();
      return new Token(TokenType.GTE, ">=", line, column);
    }

    if (char === "<" && this.peek() === "=") {
      this.advance();
      this.advance();
      return new Token(TokenType.LTE, "<=", line, column);
    }

    if (char === "&" && this.peek() === "&") {
      this.advance();
      this.advance();
      return new Token(TokenType.AND, "&&", line, column);
    }

    if (char === "|" && this.peek() === "|") {
      this.advance();
      this.advance();
      return new Token(TokenType.OR, "||", line, column);
    }

    if (char === "*" && this.peek() === "*") {
      this.advance();
      this.advance();
      return new Token(TokenType.POWER, "**", line, column);
    }

    // Single-character tokens
    const singleChar = {
      "[": TokenType.LBRACKET,
      "]": TokenType.RBRACKET,
      "(": TokenType.LPAREN,
      ")": TokenType.RPAREN,
      "{": TokenType.LBRACE,
      "}": TokenType.RBRACE,
      "<": TokenType.LT,
      ">": TokenType.GT,
      ":": TokenType.COLON,
      ",": TokenType.COMMA,
      ".": TokenType.DOT,
      $: TokenType.DOLLAR,
      "@": TokenType.AT,
      "#": TokenType.HASH,
      "=": TokenType.EQUALS,
      "+": TokenType.PLUS,
      "-": TokenType.MINUS,
      "*": TokenType.STAR,
      "/": TokenType.SLASH,
      "%": TokenType.PERCENT,
      "!": TokenType.NOT,
      "\n": TokenType.NEWLINE,
    };

    if (char in singleChar) {
      this.advance();
      return new Token(singleChar[char], char, line, column);
    }

    throw this.error(`Unexpected character '${char}'`);
  }

  /**
   * Tokenize entire input
   */
  tokenize() {
    const tokens = [];

    while (!this.isAtEnd()) {
      const token = this.nextToken();

      // Skip newlines for now (we may need them later for some syntax)
      if (token.type !== TokenType.NEWLINE) {
        tokens.push(token);
      }

      if (token.type === TokenType.EOF) {
        break;
      }
    }

    // Ensure EOF token
    if (
      tokens.length === 0 ||
      tokens[tokens.length - 1].type !== TokenType.EOF
    ) {
      tokens.push(new Token(TokenType.EOF, null, this.line, this.column));
    }

    return tokens;
  }
}

/**
 * Convenience function to tokenize input
 */
export function tokenize(input, filename = "<input>") {
  const tokenizer = new Tokenizer(input, filename);
  return tokenizer.tokenize();
}
