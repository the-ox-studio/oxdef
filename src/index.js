// Main entry point for oxdefinition package

// Parser
export { Parser, parse, parseWithMacros } from "./parser/parser.js";

// AST
export {
  ASTNode,
  DocumentNode,
  BlockNode,
  TagNode,
  PropertyNode,
  LiteralNode,
  ArrayNode,
  ExpressionNode,
  FreeTextNode,
  SetNode,
  IfNode,
  ForeachNode,
  WhileNode,
  OnDataNode,
  ImportNode,
  InjectNode,
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
} from "./parser/ast.js";

// Tokenizer
export { TokenType, Token, Tokenizer, tokenize } from "./lexer/tokenizer.js";

// Errors
export {
  OXError,
  ParseError,
  PreprocessError,
  OXWarning,
  ErrorCollector,
  createLocation,
} from "./errors/errors.js";

// Walker
export {
  TreeWalker,
  MacroWalker,
  TraversalOrder,
  WalkerControl,
  walk,
  findNode,
  findAllNodes,
  findByTag,
  findByProperty,
  getAncestors,
} from "./walker/walker.js";

// Transaction
export { Transaction } from "./transaction/transaction.js";

// Preprocessor - Expressions
export { ExpressionEvaluator } from "./preprocessor/expressions.js";

// Preprocessor - References
export { ReferenceResolver } from "./preprocessor/references.js";

// Preprocessor - Tags
export { TagRegistry, TagProcessor } from "./preprocessor/tags.js";

// Preprocessor - Templates
export { TemplateExpander } from "./preprocessor/templates.js";

// Preprocessor - Macros
export { MacroSystem } from "./preprocessor/macros.js";

// Preprocessor - Data Sources
export { DataSourceProcessor } from "./preprocessor/datasources.js";

// Project
export { OXProject } from "./project/project.js";
