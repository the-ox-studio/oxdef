/**
 * Import Processor for Multi-File OX System
 *
 * Responsibilities:
 * - Extract <import> directives from AST
 * - Resolve import paths
 * - Load imported files recursively
 * - Extract @tag definitions from imported files
 * - Handle namespacing (<import as>)
 * - Merge tag definitions into registry
 * - Validate import syntax (top-level only)
 */

import { resolveImportPath } from "./resolver.js";

/**
 * ImportProcessor handles <import> directive processing
 */
export class ImportProcessor {
  /**
   * @param {FileLoader} loader - File loader instance
   * @param {ImportGraph} graph - Import graph for circular detection
   * @param {TagRegistry} tagRegistry - Tag registry to merge definitions into
   */
  constructor(loader, graph, tagRegistry) {
    this.loader = loader;
    this.graph = graph;
    this.tagRegistry = tagRegistry;
  }

  /**
   * Process all imports in a file's AST
   *
   * @param {Object} ast - Parsed AST (Document node)
   * @param {string} currentFile - Absolute path to current file
   * @returns {Object} { imports: ImportNode[], tagDefinitions: Map }
   */
  processImports(ast, currentFile) {
    // Extract <import> directives (must be top-level)
    const imports = this.extractImports(ast);

    // Process each import
    const processedImports = [];
    for (const importNode of imports) {
      const processed = this.processImport(importNode, currentFile);
      processedImports.push(processed);
    }

    return {
      imports: processedImports,
      totalDefinitions: processedImports.reduce(
        (sum, imp) => sum + imp.definitions.size,
        0,
      ),
    };
  }

  /**
   * Extract <import> directives from AST
   * Validates that imports are at top-level only
   *
   * @param {Object} ast - Document AST
   * @returns {ImportNode[]} Array of import nodes
   * @throws {Error} If import not at top-level
   */
  extractImports(ast) {
    if (ast.type !== "Document") {
      throw new Error(`Expected Document node, got ${ast.type}`);
    }

    // Parser stores imports in ast.imports array
    const imports = ast.imports || [];

    // Also validate that no imports are nested in blocks (shouldn't happen with parser, but check anyway)
    for (const block of ast.blocks) {
      if (block.type === "Block") {
        this.validateNoNestedImports(block);
      }
    }

    return imports;
  }

  /**
   * Validate that no imports exist in nested blocks
   *
   * @param {Object} block - Block node to check
   * @throws {Error} If nested import found
   */
  validateNoNestedImports(block) {
    if (!block.children) return;

    for (const child of block.children) {
      if (child.type === "Import") {
        const location = child.location || {};
        throw new Error(
          `Import must be at document top-level (found in block '${block.id}')` +
            (location.line ? ` at line ${location.line}` : ""),
        );
      }

      if (child.type === "Block") {
        this.validateNoNestedImports(child);
      }
    }
  }

  /**
   * Process a single import
   *
   * @param {ImportNode} importNode - Import node from AST
   * @param {string} currentFile - Absolute path to current file
   * @returns {Object} { path, resolvedPath, alias, definitions }
   */
  processImport(importNode, currentFile) {
    const { path: importPath, alias } = importNode;

    // Validate alias if provided
    if (alias !== null && alias !== undefined) {
      this.validateAlias(alias);
    }

    // Resolve the import path using the resolver function
    const resolvedPath = resolveImportPath(
      importPath,
      currentFile,
      this.loader.config,
    );

    // Track in import graph (throws on circular dependency)
    this.graph.push(resolvedPath, "import");

    try {
      // Load the imported file
      const { ast } = this.loader.loadFile(resolvedPath);

      // Extract tag definitions from the imported file
      const tagDefinitions = this.extractTagDefinitions(ast);

      // Merge tag definitions into registry with optional namespace
      this.mergeTagDefinitions(tagDefinitions, alias);

      // Record dependency
      this.graph.addDependency(currentFile, resolvedPath, "import");

      return {
        path: importPath,
        resolvedPath,
        alias,
        definitions: tagDefinitions,
      };
    } finally {
      // Pop from import stack
      this.graph.pop(resolvedPath);
    }
  }

  /**
   * Extract @tag definitions from an AST
   * Only extracts top-level blocks with @tag markers
   *
   * @param {Object} ast - Document AST
   * @returns {Map<string, Object>} Map of "tagName(argument)" -> BlockNode
   */
  extractTagDefinitions(ast) {
    const definitions = new Map();

    if (ast.type !== "Document") {
      return definitions;
    }

    for (const block of ast.blocks) {
      if (block.type !== "Block") continue;

      // Check if block has tag definitions (@tag)
      const definitionTags = block.tags.filter(
        (tag) => tag.tagType === "definition",
      );

      for (const tag of definitionTags) {
        // Create instance key: "tagName(argument)"
        const key = tag.argument ? `${tag.name}(${tag.argument})` : tag.name;

        definitions.set(key, {
          tag,
          block,
          key,
        });
      }
    }

    return definitions;
  }

  /**
   * Merge tag definitions into the registry
   * Handles namespacing and conflict detection
   *
   * @param {Map<string, Object>} definitions - Tag definitions to merge
   * @param {string|null} namespace - Optional namespace prefix
   */
  mergeTagDefinitions(definitions, namespace = null) {
    for (const [key, { tag, block }] of definitions) {
      // Apply namespace if provided
      const registryKey = namespace ? `${namespace}.${key}` : key;

      // Register in tag registry
      // If duplicate without namespace, last import wins (as per design)
      // If with namespace, they're kept separate
      try {
        this.tagRegistry.registerInstance(registryKey, block);
      } catch (err) {
        // If error is duplicate and we're not using namespace, allow override
        if (!namespace && err.message.includes("Duplicate tag definition")) {
          // Remove old definition and register new one
          this.tagRegistry.instances.delete(registryKey);
          this.tagRegistry.registerInstance(registryKey, block);
        } else {
          // Re-throw if namespaced or other error
          throw err;
        }
      }
    }
  }

  /**
   * Process imports recursively for a file
   * Ensures all nested imports are loaded
   *
   * @param {string} filePath - Absolute path to file
   * @returns {Set<string>} Set of all processed file paths
   */
  processFileImportsRecursive(filePath) {
    const processed = new Set();

    const processFile = (path) => {
      if (processed.has(path)) return;
      processed.add(path);

      // Load file
      const { ast } = this.loader.loadFile(path);

      // Extract and process imports
      const imports = this.extractImports(ast);

      for (const importNode of imports) {
        const resolvedPath = resolveImportPath(
          importNode.path,
          path,
          this.loader.config,
        );

        // Recursively process imported file
        processFile(resolvedPath);
      }
    };

    processFile(filePath);
    return processed;
  }

  /**
   * Get all tag definitions currently in registry
   * Useful for debugging
   *
   * @returns {Map} Tag registry instances
   */
  getTagDefinitions() {
    return this.tagRegistry.instances;
  }

  /**
   * Clear all imported tag definitions
   * Useful for testing or hot-reload scenarios
   */
  clearImportedTags() {
    this.tagRegistry.instances.clear();
  }

  /**
   * Validate import alias
   *
   * @param {string} alias - Alias to validate
   * @throws {Error} If alias is invalid
   */
  validateAlias(alias) {
    // Must be a non-empty string
    if (typeof alias !== "string" || alias.trim() === "") {
      throw new Error(`Invalid alias: must be a non-empty string`);
    }

    // Must be a valid identifier (alphanumeric, underscore, hyphen)
    const validAliasPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    if (!validAliasPattern.test(alias)) {
      throw new Error(
        `Invalid alias '${alias}': must start with a letter or underscore, ` +
          `and contain only letters, numbers, underscores, or hyphens`,
      );
    }

    // Security: Prevent aliases that could conflict with system tags
    const reservedNames = [
      "import",
      "inject",
      "set",
      "if",
      "foreach",
      "while",
      "on-data",
    ];
    if (reservedNames.includes(alias.toLowerCase())) {
      throw new Error(
        `Invalid alias '${alias}': conflicts with reserved keyword`,
      );
    }

    // Security: Limit alias length
    if (alias.length > 50) {
      throw new Error(`Invalid alias '${alias}': too long (max 50 characters)`);
    }
  }
}
