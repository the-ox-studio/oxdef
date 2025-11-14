import { PreprocessError } from "../errors/errors.js";

/**
 * BlockRegistry - Stores block metadata for reference resolution
 *
 * Pass 1 builds this registry by traversing the expanded AST.
 * Pass 2 uses it to resolve $parent, $this, and $BlockId references.
 *
 * Supports both named and anonymous blocks:
 * - Named blocks: accessible by ID ($BlockId)
 * - Anonymous blocks: accessible by index ($parent.children[0])
 */
export class BlockRegistry {
  constructor() {
    this.blocks = new Map(); // blockNode → context
    this.blocksByParent = new Map(); // parentNode → [children]
  }

  /**
   * Register a block with its context
   */
  register(blockNode, parent = null, index = null) {
    const context = {
      node: blockNode,
      parent: parent,
      index: index, // Position in parent's children array
      children: [],
      siblings: [],
      properties: {},
    };

    this.blocks.set(blockNode, context);

    // Track parent-child relationships
    if (parent) {
      if (!this.blocksByParent.has(parent)) {
        this.blocksByParent.set(parent, []);
      }
      this.blocksByParent.get(parent).push(blockNode);
    }

    return context;
  }

  /**
   * Get context for a block
   */
  getContext(blockNode) {
    return this.blocks.get(blockNode);
  }

  /**
   * Build siblings list after all blocks are registered
   */
  buildSiblings() {
    for (const [parent, children] of this.blocksByParent.entries()) {
      // For each child, set siblings to all other children
      for (const child of children) {
        const context = this.blocks.get(child);
        if (context) {
          context.siblings = children.filter((c) => c !== child);
        }
      }
    }
  }

  /**
   * Find a sibling block by ID or index
   * @param {Object} blockNode - The block to find siblings of
   * @param {string|number} idOrIndex - Block ID (string) or index (number)
   * @returns {Object|null} The sibling block node or null
   */
  findSibling(blockNode, idOrIndex) {
    const context = this.getContext(blockNode);
    if (!context) {
      return null;
    }

    // Index-based lookup
    if (typeof idOrIndex === "number") {
      const siblings = this.blocksByParent.get(context.parent) || [];
      return siblings[idOrIndex] || null;
    }

    // ID-based lookup (named blocks only)
    const sibling = context.siblings.find(
      (sibling) => sibling.id === idOrIndex,
    );
    return sibling || null;
  }

  /**
   * Get parent block
   */
  getParent(blockNode) {
    const context = this.getContext(blockNode);
    return context ? context.parent : null;
  }

  /**
   * Get children array for a block
   * Returns array of child block nodes
   */
  getChildren(blockNode) {
    return this.blocksByParent.get(blockNode) || [];
  }
}

/**
 * BlockRegistryBuilder - Pass 1: Build the block registry
 */
export class BlockRegistryBuilder {
  constructor() {
    this.registry = new BlockRegistry();
  }

  /**
   * Build registry from expanded AST
   */
  build(nodes, parent = null) {
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    }

    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (node.type === "Block") {
        // Register this block with its index position
        const context = this.registry.register(node, parent, index);

        // Store evaluated properties (only literals)
        if (node.properties) {
          for (const [key, valueNode] of Object.entries(node.properties)) {
            if (valueNode && valueNode.type === "Literal") {
              context.properties[key] = valueNode.value;
            }
            // Skip Expression nodes - they'll be resolved in Pass 2
          }
        }

        // Recursively build for children
        if (node.children && node.children.length > 0) {
          this.build(node.children, node);
        }
      }
    }

    return this.registry;
  }

  /**
   * Complete the registry by building sibling relationships
   */
  finalize() {
    this.registry.buildSiblings();
    return this.registry;
  }
}

/**
 * ReferenceResolver - Pass 2: Resolve $parent, $this, $BlockId references
 */
export class ReferenceResolver {
  constructor(registry, expressionEvaluator) {
    this.registry = registry;
    this.expressionEvaluator = expressionEvaluator;
  }

  /**
   * Resolve references in the AST
   * This mutates the AST, replacing Expression nodes with Literal nodes
   */
  resolve(nodes) {
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    }

    for (const node of nodes) {
      if (node.type === "Block") {
        this.resolveBlockReferences(node);

        // Recursively resolve children
        if (node.children && node.children.length > 0) {
          this.resolve(node.children);
        }
      }
    }
  }

  /**
   * Resolve references in a block's properties
   */
  resolveBlockReferences(blockNode) {
    if (!blockNode.properties) {
      return;
    }

    for (const [key, valueNode] of Object.entries(blockNode.properties)) {
      if (valueNode && valueNode.type === "Expression") {
        try {
          // Evaluate expression with reference context
          const value = this.evaluateWithReferences(valueNode, blockNode);

          // Replace Expression with Literal
          blockNode.properties[key] = {
            type: "Literal",
            valueType: this.getValueType(value),
            value: value,
            location: valueNode.location,
          };
        } catch (error) {
          // Re-throw with better context
          throw new PreprocessError(
            `Failed to resolve reference in ${blockNode.id}.${key}: ${error.message}`,
            error.subtype || "ReferenceResolutionError",
            valueNode.location,
          );
        }
      }
    }
  }

  /**
   * Evaluate an expression with reference resolution
   */
  evaluateWithReferences(expressionNode, contextBlock) {
    // Create a reference-aware evaluator context
    const originalEvaluator = this.expressionEvaluator;

    // Override the parseDollarReference method to resolve references
    const originalParseDollarReference =
      originalEvaluator.parseDollarReference.bind(originalEvaluator);

    originalEvaluator.parseDollarReference = (tokens, index) => {
      return this.resolveReference(tokens, index, contextBlock);
    };

    try {
      const result = originalEvaluator.evaluate(expressionNode);
      return result;
    } finally {
      // Restore original method
      originalEvaluator.parseDollarReference = originalParseDollarReference;
    }
  }

  /**
   * Resolve a $-prefixed reference
   * Expects tokens starting at DOLLAR token
   */
  resolveReference(tokens, index, contextBlock) {
    // Token sequence is: DOLLAR, IDENTIFIER
    index++; // consume DOLLAR

    if (index >= tokens.length || tokens[index].type !== "IDENTIFIER") {
      throw new PreprocessError(
        "Expected identifier after $",
        "ExpectedIdentifier",
        null,
      );
    }

    const refName = tokens[index].value; // e.g., "parent", "this", "Sidebar"
    index++; // consume identifier

    // Resolve the base reference
    let value;

    if (refName === "this") {
      value = this.resolveThis(contextBlock);
    } else if (refName === "parent") {
      value = this.resolveParent(contextBlock);
    } else if (refName.match(/^[A-Z]/)) {
      // BlockId pattern (starts with capital letter)
      value = this.resolveSibling(contextBlock, refName);
    } else {
      throw new PreprocessError(
        `Invalid reference: $${refName}`,
        "InvalidReference",
        null,
      );
    }

    // Handle member access chain (e.g., $parent.width, $parent.parent.size, $parent.children[0])
    while (
      index < tokens.length &&
      (tokens[index].type === "DOT" || tokens[index].type === "LBRACKET")
    ) {
      if (tokens[index].type === "DOT") {
        index++; // consume .

        if (index >= tokens.length || tokens[index].type !== "IDENTIFIER") {
          throw new PreprocessError(
            "Expected property name after '.'",
            "ExpectedPropertyName",
            null,
          );
        }

        const propName = tokens[index].value;
        index++;

        // Special case: $parent.parent chains to grandparent
        if (propName === "parent" && value && value.type === "block") {
          value = this.resolveParent(value.node);
        } else if (propName === "children" && value && value.type === "block") {
          // Special case: $parent.children returns array of child blocks
          const children = this.registry.getChildren(value.node);
          value = children.map((child) => {
            const childContext = this.registry.getContext(child);
            return {
              type: "block",
              node: child,
              properties: childContext.properties,
            };
          });
        } else {
          // Access property from the resolved block
          if (!value || !value.properties || !(propName in value.properties)) {
            throw new PreprocessError(
              `Property '${propName}' not found on ${refName}`,
              "PropertyNotFound",
              null,
            );
          }

          value = value.properties[propName];
        }
      } else if (tokens[index].type === "LBRACKET") {
        // Array indexing: $parent.children[0]
        index++; // consume [

        // Parse the index expression
        const indexExpr = this.expressionEvaluator.parseExpression(
          tokens,
          index,
        );
        const indexValue = indexExpr.value;
        index = indexExpr.nextIndex;

        // Expect closing ]
        if (index >= tokens.length || tokens[index].type !== "RBRACKET") {
          throw new PreprocessError(
            "Expected ']' after array index",
            "ExpectedRBracket",
            null,
          );
        }
        index++; // consume ]

        // Access by index
        if (!Array.isArray(value)) {
          throw new PreprocessError(
            `Cannot index non-array value`,
            "InvalidIndexAccess",
            null,
          );
        }

        value = value[indexValue];
      }
    }

    // If value is still a block reference, we need a property access
    if (value && value.type === "block") {
      throw new PreprocessError(
        `Cannot use block reference without property access: ${refName}`,
        "IncompleteReference",
        null,
      );
    }

    return { value, nextIndex: index };
  }

  /**
   * Resolve $this reference
   */
  resolveThis(blockNode) {
    const context = this.registry.getContext(blockNode);
    if (!context) {
      throw new PreprocessError(
        "$this reference used but block not in registry",
        "BlockNotInRegistry",
        null,
      );
    }

    return {
      type: "block",
      node: blockNode,
      properties: context.properties,
    };
  }

  /**
   * Resolve $parent reference
   */
  resolveParent(blockNode) {
    const parent = this.registry.getParent(blockNode);
    if (!parent) {
      throw new PreprocessError(
        "$parent reference used but block has no parent",
        "NoParentBlock",
        null,
      );
    }

    const context = this.registry.getContext(parent);
    return {
      type: "block",
      node: parent,
      properties: context.properties,
    };
  }

  /**
   * Resolve $BlockId sibling reference
   */
  resolveSibling(blockNode, siblingId) {
    const sibling = this.registry.findSibling(blockNode, siblingId);
    if (!sibling) {
      throw new PreprocessError(
        `Block '${siblingId}' not found in siblings`,
        "BlockNotFound",
        null,
      );
    }

    const context = this.registry.getContext(sibling);
    return {
      type: "block",
      node: sibling,
      properties: context.properties,
    };
  }

  /**
   * Determine value type for literal conversion
   */
  getValueType(value) {
    if (typeof value === "number") return "number";
    if (typeof value === "string") return "string";
    if (typeof value === "boolean") return "boolean";
    if (value === null) return "null";
    return "object";
  }
}
