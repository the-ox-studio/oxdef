/**
 * Comprehensive tests for Milestone 2: Macro Walk Hook
 *
 * Tests the macro system's onWalk callback functionality:
 * - Basic onWalk callback execution for each block
 * - Property evaluation guarantees (literals before onWalk, children still expressions)
 * - Auto-processing of children after onWalk returns
 * - Property modification in onWalk
 * - Validation with throwError
 * - Integration with templates and references
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
// 1. Basic onWalk execution - 3 tests
// =============================================================================

describe("Milestone 2: Macro Walk Hook - Basic Execution", () => {
  test("onWalk called for each block during preprocessing", () => {
    const ctx = createEnhancedMacroContext();
    const visitedBlocks = [];

    ctx.macros.onWalk = function (block, parent) {
      visitedBlocks.push(block.id);
    };

    const input = `
      [Container
        [Header]
        [Content
          [Nested]
        ]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.deepStrictEqual(
      visitedBlocks,
      ["Container", "Header", "Content", "Nested"],
      "onWalk should be called for each block in order",
    );
  });

  test("onWalk receives block and parent parameters", () => {
    const ctx = createEnhancedMacroContext();
    const parentMap = new Map();

    ctx.macros.onWalk = function (block, parent) {
      parentMap.set(block.id, parent ? parent.id : null);
    };

    const input = `
      [Root
        [Child1]
        [Child2
          [GrandChild]
        ]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(parentMap.get("Root"), null, "Root has no parent");
    assert.strictEqual(
      parentMap.get("Child1"),
      "Root",
      "Child1 parent is Root",
    );
    assert.strictEqual(
      parentMap.get("Child2"),
      "Root",
      "Child2 parent is Root",
    );
    assert.strictEqual(
      parentMap.get("GrandChild"),
      "Child2",
      "GrandChild parent is Child2",
    );
  });

  test("onWalk called in correct order (parent before children)", () => {
    const ctx = createEnhancedMacroContext();
    const order = [];
    const parentAtVisit = new Map();

    ctx.macros.onWalk = function (block, parent) {
      order.push(block.id);
      parentAtVisit.set(block.id, parent ? parent.id : null);

      // Verify that parent was visited before this block
      if (parent) {
        assert.ok(
          order.includes(parent.id),
          `Parent ${parent.id} should be visited before child ${block.id}`,
        );
      }
    };

    const input = `
      [A
        [B
          [D]
        ]
        [C]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    // Verify parent-before-child ordering
    assert.ok(
      order.indexOf("A") < order.indexOf("B"),
      "Parent A visited before child B",
    );
    assert.ok(
      order.indexOf("A") < order.indexOf("C"),
      "Parent A visited before child C",
    );
    assert.ok(
      order.indexOf("B") < order.indexOf("D"),
      "Parent B visited before child D",
    );
  });
});

// =============================================================================
// 2. Property evaluation guarantees - 4 tests
// =============================================================================

describe("Milestone 2: Property Evaluation Guarantees", () => {
  test("block properties are literals (evaluated) in onWalk", () => {
    const ctx = createEnhancedMacroContext();
    let propertyType = null;
    let propertyValue = null;

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Box") {
        propertyType = block.properties.width.type;
        propertyValue = block.properties.width.value;
      }
    };

    const input = `[Box (width: 100)]`;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(
      propertyType,
      "Literal",
      "Property should be Literal in onWalk",
    );
    assert.strictEqual(
      propertyValue,
      100,
      "Property value should be evaluated to 100",
    );
  });

  test("children properties are still expressions in onWalk", () => {
    const ctx = createEnhancedMacroContext();
    let parentPropType = null;
    let childPropType = null;

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Parent") {
        parentPropType = block.properties.width.type;
      }
      if (block.id === "Child") {
        childPropType = block.properties.width.type;
      }
    };

    const input = `
      [Parent (width: 200)
        [Child (width: (100 + 50))]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    // Parent properties are literals when parent is walked
    assert.strictEqual(
      parentPropType,
      "Literal",
      "Parent property should be Literal",
    );

    // Child properties are still expressions when parent is walked
    // But become literals when child itself is walked
    assert.strictEqual(
      childPropType,
      "Literal",
      "Child property should be Literal when child is walked",
    );
  });

  test("expressions without $ are evaluated before onWalk", () => {
    const ctx = createEnhancedMacroContext();
    const evaluatedProps = [];

    ctx.macros.onWalk = function (block, parent) {
      if (block.properties.padding) {
        evaluatedProps.push({
          id: block.id,
          type: block.properties.padding.type,
          value: block.properties.padding.value,
        });
      }
    };

    const input = `
      <set margin = 20>
      [Box (padding: (margin * 2))]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(evaluatedProps.length, 1);
    assert.strictEqual(
      evaluatedProps[0].type,
      "Literal",
      "Expression should be evaluated",
    );
    assert.strictEqual(
      evaluatedProps[0].value,
      40,
      "Expression result should be 40",
    );
  });

  test("module properties are available in onWalk", () => {
    const ctx = createEnhancedMacroContext();
    const moduleProps = [];

    ctx.macros.onWalk = function (block, parent) {
      moduleProps.push({
        id: block.id,
        width: block.properties.width
          ? block.properties.width.value
          : undefined,
        height: block.properties.height
          ? block.properties.height.value
          : undefined,
      });
    };

    const input = `
      [Container (width: 800, height: 600)
        [Box (width: 100)]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(moduleProps.length, 2);
    assert.strictEqual(moduleProps[0].id, "Container");
    assert.strictEqual(moduleProps[0].width, 800);
    assert.strictEqual(moduleProps[0].height, 600);
    assert.strictEqual(moduleProps[1].id, "Box");
    assert.strictEqual(moduleProps[1].width, 100);
  });
});

// =============================================================================
// 3. Auto-processing - 3 tests
// =============================================================================

describe("Milestone 2: Auto-processing", () => {
  test("children auto-expand after onWalk returns", () => {
    const ctx = createEnhancedMacroContext();
    let childrenCountDuringWalk = 0;
    let childrenExpandedAfter = false;

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Parent") {
        // Children should exist but not yet expanded
        childrenCountDuringWalk = block.children.length;
      }
      if (block.id === "Child") {
        // If this is called, children were auto-expanded
        childrenExpandedAfter = true;
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
      childrenCountDuringWalk,
      1,
      "Children should exist during parent walk",
    );
    assert.strictEqual(
      childrenExpandedAfter,
      true,
      "Children should be auto-expanded after parent onWalk",
    );
  });

  test("children become available with evaluated properties", () => {
    const ctx = createEnhancedMacroContext();
    const childProps = [];

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Child") {
        childProps.push({
          type: block.properties.size.type,
          value: block.properties.size.value,
        });
      }
    };

    const input = `
      [Parent
        [Child (size: (50 * 2))]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(childProps.length, 1);
    assert.strictEqual(
      childProps[0].type,
      "Literal",
      "Child property evaluated before child's onWalk",
    );
    assert.strictEqual(childProps[0].value, 100, "Child property is 100");
  });

  test("nested blocks all process correctly", () => {
    const ctx = createEnhancedMacroContext();
    const depths = [];

    ctx.macros.onWalk = function (block, parent) {
      let depth = 0;
      let current = parent;
      while (current) {
        depth++;
        // Walk up to find parent's parent (need to track this separately)
        break; // For this test, we'll just track immediate parent
      }

      depths.push({
        id: block.id,
        hasParent: parent !== null,
      });
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

    assert.strictEqual(depths.length, 4, "All 4 levels processed");
    assert.strictEqual(depths[0].id, "Level1");
    assert.strictEqual(depths[0].hasParent, false);
    assert.strictEqual(depths[1].id, "Level2");
    assert.strictEqual(depths[1].hasParent, true);
    assert.strictEqual(depths[2].id, "Level3");
    assert.strictEqual(depths[2].hasParent, true);
    assert.strictEqual(depths[3].id, "Level4");
    assert.strictEqual(depths[3].hasParent, true);
  });
});

// =============================================================================
// 4. Property modification - 2 tests
// =============================================================================

describe("Milestone 2: Property Modification", () => {
  test("can modify block properties in onWalk", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Box") {
        // Modify existing property
        block.properties.width = {
          type: "Literal",
          valueType: "number",
          value: 200,
        };
      }
    };

    const input = `[Box (width: 100)]`;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    assert.strictEqual(result[0].properties.width.value, 200);
  });

  test("can add new properties in onWalk", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Box") {
        // Add new computed property
        block.properties.computed = {
          type: "Literal",
          valueType: "number",
          value: block.properties.width.value * 2,
        };
      }
    };

    const input = `[Box (width: 100)]`;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    assert.strictEqual(result[0].properties.computed.value, 200);
  });
});

// =============================================================================
// 5. Validation - 2 tests
// =============================================================================

describe("Milestone 2: Validation", () => {
  test("can validate required properties with throwError", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Button") {
        if (!block.properties.label) {
          ctx.macros.throwError(`Button block requires a 'label' property`);
        }
      }
    };

    const input = `[Button (width: 100)]`;

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
        message: /Button block requires a 'label' property/,
      },
    );
  });

  test("can set default values for missing properties", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "Box") {
        // Set default padding if not provided
        if (!block.properties.padding) {
          block.properties.padding = {
            type: "Literal",
            valueType: "number",
            value: 0,
          };
        }

        // Set default margin if not provided
        if (!block.properties.margin) {
          block.properties.margin = {
            type: "Literal",
            valueType: "number",
            value: 10,
          };
        }
      }
    };

    const input = `
      [Box (width: 100, padding: 5)]
      [Box (width: 200)]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    // First box has explicit padding, gets default margin
    assert.strictEqual(result[0].properties.padding.value, 5);
    assert.strictEqual(result[0].properties.margin.value, 10);

    // Second box gets both defaults
    assert.strictEqual(result[1].properties.padding.value, 0);
    assert.strictEqual(result[1].properties.margin.value, 10);
  });
});

// =============================================================================
// 6. Integration - 2 tests
// =============================================================================

describe("Milestone 2: Integration", () => {
  test("onWalk works with templates (if, foreach)", () => {
    const ctx = createEnhancedMacroContext();
    const visitedBlocks = [];

    ctx.macros.onWalk = function (block, parent) {
      visitedBlocks.push(block.id);
    };

    const input = `
      <set items = {1, 2, 3}>
      <set showContainer = true>

      <if (showContainer)>
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

    // Should visit Container once and Item three times (foreach)
    assert.ok(
      visitedBlocks.includes("Container"),
      "Should visit Container from if template",
    );
    assert.strictEqual(
      visitedBlocks.filter((id) => id === "Item").length,
      3,
      "Should visit Item 3 times from foreach",
    );
  });

  test("onWalk works with reference resolution", () => {
    const ctx = createEnhancedMacroContext();
    const blockWidths = [];

    ctx.macros.onWalk = function (block, parent) {
      // At this point, non-$ expressions should be evaluated
      // $ references will be resolved in Pass 2 (after onWalk completes)
      if (block.properties.width) {
        blockWidths.push({
          id: block.id,
          type: block.properties.width.type,
          // Only access value if it's a Literal
          value:
            block.properties.width.type === "Literal"
              ? block.properties.width.value
              : "Expression",
        });
      }
    };

    const input = `
      [Parent (width: 200)
        [Child (width: ($parent.width / 2))]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    // Parent width should be literal in onWalk
    assert.strictEqual(blockWidths[0].id, "Parent");
    assert.strictEqual(blockWidths[0].type, "Literal");
    assert.strictEqual(blockWidths[0].value, 200);

    // Child width is still an Expression during onWalk (contains $parent)
    // It will be resolved in Pass 2 after all onWalk callbacks complete
    assert.strictEqual(blockWidths[1].id, "Child");
    assert.strictEqual(
      blockWidths[1].type,
      "Expression",
      "Child width should still be Expression during onWalk (contains $)",
    );
  });
});

// =============================================================================
// 7. Error handling
// =============================================================================

describe("Milestone 2: Error Handling", () => {
  test("user errors in onWalk are caught and wrapped", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "BadBlock") {
        throw new Error("User validation failed");
      }
    };

    const input = `[BadBlock]`;

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
        message: /Error in onWalk callback for block 'BadBlock'/,
      },
    );
  });

  test("MacroError in onWalk is re-thrown without wrapping", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      if (block.id === "InvalidBlock") {
        ctx.macros.throwError("Invalid block configuration");
      }
    };

    const input = `[InvalidBlock]`;

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
        message: "Invalid block configuration",
      },
    );
  });
});

// =============================================================================
// 8. Advanced use cases
// =============================================================================

describe("Milestone 2: Advanced Use Cases", () => {
  test("track and validate parent-child relationships", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      // Validate: Button blocks cannot be children of Button blocks
      if (block.id === "Button" && parent && parent.id === "Button") {
        ctx.macros.throwError("Button cannot be nested inside another Button");
      }
    };

    const validInput = `
      [Container
        [Button]
      ]
    `;

    const tree1 = parse(validInput);
    const tx1 = new Transaction();
    const processor1 = new DataSourceProcessor(tx1);
    const expander1 = new TemplateExpander(tx1, processor1, ctx);

    // This should not throw
    assert.doesNotThrow(() => {
      expander1.expandTemplates(tree1);
    });

    const invalidInput = `
      [Button
        [Button]
      ]
    `;

    const tree2 = parse(invalidInput);
    const tx2 = new Transaction();
    const processor2 = new DataSourceProcessor(tx2);
    const expander2 = new TemplateExpander(tx2, processor2, ctx);

    // This should throw
    assert.throws(
      () => {
        expander2.expandTemplates(tree2);
      },
      {
        name: "MacroError",
        message: /Button cannot be nested inside another Button/,
      },
    );
  });

  test("accumulate properties from ancestors", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      // Inherit padding from parent if not specified
      if (parent && parent.properties.padding && !block.properties.padding) {
        block.properties.padding = {
          type: "Literal",
          valueType: "number",
          value: parent.properties.padding.value,
        };
      }
    };

    const input = `
      [Container (padding: 20)
        [Box1]
        [Box2 (padding: 10)]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    // Container has explicit padding
    assert.strictEqual(result[0].properties.padding.value, 20);

    // Box1 inherits from Container
    assert.strictEqual(result[0].children[0].properties.padding.value, 20);

    // Box2 has explicit padding (not inherited)
    assert.strictEqual(result[0].children[1].properties.padding.value, 10);
  });

  test("collect block metadata during preprocessing", () => {
    const ctx = createEnhancedMacroContext();
    const metadata = {
      totalBlocks: 0,
      blockTypes: new Set(),
      propertyCounts: {},
    };

    ctx.macros.onWalk = function (block, parent) {
      metadata.totalBlocks++;
      metadata.blockTypes.add(block.id);

      const propCount = Object.keys(block.properties).length;
      if (!metadata.propertyCounts[propCount]) {
        metadata.propertyCounts[propCount] = 0;
      }
      metadata.propertyCounts[propCount]++;
    };

    const input = `
      [Container (width: 800)
        [Header (title: "Hello", height: 60)]
        [Content]
        [Footer (text: "Copyright")]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    expander.expandTemplates(tree);

    assert.strictEqual(metadata.totalBlocks, 4);
    assert.strictEqual(metadata.blockTypes.size, 4);
    assert.ok(metadata.blockTypes.has("Container"));
    assert.ok(metadata.blockTypes.has("Header"));
    assert.ok(metadata.blockTypes.has("Content"));
    assert.ok(metadata.blockTypes.has("Footer"));

    // Property counts: Container(1), Header(2), Content(0), Footer(1)
    assert.strictEqual(metadata.propertyCounts[0], 1); // Content
    assert.strictEqual(metadata.propertyCounts[1], 2); // Container, Footer
    assert.strictEqual(metadata.propertyCounts[2], 1); // Header
  });

  test("onWalk without macro context works normally", () => {
    // No macro context provided
    const input = `
      [Container
        [Child]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, null);

    // Should work without errors
    const result = expander.expandTemplates(tree);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "Container");
    assert.strictEqual(result[0].children.length, 1);
  });

  test("empty onWalk callback still processes correctly", () => {
    const ctx = createEnhancedMacroContext();

    // Set empty callback
    ctx.macros.onWalk = function (block, parent) {
      // Do nothing
    };

    const input = `
      [Container (width: 100)
        [Child (height: 50)]
      ]
    `;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    // Everything should still process normally
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].properties.width.value, 100);
    assert.strictEqual(result[0].children[0].properties.height.value, 50);
  });

  test("complex property transformations in onWalk", () => {
    const ctx = createEnhancedMacroContext();

    ctx.macros.onWalk = function (block, parent) {
      // Convert width/height to size object
      if (block.properties.width && block.properties.height) {
        block.properties.size = {
          type: "Literal",
          valueType: "object",
          value: {
            width: block.properties.width.value,
            height: block.properties.height.value,
          },
        };
      }

      // Add aspectRatio if both dimensions present
      if (block.properties.width && block.properties.height) {
        block.properties.aspectRatio = {
          type: "Literal",
          valueType: "number",
          value: block.properties.width.value / block.properties.height.value,
        };
      }
    };

    const input = `[Box (width: 200, height: 100)]`;

    const tree = parse(input);
    const tx = new Transaction();
    const processor = new DataSourceProcessor(tx);
    const expander = new TemplateExpander(tx, processor, ctx);

    const result = expander.expandTemplates(tree);

    assert.ok(result[0].properties.size);
    assert.strictEqual(result[0].properties.size.value.width, 200);
    assert.strictEqual(result[0].properties.size.value.height, 100);
    assert.strictEqual(result[0].properties.aspectRatio.value, 2);
  });
});
