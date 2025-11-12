/**
 * OXProject - Main API for multi-file OX document processing
 *
 * Responsibilities:
 * - Load and validate project configuration
 * - Orchestrate multi-file processing pipeline
 * - Integrate FileLoader, ImportProcessor, InjectProcessor
 * - Provide clean public API for parsing OX projects
 * - Support macro contexts for preprocessing
 */

import fs from "fs";
import path from "path";
import { loadConfig } from "./config.js";
import { FileLoader } from "./loader.js";
import { ImportGraph } from "./import-graph.js";
import { ImportProcessor } from "./import-processor.js";
import { InjectProcessor } from "./inject-processor.js";
import { TagRegistry } from "../preprocessor/tags.js";
import { TemplateExpander } from "../preprocessor/templates.js";
import { Transaction } from "../transaction/transaction.js";
import { DataSourceProcessor } from "../preprocessor/datasources.js";

/**
 * Validate inputs with helpful error messages
 */
class InputValidator {
  static validateDirectory(dir, paramName = "directory") {
    if (!dir || typeof dir !== "string") {
      throw new TypeError(
        `${paramName} must be a non-empty string, got ${typeof dir}`,
      );
    }

    if (!fs.existsSync(dir)) {
      throw new Error(`${paramName} does not exist: ${dir}`);
    }

    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
      throw new Error(`${paramName} is not a directory: ${dir}`);
    }
  }

  static validateFilePath(filePath, paramName = "filePath") {
    if (!filePath || typeof filePath !== "string") {
      throw new TypeError(
        `${paramName} must be a non-empty string, got ${typeof filePath}`,
      );
    }

    if (filePath.length > 4096) {
      throw new Error(
        `${paramName} is too long (${filePath.length} chars, max 4096)`,
      );
    }

    if (!filePath.endsWith(".ox")) {
      throw new Error(`${paramName} must have .ox extension: ${filePath}`);
    }
  }

  static validateOptions(options, paramName = "options") {
    if (options !== null && typeof options !== "object") {
      throw new TypeError(
        `${paramName} must be an object or null, got ${typeof options}`,
      );
    }
  }

  static validateMacroContext(context, paramName = "macroContext") {
    if (context !== null && typeof context !== "object") {
      throw new TypeError(
        `${paramName} must be an object or null, got ${typeof context}`,
      );
    }
  }
}

/**
 * OXProject represents a multi-file OX document project
 */
export class OXProject {
  /**
   * Create an OXProject from a directory containing ox.config.js/json
   *
   * @param {string} projectDir - Absolute path to project directory
   * @param {Object} options - Optional configuration overrides
   * @returns {OXProject} Project instance
   */
  static fromDirectory(projectDir, options = {}) {
    InputValidator.validateDirectory(projectDir, "projectDir");
    InputValidator.validateOptions(options, "options");

    const config = loadConfig(projectDir);

    // Apply options overrides
    const finalConfig = { ...config, ...options };

    return new OXProject(finalConfig);
  }

  /**
   * Create an OXProject from a single file
   * Uses the file's directory as the project base
   *
   * @param {string} filePath - Absolute path to entry .ox file
   * @param {Object} options - Optional configuration
   * @returns {OXProject} Project instance
   */
  static fromFile(filePath, options = {}) {
    InputValidator.validateFilePath(filePath, "filePath");
    InputValidator.validateOptions(options, "options");

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const baseDir = path.dirname(filePath);
    const config = {
      baseDir,
      entryPoint: path.basename(filePath),
      moduleDirectories: ["node_modules"],
      ...options,
    };

    return new OXProject(config);
  }

  /**
   * @param {Object} config - Project configuration
   * @param {TagRegistry} tagRegistry - Optional custom tag registry
   */
  constructor(config, tagRegistry = null) {
    this.config = config;
    this.tagRegistry = tagRegistry || new TagRegistry();
    this.loader = new FileLoader(config);
    this.graph = new ImportGraph();
    this.importProcessor = new ImportProcessor(
      this.loader,
      this.graph,
      this.tagRegistry,
    );
    this.injectProcessor = new InjectProcessor(
      this.loader,
      this.graph,
      this.evaluateFile.bind(this),
    );
  }

  /**
   * Parse the project's entry point file
   *
   * @param {Object} macroContext - Optional macro context for preprocessing
   * @returns {Array} Array of evaluated blocks
   */
  parse(macroContext = null) {
    InputValidator.validateMacroContext(macroContext, "macroContext");

    // Determine entry point
    const entryPoint = path.resolve(
      this.config.baseDir,
      this.config.entryPoint,
    );

    // Load entry file
    const { ast } = this.loader.loadFile(entryPoint);

    // Process imports (extract and merge tag definitions)
    this.importProcessor.processImports(ast, entryPoint);

    // Process injects (replace with evaluated blocks)
    this.injectProcessor.processInjects(ast, entryPoint, this.config);

    // Evaluate the main file (preprocess with templates, references, etc.)
    const blocks = this.evaluateFile(
      entryPoint,
      ast,
      this.config,
      macroContext,
    );

    return blocks;
  }

  /**
   * Parse a specific file (can be different from entry point)
   *
   * @param {string} filePath - Absolute path to file
   * @param {Object} macroContext - Optional macro context
   * @returns {Array} Array of evaluated blocks
   */
  parseFile(filePath, macroContext = null) {
    InputValidator.validateFilePath(filePath, "filePath");
    InputValidator.validateMacroContext(macroContext, "macroContext");

    // Load file
    const { ast } = this.loader.loadFile(filePath);

    // Process imports
    this.importProcessor.processImports(ast, filePath);

    // Process injects
    this.injectProcessor.processInjects(ast, filePath, this.config);

    // Evaluate
    const blocks = this.evaluateFile(filePath, ast, this.config, macroContext);

    return blocks;
  }

  /**
   * Evaluate a file (parse + preprocess)
   * This is used internally by InjectProcessor
   *
   * @param {string} filePath - File path (for error reporting)
   * @param {Object} ast - Parsed AST
   * @param {Object} config - Project configuration
   * @param {Object} macroContext - Optional macro context
   * @returns {Array} Array of evaluated blocks
   */
  evaluateFile(filePath, ast, config, macroContext = null) {
    // Create transaction for data sources
    const transaction = new Transaction();
    const dataSourceProcessor = new DataSourceProcessor(transaction);

    // Create template expander
    const expander = new TemplateExpander(
      transaction,
      dataSourceProcessor,
      macroContext,
    );

    // Expand templates (this also handles references, expressions, etc.)
    const blocks = expander.expandTemplates(ast);

    return blocks;
  }

  /**
   * Get list of all files loaded in this project
   *
   * @returns {Array<string>} Array of absolute file paths in load order
   */
  getLoadedFiles() {
    return this.loader.getLoadedFiles();
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats (filesLoaded, currentCacheSizeBytes, etc.)
   */
  getStats() {
    return this.loader.getStats();
  }

  /**
   * Clear all cached files and reset state
   */
  clearCache() {
    this.loader.clearCache();
    this.graph = new ImportGraph();
    // Note: Tag registry is NOT cleared as it may contain
    // JavaScript-defined tags that should persist
  }

  /**
   * Get the project configuration
   *
   * @returns {Object} Project configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get the tag registry
   *
   * @returns {TagRegistry} Tag registry instance
   */
  getTagRegistry() {
    return this.tagRegistry;
  }

  /**
   * Reload a specific file (bypass cache)
   *
   * @param {string} filePath - Absolute path to file
   * @param {Object} macroContext - Optional macro context
   * @returns {Array} Array of evaluated blocks
   */
  reloadFile(filePath, macroContext = null) {
    // Force reload from disk
    this.loader.reloadFile(filePath);

    // Parse with fresh content
    return this.parseFile(filePath, macroContext);
  }
}
