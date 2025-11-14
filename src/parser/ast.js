/**
 * AST Node types for OX language
 */

/**
 * Base AST Node
 */
export class ASTNode {
  constructor(type, location = null) {
    this.type = type;
    this.location = location;
  }
}

/**
 * Block node
 * Represents: [Identifier (properties) children...]
 */
export class BlockNode extends ASTNode {
  constructor(id, properties = {}, children = [], tags = [], location = null) {
    super("Block", location);
    this.id = id;
    this.properties = properties;
    this.children = children;
    this.tags = tags; // Array of TagNode
    this.injects = []; // Array of InjectNode for block-level injects
  }
}

/**
 * Tag node (@ or # prefix)
 * Represents: @tag or @tag(arg) or #tag or #tag(arg)
 */
export class TagNode extends ASTNode {
  constructor(type, name, argument = null, location = null) {
    super("Tag", location);
    this.tagType = type; // 'definition' (@) or 'instance' (#)
    this.name = name;
    this.argument = argument;
  }
}

/**
 * Property node
 * Represents key-value pairs in properties
 */
export class PropertyNode extends ASTNode {
  constructor(key, value, location = null) {
    super("Property", location);
    this.key = key;
    this.value = value; // Can be literal or ExpressionNode
  }
}

/**
 * Literal values
 */
export class LiteralNode extends ASTNode {
  constructor(valueType, value, location = null) {
    super("Literal", location);
    this.valueType = valueType; // 'string', 'number', 'boolean', 'null'
    this.value = value;
  }
}

/**
 * Array node
 * Represents: {item1, item2, item3}
 */
export class ArrayNode extends ASTNode {
  constructor(elements, location = null) {
    super("Array", location);
    this.elements = elements; // Array of LiteralNode or ExpressionNode
  }
}

/**
 * Expression node
 * Represents: (expression)
 */
export class ExpressionNode extends ASTNode {
  constructor(tokens, location = null) {
    super("Expression", location);
    this.tokens = tokens; // Raw tokens for later parsing
    this.resolved = false;
    this.value = null;
  }
}

/**
 * Template nodes
 */

/**
 * Variable declaration
 * Represents: <set name = value>
 */
export class SetNode extends ASTNode {
  constructor(name, value, location = null) {
    super("Set", location);
    this.name = name;
    this.value = value; // Can be literal or ExpressionNode
  }
}

/**
 * Conditional block
 * Represents: <if (condition)>...</if>
 */
export class IfNode extends ASTNode {
  constructor(
    condition,
    thenBlocks,
    elseIfBranches = [],
    elseBlocks = [],
    location = null,
  ) {
    super("If", location);
    this.condition = condition; // ExpressionNode
    this.thenBlocks = thenBlocks;
    this.elseIfBranches = elseIfBranches; // Array of {condition, blocks}
    this.elseBlocks = elseBlocks;
  }
}

/**
 * Foreach loop
 * Represents: <foreach (item in collection)>...</foreach>
 */
export class ForeachNode extends ASTNode {
  constructor(itemVar, indexVar, collection, body, location = null) {
    super("Foreach", location);
    this.itemVar = itemVar;
    this.indexVar = indexVar; // null if not specified
    this.collection = collection; // Variable name or expression
    this.body = body; // Array of blocks
  }
}

/**
 * While loop
 * Represents: <while (condition)>...</while>
 */
export class WhileNode extends ASTNode {
  constructor(condition, body, location = null) {
    super("While", location);
    this.condition = condition; // ExpressionNode
    this.body = body;
  }
}

/**
 * Data source block
 * Represents: <on-data sourceName>...<on-error>...</on-data>
 */
export class OnDataNode extends ASTNode {
  constructor(sourceName, dataBlocks, errorBlocks = [], location = null) {
    super("OnData", location);
    this.sourceName = sourceName;
    this.dataBlocks = dataBlocks;
    this.errorBlocks = errorBlocks;
  }
}

/**
 * Import statement
 * Represents: <import "path">
 */
export class ImportNode extends ASTNode {
  constructor(path, alias = null, location = null) {
    super("Import", location);
    this.path = path;
    this.alias = alias;
  }
}

/**
 * Inject statement
 * Represents: <inject "path">
 */
export class InjectNode extends ASTNode {
  constructor(path, location = null) {
    super("Inject", location);
    this.path = path;
  }
}

/**
 * Free text block
 * Represents: ```text content```
 */
export class FreeTextNode extends ASTNode {
  constructor(value, tags = [], location = null) {
    super("FreeText", location);
    this.value = value; // Processed text (after dedent)
    this.tags = tags; // Array of TagNode
  }
}

/**
 * Root document node
 */
export class DocumentNode extends ASTNode {
  constructor(blocks = [], location = null) {
    super("Document", location);
    this.blocks = blocks; // Top-level blocks
    this.imports = []; // ImportNode array
    this.injects = []; // InjectNode array
    this.templates = []; // Template nodes (Set, If, Foreach, etc.)
  }
}

/**
 * Helper functions to create AST nodes
 */

export function createBlock(
  id,
  properties = {},
  children = [],
  tags = [],
  location = null,
) {
  return new BlockNode(id, properties, children, tags, location);
}

export function createTag(type, name, argument = null, location = null) {
  return new TagNode(type, name, argument, location);
}

export function createProperty(key, value, location = null) {
  return new PropertyNode(key, value, location);
}

export function createLiteral(valueType, value, location = null) {
  return new LiteralNode(valueType, value, location);
}

export function createArray(elements, location = null) {
  return new ArrayNode(elements, location);
}

export function createExpression(tokens, location = null) {
  return new ExpressionNode(tokens, location);
}

export function createSet(name, value, location = null) {
  return new SetNode(name, value, location);
}

export function createIf(
  condition,
  thenBlocks,
  elseIfBranches = [],
  elseBlocks = [],
  location = null,
) {
  return new IfNode(
    condition,
    thenBlocks,
    elseIfBranches,
    elseBlocks,
    location,
  );
}

export function createForeach(
  itemVar,
  indexVar,
  collection,
  body,
  location = null,
) {
  return new ForeachNode(itemVar, indexVar, collection, body, location);
}

export function createWhile(condition, body, location = null) {
  return new WhileNode(condition, body, location);
}

export function createOnData(
  sourceName,
  dataBlocks,
  errorBlocks = [],
  location = null,
) {
  return new OnDataNode(sourceName, dataBlocks, errorBlocks, location);
}

export function createImport(path, alias = null, location = null) {
  return new ImportNode(path, alias, location);
}

export function createInject(path, location = null) {
  return new InjectNode(path, location);
}

export function createFreeText(value, tags = [], location = null) {
  return new FreeTextNode(value, tags, location);
}

export function createDocument(blocks = [], location = null) {
  return new DocumentNode(blocks, location);
}
