/**
 * Comprehensive tests for walker implementation
 * Tests TreeWalker, MacroWalker, and utility functions
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
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
} from '../src/walker/walker.js';
import { BlockNode, createTag, createProperty, createLiteral } from '../src/parser/ast.js';

/**
 * Helper function to create a test tree
 * Creates the following structure:
 * - Root (type: root)
 *   - Child1 (type: child, value: 10)
 *     - GrandChild1 (type: grandchild, value: 5)
 *     - GrandChild2 (type: grandchild, value: 15)
 *   - Child2 (type: child, value: 20)
 */
function createTestTree() {
  const grandchild1 = new BlockNode(
    'GrandChild1',
    { 
      type: createProperty('type', createLiteral('string', 'grandchild')),
      value: createProperty('value', createLiteral('number', 5))
    },
    [],
    []
  );

  const grandchild2 = new BlockNode(
    'GrandChild2',
    { 
      type: createProperty('type', createLiteral('string', 'grandchild')),
      value: createProperty('value', createLiteral('number', 15))
    },
    [],
    []
  );

  const child1 = new BlockNode(
    'Child1',
    { 
      type: createProperty('type', createLiteral('string', 'child')),
      value: createProperty('value', createLiteral('number', 10))
    },
    [grandchild1, grandchild2],
    []
  );

  const child2 = new BlockNode(
    'Child2',
    { 
      type: createProperty('type', createLiteral('string', 'child')),
      value: createProperty('value', createLiteral('number', 20))
    },
    [],
    []
  );

  const root = new BlockNode(
    'Root',
    { type: createProperty('type', createLiteral('string', 'root')) },
    [child1, child2],
    []
  );

  return { root, child1, child2, grandchild1, grandchild2 };
}

// =============================================================================
// 1. Basic depth-first traversal (pre-order, post-order) - 5 tests
// =============================================================================

describe('TreeWalker - Depth-First Traversal', () => {
  test('pre-order traversal visits parent before children', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
    }, { order: TraversalOrder.PRE });

    assert.deepStrictEqual(visited, [
      'Root',
      'Child1',
      'GrandChild1',
      'GrandChild2',
      'Child2'
    ]);
  });

  test('post-order traversal visits children before parent', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
    }, { order: TraversalOrder.POST });

    assert.deepStrictEqual(visited, [
      'GrandChild1',
      'GrandChild2',
      'Child1',
      'Child2',
      'Root'
    ]);
  });

  test('pre-order traversal provides correct parent references', () => {
    const { root, child1 } = createTestTree();
    const parentMap = new Map();

    walk(root, (node, parent) => {
      parentMap.set(node.id, parent ? parent.id : null);
    }, { order: TraversalOrder.PRE });

    assert.strictEqual(parentMap.get('Root'), null);
    assert.strictEqual(parentMap.get('Child1'), 'Root');
    assert.strictEqual(parentMap.get('GrandChild1'), 'Child1');
    assert.strictEqual(parentMap.get('GrandChild2'), 'Child1');
    assert.strictEqual(parentMap.get('Child2'), 'Root');
  });

  test('TreeWalker tracks parent chain correctly', () => {
    const { root } = createTestTree();
    const walker = new TreeWalker(root, (node, parent) => {
      if (node.id === 'GrandChild1') {
        const currentParent = walker.getCurrentParent();
        assert.strictEqual(currentParent.id, 'Child1');
      }
    }, { order: TraversalOrder.PRE, trackParents: true });

    walker.walk();
  });

  test('depth-first traversal handles single node tree', () => {
    const singleNode = new BlockNode('Single', {}, [], []);
    const visited = [];

    walk(singleNode, (node) => {
      visited.push(node.id);
    });

    assert.deepStrictEqual(visited, ['Single']);
  });
});

// =============================================================================
// 2. Breadth-first traversal - 2 tests
// =============================================================================

describe('TreeWalker - Breadth-First Traversal', () => {
  test('breadth-first traversal visits level by level', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
    }, { order: TraversalOrder.BREADTH });

    assert.deepStrictEqual(visited, [
      'Root',
      'Child1',
      'Child2',
      'GrandChild1',
      'GrandChild2'
    ]);
  });

  test('breadth-first traversal provides correct parent references', () => {
    const { root } = createTestTree();
    const parentMap = new Map();

    walk(root, (node, parent) => {
      parentMap.set(node.id, parent ? parent.id : null);
    }, { order: TraversalOrder.BREADTH });

    assert.strictEqual(parentMap.get('Root'), null);
    assert.strictEqual(parentMap.get('Child1'), 'Root');
    assert.strictEqual(parentMap.get('Child2'), 'Root');
    assert.strictEqual(parentMap.get('GrandChild1'), 'Child1');
    assert.strictEqual(parentMap.get('GrandChild2'), 'Child1');
  });
});

// =============================================================================
// 3. Early termination and skip - 2 tests
// =============================================================================

describe('TreeWalker - Control Flow', () => {
  test('WalkerControl.STOP terminates traversal early', () => {
    const { root } = createTestTree();
    const visited = [];

    const result = walk(root, (node) => {
      visited.push(node.id);
      if (node.id === 'Child1') {
        return WalkerControl.STOP;
      }
    }, { order: TraversalOrder.PRE });

    assert.strictEqual(result, false);
    assert.deepStrictEqual(visited, ['Root', 'Child1']);
  });

  test('WalkerControl.SKIP skips children of current node', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
      if (node.id === 'Child1') {
        return WalkerControl.SKIP;
      }
    }, { order: TraversalOrder.PRE });

    assert.deepStrictEqual(visited, [
      'Root',
      'Child1',
      'Child2'
    ]);
  });
});

// =============================================================================
// 4. Filtering - 2 tests
// =============================================================================

describe('TreeWalker - Filtering', () => {
  test('filter option excludes non-matching nodes', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
    }, {
      order: TraversalOrder.PRE,
      filter: (node) => {
        const typeProperty = node.properties.type;
        return typeProperty && 
               (typeProperty.value.value === 'child' || typeProperty.value.value === 'root');
      }
    });

    assert.deepStrictEqual(visited, ['Root', 'Child1', 'Child2']);
  });

  test('filter can use parent context for filtering', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
    }, {
      order: TraversalOrder.PRE,
      filter: (node, parent) => {
        return parent === null || parent.id === 'Root';
      }
    });

    assert.deepStrictEqual(visited, ['Root', 'Child1', 'Child2']);
  });
});

// =============================================================================
// 5. Utility functions (findNode, findAllNodes, findByTag, findByProperty) - 6 tests
// =============================================================================

describe('Utility Functions', () => {
  test('findNode returns first matching node', () => {
    const { root, grandchild1 } = createTestTree();

    const found = findNode(root, (node) => {
      return node.id === 'GrandChild1';
    });

    assert.strictEqual(found, grandchild1);
  });

  test('findNode returns null if no match found', () => {
    const { root } = createTestTree();

    const found = findNode(root, (node) => {
      return node.id === 'NonExistent';
    });

    assert.strictEqual(found, null);
  });

  test('findAllNodes returns all matching nodes', () => {
    const { root } = createTestTree();

    const found = findAllNodes(root, (node) => {
      const typeProperty = node.properties.type;
      return typeProperty && typeProperty.value.value === 'grandchild';
    });

    assert.strictEqual(found.length, 2);
    assert.strictEqual(found[0].id, 'GrandChild1');
    assert.strictEqual(found[1].id, 'GrandChild2');
  });

  test('findByTag finds nodes with specific tag', () => {
    const { root } = createTestTree();
    
    root.children[0].tags.push(createTag('definition', 'component'));
    root.children[1].tags.push(createTag('instance', 'component'));

    const found = findByTag(root, 'component');

    assert.strictEqual(found.length, 2);
    assert.strictEqual(found[0].id, 'Child1');
    assert.strictEqual(found[1].id, 'Child2');
  });

  test('findByProperty finds nodes with specific property', () => {
    const { root } = createTestTree();

    const found = findByProperty(root, 'value');

    assert.strictEqual(found.length, 4);
  });
  test('findByProperty can match property value', () => {
    const { root } = createTestTree();

    // findByProperty compares PropertyNode.value (LiteralNode object) with propertyValue
    // We need to pass the actual literal value that the property contains
    const child1 = root.children[0];
    const expectedLiteral = child1.properties.value.value;
    
    const found = findByProperty(root, 'value', expectedLiteral);

    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].id, 'Child1');
  });
});

// =============================================================================
// 6. MacroWalker cursor control (nextBlock, invokeWalk, back, getRemainingChildren) - 5 tests
// =============================================================================

describe('MacroWalker - Cursor Control', () => {
  test('nextBlock peeks at next node without advancing', () => {
    const { root } = createTestTree();
    let peekCount = 0;

    const walker = new MacroWalker(root, (node) => {
      if (node.id === 'Root') {
        const next = walker.nextBlock();
        assert.strictEqual(next.id, 'Child1');
        peekCount++;
      }
    });

    walker.walk();
    assert.strictEqual(peekCount, 1);
  });

  test('invokeWalk allows jumping to specific block', () => {
    const { root } = createTestTree();
    const visited = [];

    const walker = new MacroWalker(root, (node) => {
      visited.push(node.id);
      
      if (node.id === 'Root') {
        const child2 = node.children[1];
        walker.invokeWalk(child2, node);
        return WalkerControl.SKIP;
      }
    });

    walker.walk();
    
    assert.ok(visited.includes('Root'));
    assert.ok(visited.includes('Child2'));
  });

  test('back moves cursor backward', () => {
    const { root } = createTestTree();
    const visited = [];
    let movedBack = false;

    const walker = new MacroWalker(root, (node) => {
      visited.push(node.id);

      if (node.id === 'Child1' && !movedBack) {
        walker.back(2);
        movedBack = true;
      }
    });

    walker.walk();

    const child1Count = visited.filter(id => id === 'Child1').length;
    assert.strictEqual(child1Count, 2);
  });

  test('getRemainingChildren returns children of specific parent', () => {
    const { root } = createTestTree();

    const walker = new MacroWalker(root, (node) => {
      if (node.id === 'Child1') {
        const remaining = walker.getRemainingChildren(node);
        
        assert.strictEqual(remaining.length, 2);
        assert.strictEqual(remaining[0].node.id, 'GrandChild1');
        assert.strictEqual(remaining[1].node.id, 'GrandChild2');
        assert.strictEqual(remaining[0].parent, node);
      }
    });

    walker.walk();
  });

  test('current returns current block with parent', () => {
    const { root } = createTestTree();

    const walker = new MacroWalker(root, (node, parent) => {
      const current = walker.current();
      
      assert.strictEqual(current.node, node);
      assert.strictEqual(current.parent, parent);
    });

    walker.walk();
  });
});

// =============================================================================
// 7. MacroWalker auto-processing - 2 tests
// =============================================================================

describe('MacroWalker - Auto-processing', () => {
  test('MacroWalker processes all blocks in flattened order', () => {
    const { root } = createTestTree();
    const visited = [];

    const walker = new MacroWalker(root, (node) => {
      visited.push(node.id);
    });

    walker.walk();

    assert.deepStrictEqual(visited, [
      'Root',
      'Child1',
      'GrandChild1',
      'GrandChild2',
      'Child2'
    ]);
  });

  test('MacroWalker stop method halts traversal', () => {
    const { root } = createTestTree();
    const visited = [];

    const walker = new MacroWalker(root, (node) => {
      visited.push(node.id);
      
      if (node.id === 'GrandChild1') {
        walker.stop();
      }
    });

    const result = walker.walk();

    assert.strictEqual(result, false);
    assert.deepStrictEqual(visited, [
      'Root',
      'Child1',
      'GrandChild1'
    ]);
  });
});

// =============================================================================
// Additional edge cases and integration tests
// =============================================================================

describe('Edge Cases and Integration', () => {
  test('getAncestors returns correct ancestor chain', () => {
    const { root, grandchild1 } = createTestTree();

    const ancestors = getAncestors(root, grandchild1);

    assert.strictEqual(ancestors.length, 2);
    assert.strictEqual(ancestors[0].id, 'Root');
    assert.strictEqual(ancestors[1].id, 'Child1');
  });

  test('getAncestors returns empty array for root node', () => {
    const { root } = createTestTree();

    const ancestors = getAncestors(root, root);

    assert.strictEqual(ancestors.length, 0);
  });

  test('walk handles empty children array', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root.children[1], (node) => {
      visited.push(node.id);
    });

    assert.deepStrictEqual(visited, ['Child2']);
  });

  test('walk handles null tree gracefully', () => {
    const visited = [];

    const result = walk(null, (node) => {
      visited.push(node.id);
    });

    assert.strictEqual(result, true);
    assert.strictEqual(visited.length, 0);
  });

  test('filter with SKIP control works correctly', () => {
    const { root } = createTestTree();
    const visited = [];

    walk(root, (node) => {
      visited.push(node.id);
      
      if (node.id === 'Root') {
        return WalkerControl.SKIP;
      }
    }, {
      order: TraversalOrder.PRE,
      filter: (node) => true
    });

    assert.deepStrictEqual(visited, ['Root']);
  });

  test('MacroWalker peekNext returns null at end', () => {
    const singleNode = new BlockNode('Single', {}, [], []);
    
    const walker = new MacroWalker(singleNode, (node) => {
      const next = walker.peekNext();
      assert.strictEqual(next, null);
    });

    walker.walk();
  });

  test('complex tree traversal with mixed controls', () => {
    const { root } = createTestTree();
    const visited = [];
    const skipped = [];

    walk(root, (node) => {
      visited.push(node.id);
      
      if (node.id === 'Child1') {
        skipped.push('Child1-children');
        return WalkerControl.SKIP;
      }
    }, { order: TraversalOrder.PRE });

    assert.deepStrictEqual(visited, ['Root', 'Child1', 'Child2']);
    assert.deepStrictEqual(skipped, ['Child1-children']);
  });
});
