import { PreprocessError } from "../errors/errors.js";
import { TokenType } from "../lexer/tokenizer.js";

/**
 * ExpressionEvaluator - evaluates expression AST nodes
 *
 * This is a simplified evaluator for Phase 9 template expansion.
 * Full expression resolution (references, two-pass) will be Phase 10.
 */
export class ExpressionEvaluator {
  constructor(transaction) {
    this.transaction = transaction;
  }

  /**
   * Evaluate an expression node or literal value
   * Returns the evaluated value
   */
  evaluate(node) {
    if (!node) {
      return undefined;
    }

    // Handle literal nodes
    if (node.type === "Literal") {
      return node.value;
    }

    // Handle array nodes
    if (node.type === "Array") {
      return node.elements.map((item) => this.evaluate(item));
    }

    // Handle expression nodes (token sequences)
    if (node.type === "Expression") {
      return this.evaluateTokens(node.tokens);
    }

    // Unknown node type
    throw new PreprocessError(
      `Cannot evaluate node of type '${node.type}'`,
      "InvalidNodeType",
      node.location,
    );
  }

  /**
   * Evaluate a sequence of tokens as an expression
   */
  evaluateTokens(tokens) {
    if (!tokens || tokens.length === 0) {
      return undefined;
    }

    // Parse and evaluate the expression
    return this.parseExpression(tokens, 0).value;
  }

  /**
   * Parse expression with operator precedence
   * Returns { value, nextIndex }
   */
  parseExpression(tokens, index) {
    return this.parseLogicalOr(tokens, index);
  }

  /**
   * Parse logical OR (||) - lowest precedence
   */
  parseLogicalOr(tokens, index) {
    let result = this.parseLogicalAnd(tokens, index);
    let left = result.value;
    index = result.nextIndex;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === TokenType.OR) {
        index++; // consume ||
        result = this.parseLogicalAnd(tokens, index);
        left = this.toBoolean(left) || this.toBoolean(result.value);
        index = result.nextIndex;
      } else {
        break;
      }
    }

    return { value: left, nextIndex: index };
  }

  /**
   * Parse logical AND (&&)
   */
  parseLogicalAnd(tokens, index) {
    let result = this.parseComparison(tokens, index);
    let left = result.value;
    index = result.nextIndex;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === TokenType.AND) {
        index++; // consume &&
        result = this.parseComparison(tokens, index);
        left = this.toBoolean(left) && this.toBoolean(result.value);
        index = result.nextIndex;
      } else {
        break;
      }
    }

    return { value: left, nextIndex: index };
  }

  /**
   * Parse comparison operators (==, !=, <, >, <=, >=)
   */
  parseComparison(tokens, index) {
    let result = this.parseAdditive(tokens, index);
    let left = result.value;
    index = result.nextIndex;

    if (index < tokens.length) {
      const token = tokens[index];
      if (
        token.type === TokenType.EQ ||
        token.type === TokenType.NEQ ||
        token.type === TokenType.LT ||
        token.type === TokenType.GT ||
        token.type === TokenType.LTE ||
        token.type === TokenType.GTE
      ) {
        const op = token.type;
        index++; // consume operator
        result = this.parseAdditive(tokens, index);
        const right = result.value;
        index = result.nextIndex;

        left = this.compareValues(left, right, op);
      }
    }

    return { value: left, nextIndex: index };
  }

  /**
   * Parse additive operators (+, -)
   */
  parseAdditive(tokens, index) {
    let result = this.parseMultiplicative(tokens, index);
    let left = result.value;
    index = result.nextIndex;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === TokenType.PLUS || token.type === TokenType.MINUS) {
        const op = token.type;
        index++; // consume operator
        result = this.parseMultiplicative(tokens, index);
        const right = result.value;
        index = result.nextIndex;

        if (op === TokenType.PLUS) {
          left = this.toNumber(left) + this.toNumber(right);
        } else {
          left = this.toNumber(left) - this.toNumber(right);
        }
      } else {
        break;
      }
    }

    return { value: left, nextIndex: index };
  }

  /**
   * Parse multiplicative operators (*, /, %)
   */
  parseMultiplicative(tokens, index) {
    let result = this.parseExponentiation(tokens, index);
    let left = result.value;
    index = result.nextIndex;

    while (index < tokens.length) {
      const token = tokens[index];
      if (
        token.type === TokenType.STAR ||
        token.type === TokenType.SLASH ||
        token.type === TokenType.PERCENT
      ) {
        const op = token.type;
        index++; // consume operator
        result = this.parseExponentiation(tokens, index);
        const right = result.value;
        index = result.nextIndex;

        if (op === TokenType.STAR) {
          left = this.toNumber(left) * this.toNumber(right);
        } else if (op === TokenType.SLASH) {
          left = this.toNumber(left) / this.toNumber(right);
        } else {
          left = this.toNumber(left) % this.toNumber(right);
        }
      } else {
        break;
      }
    }

    return { value: left, nextIndex: index };
  }

  /**
   * Parse exponentiation operator (**)
   */
  parseExponentiation(tokens, index) {
    let result = this.parseUnary(tokens, index);
    let left = result.value;
    index = result.nextIndex;

    if (index < tokens.length) {
      const token = tokens[index];
      if (token.type === TokenType.POWER) {
        index++; // consume **
        result = this.parseExponentiation(tokens, index); // right associative
        const right = result.value;
        index = result.nextIndex;
        left = Math.pow(this.toNumber(left), this.toNumber(right));
      }
    }

    return { value: left, nextIndex: index };
  }

  /**
   * Parse unary operators (!, -)
   */
  parseUnary(tokens, index) {
    const token = tokens[index];

    if (token.type === TokenType.NOT) {
      index++; // consume !
      const result = this.parseUnary(tokens, index);
      return {
        value: !this.toBoolean(result.value),
        nextIndex: result.nextIndex,
      };
    }

    if (token.type === TokenType.MINUS) {
      index++; // consume -
      const result = this.parseUnary(tokens, index);
      return {
        value: -this.toNumber(result.value),
        nextIndex: result.nextIndex,
      };
    }

    return this.parsePrimary(tokens, index);
  }

  /**
   * Parse primary expressions (literals, variables, member access)
   */
  parsePrimary(tokens, index) {
    const token = tokens[index];

    // Literals
    if (token.type === TokenType.NUMBER) {
      index++;
      return { value: token.value, nextIndex: index };
    }

    if (token.type === TokenType.STRING) {
      index++;
      return { value: token.value, nextIndex: index };
    }

    if (token.type === TokenType.BOOLEAN) {
      index++;
      return { value: token.value, nextIndex: index };
    }

    if (token.type === TokenType.NULL) {
      index++;
      return { value: null, nextIndex: index };
    }

    // Variable reference or member access
    if (token.type === TokenType.IDENTIFIER) {
      return this.parseReference(tokens, index);
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      index++; // consume (
      const result = this.parseExpression(tokens, index);
      index = result.nextIndex;
      if (index < tokens.length && tokens[index].type === TokenType.RPAREN) {
        index++; // consume )
      }
      return { value: result.value, nextIndex: index };
    }

    throw new PreprocessError(
      `Unexpected token in expression: ${token.type}`,
      "UnexpectedToken",
      null,
    );
  }

  /**
   * Parse variable reference with optional member access
   * Examples: foo, foo.bar, foo.bar.baz
   */
  parseReference(tokens, index) {
    let name = tokens[index].value;
    index++;

    // Get the base variable value
    let value = this.transaction.getVariable(name);

    if (value === undefined) {
      throw new PreprocessError(
        `Undefined variable: ${name}`,
        "UndefinedVariable",
        null,
      );
    }

    // Handle member access (foo.bar.baz)
    while (index < tokens.length && tokens[index].type === TokenType.DOT) {
      index++; // consume .
      if (
        index >= tokens.length ||
        tokens[index].type !== TokenType.IDENTIFIER
      ) {
        throw new PreprocessError(
          "Expected property name after '.'",
          "ExpectedPropertyName",
          null,
        );
      }

      const propName = tokens[index].value;
      index++;

      if (value === null || value === undefined) {
        throw new PreprocessError(
          `Cannot access property '${propName}' of ${value}`,
          "NullPropertyAccess",
          null,
        );
      }

      value = value[propName];
    }

    return { value, nextIndex: index };
  }

  /**
   * Compare two values with an operator
   */
  compareValues(left, right, op) {
    switch (op) {
      case TokenType.EQ:
        return left === right;
      case TokenType.NEQ:
        return left !== right;
      case TokenType.LT:
        return this.toNumber(left) < this.toNumber(right);
      case TokenType.GT:
        return this.toNumber(left) > this.toNumber(right);
      case TokenType.LTE:
        return this.toNumber(left) <= this.toNumber(right);
      case TokenType.GTE:
        return this.toNumber(left) >= this.toNumber(right);
      default:
        throw new PreprocessError(
          `Unknown comparison operator: ${op}`,
          "UnknownOperator",
          null,
        );
    }
  }

  /**
   * Convert value to boolean
   */
  toBoolean(value) {
    return !!value;
  }

  /**
   * Convert value to number
   */
  toNumber(value) {
    if (typeof value === "number") {
      return value;
    }
    const num = Number(value);
    if (isNaN(num)) {
      throw new PreprocessError(
        `Cannot convert '${value}' to number`,
        "InvalidNumberConversion",
        null,
      );
    }
    return num;
  }
}
