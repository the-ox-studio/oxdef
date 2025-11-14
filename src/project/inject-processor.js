/**
 * Inject Processor for Multi-File OX System
 *
 * Responsibilities:
 * - Extract <inject> directives from AST
 * - Resolve inject paths
 * - Load and evaluate injected files independently
 * - Merge evaluated blocks at injection points
 * - Maintain file scope separation
 * - Validate inject locations (top-level or block children only)
 */

import { resolveImportPath } from "./resolver.js";

/**
 * InjectProcessor handles <inject> directive processing
 */
export class InjectProcessor {
  /**
   * @param {FileLoader} loader - File loader instance
   * @param {ImportGraph} graph - Import graph for circular detection
   * @param {Function} evaluateFile - Function to parse and preprocess a file
   */
  constructor(loader, graph, evaluateFile) {
    this.loader = loader;
    this.graph = graph;
    this.evaluateFile = evaluateFile;
  }

  /**
   * Process all injects in a file's AST
   * This replaces <inject> nodes with the evaluated blocks from the injected file
   *
   * @param {Object} ast - Parsed AST (Document node)
   * @param {string} currentFile - Absolute path to current file
   * @param {Object} config - Project configuration
   * @returns {Object} Modified AST with injects replaced by blocks
   */
  processInjects(ast, currentFile, config) {
    if (!ast || ast.type !== "Document") {
      throw new Error("AST must be a Document node");
    }

    // Process injects in the AST
    this.processNodeInjects(ast, currentFile, config);

    return ast;
  }

  /**
   * Recursively process inject directives in a node
   * Injects are stored inline with blocks/children to preserve order
   *
   * @param {Object} node - AST node to process
   * @param {string} currentFile - Current file path
   * @param {Object} config - Project configuration
   */
  processNodeInjects(node, currentFile, config) {
    if (!node) return;

    // Get the appropriate children array (blocks for Document, children for Block)
    const childrenKey = node.type === "Document" ? "blocks" : "children";
    const children = node[childrenKey];

    // Process children array recursively
    if (children && Array.isArray(children)) {
      const newChildren = [];

      for (const child of children) {
        // Skip non-object children
        if (!child || typeof child !== "object") {
          newChildren.push(child);
          continue;
        }

        // If this child is an inject node, process it and add expanded blocks
        if (child.type === "Inject") {
          const expandedBlocks = this.processInject(child, currentFile, config);
          newChildren.push(...expandedBlocks);
          continue;
        }

        // Recursively process nested blocks
        this.processNodeInjects(child, currentFile, config);

        newChildren.push(child);
      }

      node[childrenKey] = newChildren;
    }
  }

  /**
   * Process a single <inject> directive
   *
   * @param {Object} injectNode - Inject AST node
   * @param {string} currentFile - Current file path
   * @param {Object} config - Project configuration
   * @returns {Array} Array of evaluated blocks from injected file
   */
  processInject(injectNode, currentFile, config) {
    if (!injectNode || injectNode.type !== "Inject") {
      throw new Error("Expected Inject node");
    }

    const importPath = injectNode.path;

    // Validate path
    if (!importPath || typeof importPath !== "string") {
      throw new Error(
        `<inject> directive must have a valid path string, got: ${typeof importPath}`,
      );
    }

    // Resolve path
    const resolvedPath = resolveImportPath(importPath, currentFile, config);

    // Check for circular inject
    this.graph.push(resolvedPath, "inject");

    try {
      // Load the file
      const fileData = this.loader.loadFile(resolvedPath);

      // Process injects in the loaded file recursively
      // This is where circular dependencies will be detected
      this.processInjects(fileData.ast, resolvedPath, config);

      // Evaluate the file independently (parse + preprocess)
      // The file is evaluated in its own scope with its own variables/references
      const evaluatedBlocks = this.evaluateFile(
        resolvedPath,
        fileData.ast,
        config,
      );

      // Return the evaluated blocks (these will be merged at injection point)
      return evaluatedBlocks;
    } finally {
      // Pop from graph after processing
      this.graph.pop(resolvedPath);
    }
  }

  /**
   * Extract inject directives from AST (for debugging/analysis)
   * Note: The parser stores injects inline with blocks to preserve order
   *
   * @param {Object} ast - Parsed AST
   * @returns {Array} Array of inject nodes with location info
   */
  extractInjects(ast) {
    const injects = [];

    // Extract top-level injects (stored inline with blocks)
    if (ast.blocks && Array.isArray(ast.blocks)) {
      for (const item of ast.blocks) {
        if (item.type === "Inject") {
          injects.push({
            type: "top-level",
            path: item.path,
            node: item,
          });
        }
      }
    }

    // Extract block-level injects recursively
    this.extractBlockInjects(ast.blocks || [], injects);

    return injects;
  }

  /**
   * Recursively extract inject directives from blocks
   *
   * @param {Array} blocks - Array of block nodes
   * @param {Array} injects - Accumulator for inject nodes
   */
  extractBlockInjects(blocks, injects) {
    for (const block of blocks) {
      if (!block) continue;

      // Skip non-block nodes (like Inject nodes at top level)
      if (block.type !== "Block") continue;

      // Check children for injects (stored inline)
      if (block.children && Array.isArray(block.children)) {
        for (const child of block.children) {
          if (child && child.type === "Inject") {
            injects.push({
              type: "block-child",
              parentBlock: block.id || block.identifier,
              path: child.path,
              node: child,
            });
          }
        }

        // Recursively process nested blocks in children
        for (const child of block.children) {
          if (child && child.type === "Block") {
            this.extractBlockInjects([child], injects);
          }
        }
      }
    }
  }

  /**
   * Validate inject locations
   * Injects are only allowed at top-level or as block children
   * They cannot appear in property expressions
   *
   * @param {Object} ast - Parsed AST
   * @throws {Error} If injects appear in invalid locations
   */
  validateInjectLocations(ast) {
    // The parser already enforces this by only allowing injects
    // at top-level (ast.injects) or as block children (block.injects)
    // This method is provided for additional validation if needed

    // Check that no properties contain inject references
    this.validateNodeProperties(ast);
  }

  /**
   * Recursively validate that properties don't contain inject references
   *
   * @param {Object} node - AST node to validate
   */
  validateNodeProperties(node) {
    if (!node) return;

    // Check blocks
    if (node.blocks && Array.isArray(node.blocks)) {
      for (const block of node.blocks) {
        // Check block properties
        if (block.properties) {
          for (const [key, value] of Object.entries(block.properties)) {
            if (this.containsInjectReference(value)) {
              throw new Error(
                `<inject> cannot be used in property '${key}'. ` +
                  `Injects are only allowed at top-level or as block children.`,
              );
            }
          }
        }

        // Recursively validate nested blocks
        this.validateNodeProperties(block);
      }
    }
  }

  /**
   * Check if a value contains an inject reference
   *
   * @param {*} value - Value to check
   * @returns {boolean} True if value contains inject reference
   */
  containsInjectReference(value) {
    if (!value) return false;

    // Check if value is an object with type "Inject"
    if (typeof value === "object") {
      if (value.type === "Inject") return true;

      // Recursively check nested objects/arrays
      if (Array.isArray(value)) {
        return value.some((item) => this.containsInjectReference(item));
      }

      return Object.values(value).some((v) => this.containsInjectReference(v));
    }

    return false;
  }
}
