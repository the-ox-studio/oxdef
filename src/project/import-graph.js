/**
 * Import Graph - Track and detect circular dependencies
 *
 * Tracks both <import> and <inject> chains to prevent cycles
 */

import { normalizePath } from "./resolver.js";

// Security: Maximum import depth to prevent stack overflow
const MAX_IMPORT_DEPTH = 50;

/**
 * ImportGraph - Tracks import/inject chains
 */
export class ImportGraph {
  /**
   * @param {Object} options - Optional configuration
   * @param {number} options.maxDepth - Maximum import depth (default: 50)
   */
  constructor(options = {}) {
    // Stack of files currently being processed
    this.stack = [];

    // Map of file -> dependencies for debugging
    this.dependencies = new Map();

    // Security: Maximum import depth
    this.maxDepth = options.maxDepth || MAX_IMPORT_DEPTH;
  }

  /**
   * Push file onto processing stack
   *
   * @param {string} filePath - Absolute file path
   * @param {string} type - 'import' or 'inject'
   * @throws {Error} If circular dependency detected
   */
  push(filePath, type = "import") {
    const normalizedPath = normalizePath(filePath);

    // Security: Check import depth limit
    if (this.stack.length >= this.maxDepth) {
      const chain = this.stack.map((e) => e.path).join(" → ");
      throw new Error(
        `Maximum ${type} depth exceeded (${this.maxDepth}). ` +
          `This may indicate a circular dependency or overly deep nesting. ` +
          `Chain: ${chain} → ${normalizedPath}`,
      );
    }

    // Check if already in stack (circular dependency)
    const existingIndex = this.stack.findIndex(
      (entry) => entry.path === normalizedPath,
    );

    if (existingIndex !== -1) {
      // Circular dependency detected
      this.throwCircularError(normalizedPath, existingIndex, type);
    }

    // Add to stack
    this.stack.push({
      path: normalizedPath,
      type: type,
    });
  }

  /**
   * Pop file from processing stack
   *
   * @param {string} filePath - File path to pop
   */
  pop(filePath) {
    const normalizedPath = normalizePath(filePath);
    const last = this.stack[this.stack.length - 1];

    if (last && last.path === normalizedPath) {
      this.stack.pop();
    }
  }

  /**
   * Add dependency relationship
   *
   * @param {string} from - Source file
   * @param {string} to - Target file
   * @param {string} type - 'import' or 'inject'
   */
  addDependency(from, to, type) {
    const normalizedFrom = normalizePath(from);
    const normalizedTo = normalizePath(to);

    if (!this.dependencies.has(normalizedFrom)) {
      this.dependencies.set(normalizedFrom, []);
    }

    this.dependencies.get(normalizedFrom).push({
      target: normalizedTo,
      type: type,
    });
  }

  /**
   * Get dependency chain for a file
   *
   * @param {string} filePath - File path
   * @returns {Array} Array of dependencies
   */
  getDependencies(filePath) {
    const normalizedPath = normalizePath(filePath);
    return this.dependencies.get(normalizedPath) || [];
  }

  /**
   * Throw circular dependency error
   *
   * @param {string} filePath - File that created the cycle
   * @param {number} cycleStartIndex - Index where cycle begins
   * @param {string} type - 'import' or 'inject'
   * @throws {Error}
   */
  throwCircularError(filePath, cycleStartIndex, type) {
    // Build cycle path
    const cyclePath = this.stack
      .slice(cycleStartIndex)
      .map((entry) => entry.path)
      .concat(filePath);

    const cycleString = cyclePath.join(" → ");

    throw new Error(`Circular ${type} detected: ${cycleString}`);
  }

  /**
   * Get current processing stack
   *
   * @returns {Array<string>} Stack of file paths
   */
  getStack() {
    return this.stack.map((entry) => entry.path);
  }

  /**
   * Get current stack depth
   *
   * @returns {number} Stack depth
   */
  getDepth() {
    return this.stack.length;
  }

  /**
   * Check if file is currently being processed
   *
   * @param {string} filePath - File path to check
   * @returns {boolean} True if in stack
   */
  isProcessing(filePath) {
    const normalizedPath = normalizePath(filePath);
    return this.stack.some((entry) => entry.path === normalizedPath);
  }

  /**
   * Clear the graph
   */
  clear() {
    this.stack = [];
    this.dependencies.clear();
  }

  /**
   * Get graph statistics (for debugging)
   *
   * @returns {Object} Graph statistics
   */
  getStats() {
    return {
      stackDepth: this.stack.length,
      totalFiles: this.dependencies.size,
      totalDependencies: Array.from(this.dependencies.values()).reduce(
        (sum, deps) => sum + deps.length,
        0,
      ),
    };
  }

  /**
   * Export graph as JSON (for debugging/visualization)
   *
   * @returns {Object} Graph data
   */
  toJSON() {
    const edges = [];

    for (const [from, deps] of this.dependencies.entries()) {
      for (const dep of deps) {
        edges.push({
          from: from,
          to: dep.target,
          type: dep.type,
        });
      }
    }

    return {
      nodes: Array.from(this.dependencies.keys()),
      edges: edges,
      stack: this.getStack(),
    };
  }
}
