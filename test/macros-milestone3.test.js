/**
 * Comprehensive tests for Milestone 3: Cursor Control API
 *
 * Tests the macro system's cursor control functionality:
 * - nextBlock() - Peek at next block without advancing
 * - peekNext() - Peek at next block with parent
 * - current() - Get current block with parent
 * - invokeWalk() - Manually process specific blocks
 * - back() - Move cursor backward
 * - getRemainingChildren() - Get unprocessed children
 * - stop() - Halt traversal
 * - Auto-processing of children not manually walked
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import {
  createEnhancedMacroContext,
  MacroError,
} from "../src/preprocessor/macros.js";
import { parse } from "../src/parser/parser.js";
import { Transaction } from "../src/transaction/transaction.js";
import { DataSourceProcessor } from "../src/preprocessor/datasources.js";
import { TemplateExpander } from "../src/preprocessor/templates.js";

// =============================================================================
// 1. Basic cursor control - nextBlock, peekNext, current - 3 tests
// =============================================================================

describe("Milestone 3: Cursor Control - Basic Operations", () => {
  test("nextBlock() peeks at next block without advancing", () => {
    const ctx = createEnhancedMacroContext();
    const peekedBlocks = [];

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Parent") {
        // Peek at next block (should be Child)
        const next = ctx.macros.nextBlock();
        if (next) {
          peekedBlocks.push(next.id);
        }
      }
    };

    const input = `
      [Parent
        [Child]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(
      peekedBlocks.length,
      1,
      "Should have peeked at one block",
    );
    assert.strictEqual(peekedBlocks[0], "Child", "Should peek at Child");
  });

  test("peekNext() returns block with parent context", () => {
    const ctx = createEnhancedMacroContext();
    let peekedInfo = null;

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Container") {
        const next = ctx.macros.peekNext();
        if (next) {
          peekedInfo = {
            nodeId: next.node.id,
            parentId: next.parent ? next.parent.id : null,
          };
        }
      }
    };

    const input = `
      [Container
        [Header]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.ok(peekedInfo, "Should have peeked at next block");
    assert.strictEqual(peekedInfo.nodeId, "Header");
    assert.strictEqual(peekedInfo.parentId, "Container");
  });

  test("current() returns current block with parent", () => {
    const ctx = createEnhancedMacroContext();
    let currentInfo = null;

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Child") {
        const curr = ctx.macros.current();
        if (curr) {
          currentInfo = {
            nodeId: curr.node.id,
            parentId: curr.parent ? curr.parent.id : null,
          };
        }
      }
    };

    const input = `
      [Parent
        [Child]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.ok(currentInfo, "Should have current block info");
    assert.strictEqual(currentInfo.nodeId, "Child");
    assert.strictEqual(currentInfo.parentId, "Parent");
  });
});

// =============================================================================
// 2. Manual walk invocation - invokeWalk - 3 tests
// =============================================================================

describe("Milestone 3: Manual Walk Invocation", () => {
  test("invokeWalk() manually processes a child block", () => {
    const ctx = createEnhancedMacroContext();
    const processedBlocks = [];
    let manuallyProcessedChild = false;

    ctx.macros.onWalk = function (block, parent) {
      processedBlocks.push(block.id);

      if (block.id === "Parent" && block.children && block.children.length > 0) {
        // Manually process first child
        const child = block.children[0];
        manuallyProcessedChild = true;
        ctx.macros.invokeWalk(child, block);
      }
    };

    const input = `
      [Parent
        [Child (width: 100)]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    assert.strictEqual(manuallyProcessedChild, true, "Child should be manually processed");
    assert.ok(
      processedBlocks.includes("Child"),
      "Child should appear in processed blocks",
    );

    // Verify child properties were evaluated
    assert.strictEqual(result[0].children[0].properties.width.value, 100);
  });

  test("invokeWalk() evaluates properties before calling onWalk", () => {
    const ctx = createEnhancedMacroContext();
    let childPropType = null;

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Parent" && block.children && block.children.length > 0) {
        const child = block.children[0];
        ctx.macros.invokeWalk(child, block);
      }

      if (block.id === "Child") {
        // When onWalk is called on Child, properties should be evaluated
        childPropType = block.properties.size.type;
      }
    };

    const input = `
      [Parent
        [Child (size: (50 + 50))]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(
      childPropType,
      "Literal",
      "Child property should be evaluated before onWalk",
    );
  });

  test("invokeWalk() processes grandchildren correctly", () => {
    const ctx = createEnhancedMacroContext();
    const visitOrder = [];

    ctx.macros.onWalk = function (block, parent) {
      visitOrder.push(block.id);

      if (block.id === "Parent" && block.children && block.children.length > 0) {
        // Manually process first child
        ctx.macros.invokeWalk(block.children[0], block);
      }
    };

    const input = `
      [Parent
        [Child
          [GrandChild]
        ]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.ok(visitOrder.includes("Parent"));
    assert.ok(visitOrder.includes("Child"));
    assert.ok(visitOrder.includes("GrandChild"));
    assert.ok(
      visitOrder.indexOf("Child") > visitOrder.indexOf("Parent"),
      "Child should be visited after Parent",
    );
    assert.ok(
      visitOrder.indexOf("GrandChild") > visitOrder.indexOf("Child"),
      "GrandChild should be visited after Child",
    );
  });
});

// =============================================================================
// 3. Auto-processing behavior - 4 tests
// =============================================================================

describe("Milestone 3: Auto-processing", () => {
  test("children not manually walked are auto-processed", () => {
    const ctx = createEnhancedMacroContext();
    const visitedBlocks = [];

    ctx.macros.onWalk = function (block, parent) {
      visitedBlocks.push(block.id);

      // Parent doesn't manually process children
      // They should be auto-processed
    };

    const input = `
      [Parent
        [Child1]
        [Child2]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(visitedBlocks.length, 3, "All 3 blocks should be visited");
    assert.ok(visitedBlocks.includes("Parent"));
    assert.ok(visitedBlocks.includes("Child1"));
    assert.ok(visitedBlocks.includes("Child2"));
  });

  test("mix of manual and auto-processed children", () => {
    const ctx = createEnhancedMacroContext();
    const visitedBlocks = [];
    let child1Manual = false;

    ctx.macros.onWalk = function (block, parent) {
      visitedBlocks.push(block.id);

      if (block.id === "Parent" && block.children && block.children.length >= 2) {
        // Manually process first child only
        child1Manual = true;
        ctx.macros.invokeWalk(block.children[0], block);
        // Second child should be auto-processed
      }
    };

    const input = `
      [Parent
        [Child1]
        [Child2]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(child1Manual, true, "Child1 was manually processed");
    assert.strictEqual(visitedBlocks.length, 3, "All blocks visited");
    assert.ok(visitedBlocks.includes("Child1"), "Child1 visited");
    assert.ok(visitedBlocks.includes("Child2"), "Child2 auto-processed");
  });

  test("deeply nested auto-processing works correctly", () => {
    const ctx = createEnhancedMacroContext();
    const visitedBlocks = [];

    ctx.macros.onWalk = function (block, parent) {
      visitedBlocks.push(block.id);
      // No manual processing - everything auto-processes
    };

    const input = `
      [Level1
        [Level2
          [Level3
            [Level4]
          ]
        ]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(visitedBlocks.length, 4, "All 4 levels visited");
    assert.deepStrictEqual(
      visitedBlocks,
      ["Level1", "Level2", "Level3", "Level4"],
      "Blocks visited in correct order",
    );
  });

  test("auto-processing respects property evaluation", () => {
    const ctx = createEnhancedMacroContext();
    const childProps = [];

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Child") {
        // Child was auto-processed, properties should be evaluated
        childProps.push({
          id: block.id,
          type: block.properties.width.type,
          value: block.properties.width.value,
        });
      }
    };

    const input = `
      <set margin = 20>
      [Parent
        [Child (width: (margin * 5))]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(childProps.length, 1);
    assert.strictEqual(childProps[0].type, "Literal");
    assert.strictEqual(childProps[0].value, 100);
  });
});

// =============================================================================
// 4. Advanced use cases - 5 tests
// =============================================================================

describe("Milestone 3: Advanced Use Cases", () => {
  test("Use case: Auto-sizing container from children", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      // Check if block has auto-size property
      if (block.properties["auto-size"] && block.properties["auto-size"].value === true) {
        let totalWidth = 0;
        let totalHeight = 0;

        // Manually process all children to get their dimensions
        if (block.children && block.children.length > 0) {
          for (const child of block.children) {
            // Manually invoke walk on each child
            ctx.macros.invokeWalk(child, block);

            // Read child dimensions
            const childWidth = child.properties.width
              ? child.properties.width.value
              : 0;
            const childHeight = child.properties.height
              ? child.properties.height.value
              : 0;

            totalWidth += childWidth;
            totalHeight = Math.max(totalHeight, childHeight);
          }
        }

        // Set computed dimensions on parent
        block.properties.width = {
          type: "Literal",
          valueType: "number",
          value: totalWidth,
        };
        block.properties.height = {
          type: "Literal",
          valueType: "number",
          value: totalHeight,
        };
      }
    };

    const input = `
      [Container (auto-size: true)
        [Box1 (width: 100, height: 50)]
        [Box2 (width: 150, height: 75)]
        [Box3 (width: 50, height: 60)]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    // Container should have computed dimensions
    assert.strictEqual(result[0].properties.width.value, 300, "Total width");
    assert.strictEqual(result[0].properties.height.value, 75, "Max height");
  });

  test("Use case: Conditional child processing based on visibility", () => {
    const ctx = createEnhancedMacroContext();
    const processedChildren = [];

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Container" && block.children) {
        // Manually process only visible children
        for (const child of block.children) {
          // Check if child should be visible (peek at properties)
          if (
            !child.properties.visible ||
            child.properties.visible.value !== false
          ) {
            ctx.macros.invokeWalk(child, block);
            processedChildren.push(child.id);
          }
        }
      }
    };

    const input = `
      [Container
        [Visible1 (visible: true)]
        [Hidden (visible: false)]
        [Visible2]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(processedChildren.length, 2, "Only 2 children processed");
    assert.ok(processedChildren.includes("Visible1"));
    assert.ok(processedChildren.includes("Visible2"));
    assert.ok(!processedChildren.includes("Hidden"));
  });

  test("Use case: Peek and validate before processing", () => {
    const ctx = createEnhancedMacroContext();
    const validationResults = [];

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Form" && block.children) {
        // Peek at all children first to validate structure
        for (const child of block.children) {
          // Validate: Form children must have 'name' property
          if (!child.properties.name) {
            validationResults.push({
              id: child.id,
              valid: false,
              reason: "Missing name property",
            });
          } else {
            validationResults.push({
              id: child.id,
              valid: true,
            });
            // Only process valid children
            ctx.macros.invokeWalk(child, block);
          }
        }
      }
    };

    const input = `
      [Form
        [Input (name: "email")]
        [InvalidInput]
        [Button (name: "submit")]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(validationResults.length, 3);
    assert.strictEqual(validationResults[0].valid, true);
    assert.strictEqual(validationResults[1].valid, false);
    assert.strictEqual(validationResults[2].valid, true);
  });

  test("Use case: Compute relative positions from siblings", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Layout" && block.children) {
        let currentX = 0;

        // Process children in order, computing X position based on previous
        for (const child of block.children) {
          // Manually process child
          ctx.macros.invokeWalk(child, block);

          // Set X position
          child.properties.x = {
            type: "Literal",
            valueType: "number",
            value: currentX,
          };

          // Update position for next child
          const childWidth = child.properties.width
            ? child.properties.width.value
            : 0;
          currentX += childWidth;
        }
      }
    };

    const input = `
      [Layout
        [Item1 (width: 100)]
        [Item2 (width: 150)]
        [Item3 (width: 75)]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    assert.strictEqual(result[0].children[0].properties.x.value, 0);
    assert.strictEqual(result[0].children[1].properties.x.value, 100);
    assert.strictEqual(result[0].children[2].properties.x.value, 250);
  });

  test("Use case: Process children in reverse order", () => {
    const ctx = createEnhancedMacroContext();
    const processingOrder = [];

    ctx.macros.onWalk = function (block, parent) {
      processingOrder.push(block.id);

      if (block.id === "Stack" && block.children) {
        // Process children in reverse order
        for (let i = block.children.length - 1; i >= 0; i--) {
          ctx.macros.invokeWalk(block.children[i], block);
        }
      }
    };

    const input = `
      [Stack
        [First]
        [Second]
        [Third]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(processingOrder[0], "Stack");
    // Children should be processed in reverse order
    const childOrder = processingOrder.slice(1);
    assert.deepStrictEqual(childOrder, ["Third", "Second", "First"]);
  });
});

// =============================================================================
// 5. Error handling - 3 tests
// =============================================================================

describe("Milestone 3: Error Handling", () => {
  test("cursor control methods throw error outside onWalk", () => {
    const ctx = createEnhancedMacroContext();

    // Trying to use nextBlock outside of onWalk should throw
    assert.throws(
      () => {
        ctx.macros.nextBlock();
      },
      {
        name: "MacroError",
        message: /can only be called within onWalk callback/,
      },
    );
  });

  test("invokeWalk throws error outside onWalk", () => {
    const ctx = createEnhancedMacroContext();

    const input = `[Container [Child]]`;
    const tree = parse(input);

    assert.throws(
      () => {
        ctx.macros.invokeWalk(tree.blocks[0], null);
      },
      {
        name: "MacroError",
        message: /can only be called within onWalk callback/,
      },
    );
  });

  test("errors in manually invoked blocks are caught and wrapped", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Parent" && block.children) {
        // This will cause Child's onWalk to execute, which throws
        ctx.macros.invokeWalk(block.children[0], block);
      }

      if (block.id === "Child") {
        throw new Error("Child validation failed");
      }
    };

    const input = `
      [Parent
        [Child]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    assert.throws(
      () => {
        expander.expandTemplates(tree);
      },
      {
        name: "MacroError",
        message: /Error in onWalk callback for block 'Child'/,
      },
    );
  });
});

// =============================================================================
// 6. Integration tests - 3 tests
// =============================================================================

describe("Milestone 3: Integration Tests", () => {
  test("cursor control works with templates (foreach, if)", () => {
    const ctx = createEnhancedMacroContext();
    const visitedBlocks = [];

    ctx.macros.onWalk = function (block, parent) {
      visitedBlocks.push(block.id);
    };

    const input = `
      <set items = {1, 2, 3}>
      <if (true)>
        [Container
          <foreach (item in items)>
            [Item]
          </foreach>
        ]
      </if>
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.ok(visitedBlocks.includes("Container"));
    assert.strictEqual(
      visitedBlocks.filter((id) => id === "Item").length,
      3,
      "Should have 3 Item blocks from foreach",
    );
  });

  test("Milestone 2 and 3 work together correctly", () => {
    const ctx = createEnhancedMacroContext();
    const blockInfo = [];

    ctx.macros.onWalk = function (block, parent) {
      blockInfo.push({
        id: block.id,
        parentId: parent ? parent.id : null,
        propsEvaluated: block.properties.width
          ? block.properties.width.type === "Literal"
          : true,
      });

      // Manually process first child if exists
      if (block.children && block.children.length > 0) {
        ctx.macros.invokeWalk(block.children[0], block);
      }
    };

    const input = `
      <set baseWidth = 100>
      [Container (width: (baseWidth * 2))
        [Child (width: (baseWidth))]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    // All properties should be evaluated before onWalk
    assert.ok(
      blockInfo.every((info) => info.propsEvaluated),
      "All properties should be evaluated",
    );

    // Parent-child relationship should be correct
    assert.strictEqual(blockInfo[0].id, "Container");
    assert.strictEqual(blockInfo[0].parentId, null);
    assert.strictEqual(blockInfo[1].id, "Child");
    assert.strictEqual(blockInfo[1].parentId, "Container");
  });

  test("complex nested structure with mixed manual and auto-processing", () => {
    const ctx = createEnhancedMacroContext();
    const processingInfo = new Map();

    ctx.macros.onWalk = function (block, parent) {
      processingInfo.set(block.id, {
        parentId: parent ? parent.id : null,
      });

      // Container: manually process first child only
      if (block.id === "Container" && block.children && block.children.length > 0) {
        ctx.macros.invokeWalk(block.children[0], block);
      }

      // Section1: manually process all children
      if (block.id === "Section1" && block.children) {
        for (const child of block.children) {
          ctx.macros.invokeWalk(child, block);
        }
      }

      // Section2: auto-process children (do nothing)
    };

    const input = `
      [Container
        [Section1
          [Item1]
          [Item2]
        ]
        [Section2
          [Item3]
          [Item4]
        ]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    // All blocks should be processed
    assert.strictEqual(processingInfo.size, 7, "All 7 blocks should be processed");

    // Verify parent relationships
    assert.strictEqual(processingInfo.get("Container").parentId, null);
    assert.strictEqual(processingInfo.get("Section1").parentId, "Container");
    assert.strictEqual(processingInfo.get("Section2").parentId, "Container");
    assert.strictEqual(processingInfo.get("Item1").parentId, "Section1");
    assert.strictEqual(processingInfo.get("Item2").parentId, "Section1");
    assert.strictEqual(processingInfo.get("Item3").parentId, "Section2");
    assert.strictEqual(processingInfo.get("Item4").parentId, "Section2");
  });
});
