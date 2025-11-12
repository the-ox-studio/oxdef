/**
 * Walker - Tree traversal utilities for OX AST
 * 
 * Provides depth-first and breadth-first traversal with filtering,
 * early termination, and state management for macro system integration.
 */

import { BlockNode } from '../parser/ast.js';

/**
 * Traversal order options
 */
export const TraversalOrder = {
  PRE: 'pre',       // Visit parent before children
  POST: 'post',     // Visit children before parent
  BREADTH: 'breadth' // Breadth-first (level by level)
};

/**
 * Walker callback return values
 */
export const WalkerControl = {
  CONTINUE: undefined,  // Continue normal traversal
  STOP: false,          // Stop entire traversal
  SKIP: 'skip'          // Skip children of current block
};

/**
 * TreeWalker - Main walker class for AST traversal
 */
export class TreeWalker {
  constructor(tree, callback, options = {}) {
    this.tree = tree;
    this.callback = callback;
    this.options = {
      order: options.order || TraversalOrder.PRE,
      filter: options.filter || null,
      trackParents: options.trackParents !== false, // Default true
      trackSiblings: options.trackSiblings || false
    };
    
    // State management for macro system
    this.cursor = null;
    this.stack = [];
    this.parentChain = [];
    this.stopped = false;
  }

  /**
   * Execute the walk
   * @returns {boolean} True if completed, false if stopped early
   */
  walk() {
    this.stopped = false;
    
    if (this.options.order === TraversalOrder.BREADTH) {
      return this.walkBreadthFirst(this.tree);
    } else {
      return this.walkDepthFirst(this.tree, null);
    }
  }

  /**
   * Depth-first traversal (pre-order or post-order)
   * @param {BlockNode} node - Current node
   * @param {BlockNode|null} parent - Parent node
   * @returns {boolean} Continue traversal
   */
  walkDepthFirst(node, parent) {
    if (this.stopped) return false;
    if (!node) return true;

    // Apply filter
    if (this.options.filter && !this.options.filter(node, parent)) {
      return true; // Skip this node but continue traversal
    }

    // Update state
    this.cursor = node;
    if (this.options.trackParents) {
      this.parentChain.push(parent);
    }

    let result = WalkerControl.CONTINUE;

    // Pre-order: visit before children
    if (this.options.order === TraversalOrder.PRE) {
      result = this.callback(node, parent);
      
      if (result === WalkerControl.STOP) {
        this.stopped = true;
        return false;
      }
    }

    // Traverse children (unless skipped)
    if (result !== WalkerControl.SKIP && node.children && node.children.length > 0) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const continueWalk = this.walkDepthFirst(child, node);
        if (!continueWalk) {
          return false;
        }
      }
    }

    // Post-order: visit after children
    if (this.options.order === TraversalOrder.POST) {
      result = this.callback(node, parent);
      
      if (result === WalkerControl.STOP) {
        this.stopped = true;
        return false;
      }
    }

    // Restore state
    if (this.options.trackParents) {
      this.parentChain.pop();
    }

    return true;
  }

  /**
   * Breadth-first traversal (level by level)
   * @param {BlockNode} root - Root node
   * @returns {boolean} Continue traversal
   */
  walkBreadthFirst(root) {
    if (!root) return true;

    const queue = [{ node: root, parent: null }];
    
    while (queue.length > 0 && !this.stopped) {
      const { node, parent } = queue.shift();

      // Apply filter
      if (this.options.filter && !this.options.filter(node, parent)) {
        continue; // Skip this node
      }

      // Update state
      this.cursor = node;

      // Visit node
      const result = this.callback(node, parent);
      
      if (result === WalkerControl.STOP) {
        this.stopped = true;
        return false;
      }

      // Add children to queue (unless skipped)
      if (result !== WalkerControl.SKIP && node.children && node.children.length > 0) {
        for (const child of node.children) {
          queue.push({ node: child, parent: node });
        }
      }
    }

    return !this.stopped;
  }

  /**
   * Get current parent (for macro system)
   * @returns {BlockNode|null}
   */
  getCurrentParent() {
    return this.parentChain[this.parentChain.length - 1] || null;
  }
}

/**
 * MacroWalker - Specialized walker for macro system with cursor control
 * 
 * Provides fine-grained control over traversal for macro hooks:
 * - Peek at next block without advancing
 * - Manually invoke walk on specific blocks
 * - Move cursor backward
 */
export class MacroWalker {
  constructor(tree, callback) {
    this.tree = tree;
    this.callback = callback;
    this.blocks = [];
    this.cursor = 0;
    this.stopped = false;
    this.autoProcess = true; // Auto-process children not manually walked
  }

  /**
   * Initialize walker by flattening tree into traversal order
   */
  initialize() {
    this.blocks = [];
    this.flattenTree(this.tree, null);
    this.cursor = 0;
    this.stopped = false;
  }

  /**
   * Flatten tree into array with parent references
   * @param {BlockNode} node 
   * @param {BlockNode|null} parent 
   */
  flattenTree(node, parent) {
    if (!node) return;

    this.blocks.push({ node, parent });

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.flattenTree(child, node);
      }
    }
  }

  /**
   * Execute the walk with macro callback control
   */
  walk() {
    this.initialize();

    while (this.cursor < this.blocks.length && !this.stopped) {
      const { node, parent } = this.blocks[this.cursor];
      
      // Call user callback - they can control child processing
      const result = this.callback(node, parent);
      
      if (result === WalkerControl.STOP) {
        this.stopped = true;
        return false;
      }

      this.cursor++;
    }

    return !this.stopped;
  }

  /**
   * Peek at next block without advancing cursor
   * @returns {BlockNode|null}
   */
  nextBlock() {
    if (this.cursor + 1 < this.blocks.length) {
      return this.blocks[this.cursor + 1].node;
    }
    return null;
  }

  /**
   * Peek at next block with parent
   * @returns {{node: BlockNode, parent: BlockNode|null}|null}
   */
  peekNext() {
    if (this.cursor + 1 < this.blocks.length) {
      return this.blocks[this.cursor + 1];
    }
    return null;
  }

  /**
   * Get current block
   * @returns {{node: BlockNode, parent: BlockNode|null}|null}
   */
  current() {
    if (this.cursor < this.blocks.length) {
      return this.blocks[this.cursor];
    }
    return null;
  }

  /**
   * Move cursor backward (use with caution - can cause infinite loops)
   * @param {number} steps - Number of steps to move back (default 1)
   */
  back(steps = 1) {
    this.cursor = Math.max(0, this.cursor - steps);
  }

  /**
   * Manually advance to and process a specific block
   * This is used by macro system to control evaluation order
   * @param {BlockNode} targetNode 
   * @param {BlockNode|null} parent 
   */
  invokeWalk(targetNode, parent) {
    // Find the block in our flattened list
    const index = this.blocks.findIndex(b => b.node === targetNode);
    
    if (index === -1) {
      throw new Error(`Block not found in traversal order: ${targetNode.id || 'unknown'}`);
    }

    // Move cursor to this block
    this.cursor = index;
    
    // Invoke callback on this block
    const result = this.callback(targetNode, parent);
    
    if (result === WalkerControl.STOP) {
      this.stopped = true;
      return false;
    }

    // Advance cursor
    this.cursor++;
    return true;
  }

  /**
   * Stop the walk
   */
  stop() {
    this.stopped = true;
  }

  /**
   * Get remaining blocks (for auto-processing children)
   * @param {BlockNode} parentNode - Parent to filter by
   * @returns {Array<{node: BlockNode, parent: BlockNode}>}
   */
  getRemainingChildren(parentNode) {
    const remaining = [];
    
    for (let i = this.cursor + 1; i < this.blocks.length; i++) {
      const { node, parent } = this.blocks[i];
      
      if (parent === parentNode) {
        remaining.push({ node, parent });
      } else if (parent !== parentNode && remaining.length > 0) {
        // We've moved past all children of parentNode
        break;
      }
    }
    
    return remaining;
  }
}

/**
 * Convenience function for simple tree walking
 * @param {BlockNode} tree - Root node
 * @param {Function} callback - (node, parent) => void | false | 'skip'
 * @param {Object} options - Traversal options
 * @returns {boolean} True if completed, false if stopped
 */
export function walk(tree, callback, options = {}) {
  const walker = new TreeWalker(tree, callback, options);
  return walker.walk();
}

/**
 * Find first node matching predicate
 * @param {BlockNode} tree 
 * @param {Function} predicate - (node, parent) => boolean
 * @returns {BlockNode|null}
 */
export function findNode(tree, predicate) {
  let found = null;
  
  walk(tree, (node, parent) => {
    if (predicate(node, parent)) {
      found = node;
      return WalkerControl.STOP;
    }
  });
  
  return found;
}

/**
 * Find all nodes matching predicate
 * @param {BlockNode} tree 
 * @param {Function} predicate - (node, parent) => boolean
 * @returns {Array<BlockNode>}
 */
export function findAllNodes(tree, predicate) {
  const results = [];
  
  walk(tree, (node, parent) => {
    if (predicate(node, parent)) {
      results.push(node);
    }
  });
  
  return results;
}

/**
 * Filter nodes by tag
 * @param {BlockNode} tree 
 * @param {string} tagName 
 * @returns {Array<BlockNode>}
 */
export function findByTag(tree, tagName) {
  return findAllNodes(tree, (node) => {
    return node.tags && node.tags.some(tag => tag.name === tagName);
  });
}

/**
 * Filter nodes by property
 * @param {BlockNode} tree 
 * @param {string} propertyName 
 * @param {*} propertyValue - Optional value to match
 * @returns {Array<BlockNode>}
 */
export function findByProperty(tree, propertyName, propertyValue = undefined) {
  return findAllNodes(tree, (node) => {
    if (!node.properties || !node.properties[propertyName]) {
      return false;
    }
    
    if (propertyValue === undefined) {
      return true; // Just check property exists
    }
    
    return node.properties[propertyName].value === propertyValue;
  });
}

/**
 * Get all ancestors of a node
 * @param {BlockNode} tree 
 * @param {BlockNode} targetNode 
 * @returns {Array<BlockNode>} Array of ancestors (root first)
 */
export function getAncestors(tree, targetNode) {
  const ancestors = [];
  
  walk(tree, (node, parent) => {
    if (node === targetNode) {
      // Build ancestor chain by walking back
      let current = parent;
      const chain = [];
      
      while (current) {
        chain.unshift(current);
        // Find parent's parent
        let foundParent = null;
        walk(tree, (n, p) => {
          if (n === current) {
            foundParent = p;
            return WalkerControl.STOP;
          }
        });
        current = foundParent;
      }
      
      ancestors.push(...chain);
      return WalkerControl.STOP;
    }
  }, { trackParents: true });
  
  return ancestors;
}

/**
 * Export walker utilities
 */
export default {
  TreeWalker,
  MacroWalker,
  TraversalOrder,
  WalkerControl,
  walk,
  findNode,
  findAllNodes,
  findByTag,
  findByProperty,
  getAncestors
};
