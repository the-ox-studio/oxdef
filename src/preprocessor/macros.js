/**
 * Macros - Meta-programming system for OX preprocessing
 *
 * Provides two hooks for user control during preprocessing:
 * 1. onParse - Called once before preprocessing begins
 * 2. onWalk - Called for each block during preprocessing
 */

import { walk } from "../walker/walker.js";

/**
 * MacroSystem - Manages macro hooks and execution
 */
export class MacroSystem {
  constructor() {
    // Pre-parse hook
    this.onParseCallback = null;
    this.shouldFinish = false;

    // Macro walk hook (Milestone 2)
    this.onWalkCallback = null;

    // Tree reference (set by parser)
    this.tree = null;

    // Parser reference (for finish)
    this.parser = null;
  }

  /**
   * Set the pre-parse callback
   * @param {Function} callback - Called before preprocessing starts
   */
  setOnParse(callback) {
    if (callback && typeof callback !== "function") {
      throw new Error("onParse callback must be a function");
    }
    this.onParseCallback = callback;
  }

  /**
   * Execute the pre-parse hook
   * @param {Object} tree - The parsed AST
   * @param {Object} parser - Parser instance for finish()
   * @returns {boolean} True if should continue, false if finish() was called
   */
  executeOnParse(tree, parser) {
    if (!this.onParseCallback) {
      return true; // No callback, continue normally
    }

    this.tree = tree;
    this.parser = parser;
    this.shouldFinish = false;

    try {
      // Call user's onParse callback
      this.onParseCallback();

      // Check if user called finish()
      return !this.shouldFinish;
    } catch (error) {
      // Re-throw user errors with context
      if (error.name === "MacroError") {
        throw error;
      }
      throw new MacroError(
        `Error in onParse callback: ${error.message}`,
        error,
      );
    } finally {
      // Cleanup
      this.tree = null;
      this.parser = null;
    }
  }

  /**
   * Terminate preprocessing early (called from user's onParse)
   */
  finish() {
    this.shouldFinish = true;
  }

  /**
   * Walk the tree (available in onParse callback)
   * @param {Object} tree - Tree to walk
   * @param {Function} callback - Walker callback
   * @param {Object} options - Walker options
   */
  walk(tree, callback, options) {
    return walk(tree, callback, options);
  }

  /**
   * Get current tree (available in onParse callback)
   * @returns {Object} Current parsed tree
   */
  getTree() {
    return this.tree;
  }

  /**
   * Set the macro walk callback (Milestone 2)
   * @param {Function} callback - Called for each block during preprocessing
   */
  setOnWalk(callback) {
    if (callback && typeof callback !== "function") {
      throw new Error("onWalk callback must be a function");
    }
    this.onWalkCallback = callback;
  }

  /**
   * Throw a macro error (for user validation)
   * @param {string} message - Error message
   */
  throwError(message) {
    throw new MacroError(message);
  }

  /**
   * Reset macro system state
   */
  reset() {
    this.onParseCallback = null;
    this.onWalkCallback = null;
    this.shouldFinish = false;
    this.tree = null;
    this.parser = null;
  }

  /**
   * Execute the onWalk hook for a block
   * @param {Object} block - Block with evaluated properties
   * @param {Object} parent - Parent block
   * @returns {*} User callback result
   */
  executeOnWalk(block, parent) {
    if (!this.onWalkCallback) {
      return; // No callback, continue normally
    }

    try {
      // Call user's onWalk callback
      return this.onWalkCallback(block, parent);
    } catch (error) {
      // Re-throw user errors with context
      if (error.name === "MacroError") {
        throw error;
      }
      throw new MacroError(
        `Error in onWalk callback for block '${block.id || "unknown"}': ${error.message}`,
        error,
      );
    }
  }

  /**
   * Check if onWalk is set
   * @returns {boolean}
   */
  hasOnWalk() {
    return this.onWalkCallback !== null;
  }
}

/**
 * MacroError - Custom error for macro system
 */
export class MacroError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "MacroError";
    this.cause = cause;
  }
}

/**
 * Global macro system instance
 */
export const macros = new MacroSystem();

/**
 * Initialize macro system with parser
 * @param {Object} parser - Parser instance
 */
export function initMacros(parser) {
  macros.parser = parser;
}

/**
 * Create a macro-enabled parser context
 */
export function createMacroContext() {
  return {
    init: {
      /**
       * Set pre-parse callback
       * @param {Function} callback
       */
      set onParse(callback) {
        macros.setOnParse(callback);
      },
      get onParse() {
        return macros.onParseCallback;
      },
    },

    macros: {
      /**
       * Set macro walk callback (Milestone 2)
       * @param {Function} callback
       */
      set onWalk(callback) {
        macros.setOnWalk(callback);
      },
      get onWalk() {
        return macros.onWalkCallback;
      },

      /**
       * Throw validation error
       * @param {string} message
       */
      throwError(message) {
        macros.throwError(message);
      },
    },

    /**
     * Get current tree (in onParse)
     */
    get tree() {
      return macros.getTree();
    },

    /**
     * Walk tree (in onParse)
     */
    walk(tree, callback, options) {
      return macros.walk(tree, callback, options);
    },

    /**
     * Finish preprocessing early (in onParse)
     */
    finish() {
      macros.finish();
    },

    /**
     * Reset macro system
     */
    reset() {
      macros.reset();
    },

    // Internal method for template expander
    _executeOnWalk(block, parent) {
      return macros.executeOnWalk(block, parent);
    },

    _hasOnWalk() {
      return macros.hasOnWalk();
    },
  };
}

export default macros;

/**
 * Enhanced macro context with internal methods
 */
export function createEnhancedMacroContext() {
  const ctx = createMacroContext();

  // Add internal method for parser integration
  ctx._executeOnParse = function (tree, parser) {
    return macros.executeOnParse(tree, parser);
  };

  return ctx;
}
