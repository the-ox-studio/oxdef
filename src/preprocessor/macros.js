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

    // Cursor control (Milestone 3)
    this.templateExpander = null;
    this.manuallyProcessedBlocks = new Set(); // Track blocks manually processed by user
    this.currentBlock = null; // Current block being processed
    this.currentParent = null; // Parent of current block
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
    this.templateExpander = null;
    this.manuallyProcessedBlocks.clear();
    this.currentBlock = null;
    this.currentParent = null;
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

    // Set current block context for cursor control (Milestone 3)
    const previousBlock = this.currentBlock;
    const previousParent = this.currentParent;
    this.currentBlock = block;
    this.currentParent = parent;

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
    } finally {
      // Restore previous block context
      this.currentBlock = previousBlock;
      this.currentParent = previousParent;
    }
  }

  /**
   * Check if onWalk is set
   * @returns {boolean}
   */
  hasOnWalk() {
    return this.onWalkCallback !== null;
  }

  /**
   * Set the template expander instance (Milestone 3)
   * @param {Object} expander - TemplateExpander instance
   */
  setTemplateExpander(expander) {
    this.templateExpander = expander;
  }

  /**
   * Peek at next block without advancing cursor (Milestone 3)
   * For simplicity, this returns the first child if any
   * @returns {Object|null} Next block or null
   */
  nextBlock() {
    if (!this.currentBlock) {
      throw new MacroError(
        "nextBlock() can only be called within onWalk callback",
      );
    }
    // Return first child if exists
    if (this.currentBlock.children && this.currentBlock.children.length > 0) {
      return this.currentBlock.children[0];
    }
    return null;
  }

  /**
   * Peek at next block with parent (Milestone 3)
   * @returns {{node: Object, parent: Object|null}|null}
   */
  peekNext() {
    if (!this.currentBlock) {
      throw new MacroError(
        "peekNext() can only be called within onWalk callback",
      );
    }
    const next = this.nextBlock();
    if (next) {
      return { node: next, parent: this.currentBlock };
    }
    return null;
  }

  /**
   * Get current block with parent (Milestone 3)
   * @returns {{node: Object, parent: Object|null}|null}
   */
  current() {
    if (!this.currentBlock) {
      throw new MacroError(
        "current() can only be called within onWalk callback",
      );
    }
    return {
      node: this.currentBlock,
      parent: this.currentParent,
    };
  }

  /**
   * Manually advance to and process a specific block (Milestone 3)
   * @param {Object} node - Block node to process
   * @param {Object|null} parent - Parent block
   */
  invokeWalk(node, parent) {
    if (!this.templateExpander) {
      throw new MacroError(
        "invokeWalk() can only be called within onWalk callback",
      );
    }

    // Mark this block as manually processed
    this.manuallyProcessedBlocks.add(node);

    // Evaluate the block's properties before calling onWalk
    this.templateExpander.evaluateBlockProperties(node);

    // Call the user's onWalk callback for this block
    this.executeOnWalk(node, parent);

    // Auto-process children that weren't manually processed
    if (node.children && node.children.length > 0) {
      const childrenToProcess = node.children.filter(
        (child) => !this.manuallyProcessedBlocks.has(child),
      );

      if (childrenToProcess.length > 0) {
        // Process each child
        for (const child of childrenToProcess) {
          this.manuallyProcessedBlocks.add(child);
          this.templateExpander.evaluateBlockProperties(child);
          this.executeOnWalk(child, node);

          // Recursively process grandchildren
          if (child.children && child.children.length > 0) {
            child.children = this.templateExpander.expandNodes(
              child.children,
              child,
            );
          }
        }
      }
    }
  }

  /**
   * Move cursor backward (Milestone 3)
   * Note: Not fully implemented in simple cursor model
   * @param {number} steps - Number of steps to move back
   */
  back(steps = 1) {
    if (!this.currentBlock) {
      throw new MacroError("back() can only be called within onWalk callback");
    }
    // Simple implementation - no-op for now
    // Full implementation would require walker integration
  }

  /**
   * Get remaining children of a parent block (Milestone 3)
   * @param {Object} parentNode - Parent block
   * @returns {Array<{node: Object, parent: Object}>}
   */
  getRemainingChildren(parentNode) {
    if (!this.currentBlock) {
      throw new MacroError(
        "getRemainingChildren() can only be called within onWalk callback",
      );
    }
    // Return children that haven't been manually processed
    if (parentNode.children && parentNode.children.length > 0) {
      return parentNode.children
        .filter((child) => !this.manuallyProcessedBlocks.has(child))
        .map((child) => ({ node: child, parent: parentNode }));
    }
    return [];
  }

  /**
   * Stop the walk (Milestone 3)
   * Note: Not fully implemented in simple cursor model
   */
  stop() {
    if (!this.currentBlock) {
      throw new MacroError("stop() can only be called within onWalk callback");
    }
    // Simple implementation - no-op for now
    // Full implementation would require walker integration
  }

  /**
   * Check if a block was manually processed (Milestone 3)
   * @param {Object} node - Block node
   * @returns {boolean}
   */
  wasManuallyProcessed(node) {
    return this.manuallyProcessedBlocks.has(node);
  }

  /**
   * Clear manually processed blocks tracking (Milestone 3)
   */
  clearManuallyProcessedBlocks() {
    this.manuallyProcessedBlocks.clear();
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

      /**
       * Peek at next block without advancing (Milestone 3)
       * @returns {Object|null}
       */
      nextBlock() {
        return macros.nextBlock();
      },

      /**
       * Peek at next block with parent (Milestone 3)
       * @returns {{node: Object, parent: Object|null}|null}
       */
      peekNext() {
        return macros.peekNext();
      },

      /**
       * Get current block with parent (Milestone 3)
       * @returns {{node: Object, parent: Object|null}|null}
       */
      current() {
        return macros.current();
      },

      /**
       * Manually advance to and process a block (Milestone 3)
       * @param {Object} node - Block node
       * @param {Object|null} parent - Parent block
       */
      invokeWalk(node, parent) {
        macros.invokeWalk(node, parent);
      },

      /**
       * Move cursor backward (Milestone 3)
       * @param {number} steps - Number of steps
       */
      back(steps = 1) {
        macros.back(steps);
      },

      /**
       * Get remaining children of parent (Milestone 3)
       * @param {Object} parentNode - Parent block
       * @returns {Array<{node: Object, parent: Object}>}
       */
      getRemainingChildren(parentNode) {
        return macros.getRemainingChildren(parentNode);
      },

      /**
       * Stop the walk (Milestone 3)
       */
      stop() {
        macros.stop();
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

  // Add internal methods for template expander integration (Milestone 3)
  ctx._setTemplateExpander = function (expander) {
    macros.setTemplateExpander(expander);
  };

  ctx._clearTemplateExpander = function () {
    macros.templateExpander = null;
  };

  ctx._wasManuallyProcessed = function (node) {
    return macros.wasManuallyProcessed(node);
  };

  ctx._clearManuallyProcessedBlocks = function () {
    macros.clearManuallyProcessedBlocks();
  };

  return ctx;
}
