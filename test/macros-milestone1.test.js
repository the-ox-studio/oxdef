/**
 * Comprehensive tests for Milestone 1: Pre-Parse Hook
 *
 * Tests the macro system's onParse callback functionality:
 * - Basic onParse callback execution
 * - Tree access and walking
 * - Early termination with finish()
 * - Raw AST access (templates, expressions, tags)
 * - Error handling
 * - Use cases: code generation, static analysis, partial processing
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import {
  createEnhancedMacroContext,
  MacroError,
} from "../src/preprocessor/macros.js";
import { parseWithMacros } from "../src/parser/parser.js";

// =============================================================================
// 1. Basic onParse callback execution - 2 tests
// =============================================================================

describe("Milestone 1: Pre-Parse Hook - Basic Execution", () => {
  test("onParse callback executes before preprocessing", () => {
    const ctx = createEnhancedMacroContext();
    let callbackExecuted = false;

    ctx.init.onParse = function () {
      callbackExecuted = true;
    };

    const input = "[Container]";
    const tree = parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(
      callbackExecuted,
      true,
      "onParse callback should execute",
    );
    assert.strictEqual(tree.blocks.length, 1);
    assert.strictEqual(tree.blocks[0].id, "Container");
  });

  test("onParse callback has access to ctx object", () => {
    const ctx = createEnhancedMacroContext();
    let hasAccess = false;

    ctx.init.onParse = function () {
      // Verify ctx object is available inside callback
      if (ctx.tree && ctx.walk && ctx.finish) {
        hasAccess = true;
      }
    };

    const input = "[Box]";
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(hasAccess, true, "ctx should be accessible in onParse");
  });
});

// =============================================================================
// 2. Tree access and walking - 3 tests
// =============================================================================

describe("Milestone 1: Tree Access and Walking", () => {
  test("ctx.tree provides access to parsed AST", () => {
    const ctx = createEnhancedMacroContext();
    let treeAccessed = false;
    let blockCount = 0;

    ctx.init.onParse = function () {
      const tree = ctx.tree;
      treeAccessed = tree !== null && tree !== undefined;
      blockCount = tree.blocks.length;
    };

    const input = `
      [Container
        [Header]
        [Content]
      ]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(treeAccessed, true, "Tree should be accessible");
    assert.strictEqual(blockCount, 1, "Should have root block");
  });

  test("ctx.walk() traverses tree structure", () => {
    const ctx = createEnhancedMacroContext();
    const visited = [];

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // Walk all blocks in the tree
      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block, parent) => {
          visited.push(block.id);
        });
      });
    };

    const input = `
      [Root
        [Child1
          [GrandChild1]
          [GrandChild2]
        ]
        [Child2]
      ]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.deepStrictEqual(visited, [
      "Root",
      "Child1",
      "GrandChild1",
      "GrandChild2",
      "Child2",
    ]);
  });

  test("ctx.walk() provides parent context", () => {
    const ctx = createEnhancedMacroContext();
    const parentMap = new Map();

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block, parent) => {
          parentMap.set(block.id, parent ? parent.id : null);
        });
      });
    };

    const input = `
      [Root
        [Child1]
        [Child2]
      ]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(
      parentMap.get("Root"),
      null,
      "Root should have no parent",
    );
    assert.strictEqual(
      parentMap.get("Child1"),
      "Root",
      "Child1 parent should be Root",
    );
    assert.strictEqual(
      parentMap.get("Child2"),
      "Root",
      "Child2 parent should be Root",
    );
  });
});

// =============================================================================
// 3. Early termination with finish() - 2 tests
// =============================================================================

describe("Milestone 1: Early Termination", () => {
  test("ctx.finish() terminates preprocessing early", () => {
    const ctx = createEnhancedMacroContext();
    let walkCount = 0;

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          walkCount++;
        });
      });

      // Terminate early
      ctx.finish();
    };

    const input = "[Container [Child1] [Child2]]";
    const tree = parseWithMacros(input, "<test>", ctx);

    // Tree should be returned but preprocessing stops
    assert.ok(tree, "Tree should be returned");
    assert.strictEqual(walkCount, 3, "Walk should complete before finish");
  });

  test("finish() prevents further processing", () => {
    const ctx = createEnhancedMacroContext();
    let finishCalled = false;

    ctx.init.onParse = function () {
      // Check a condition and finish if met
      const tree = ctx.tree;

      if (tree.blocks.length > 0 && tree.blocks[0].id === "EarlyExit") {
        finishCalled = true;
        ctx.finish();
      }
    };

    const input = "[EarlyExit]";
    const tree = parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(finishCalled, true, "finish() should be called");
    assert.ok(tree, "Tree should still be available");
  });
});

// =============================================================================
// 4. Raw AST access (templates, expressions, tags) - 3 tests
// =============================================================================

describe("Milestone 1: Raw AST Access", () => {
  test("access raw templates from tree", () => {
    const ctx = createEnhancedMacroContext();
    let templateCount = 0;
    let setTemplate = null;

    ctx.init.onParse = function () {
      const tree = ctx.tree;
      templateCount = tree.templates.length;

      if (tree.templates.length > 0) {
        setTemplate = tree.templates[0];
      }
    };

    const input = `
      <set margin = 20>
      [Container]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(templateCount, 1, "Should have one template");
    assert.strictEqual(setTemplate.type, "Set", "Template should be Set type");
    assert.strictEqual(
      setTemplate.name,
      "margin",
      "Variable name should be margin",
    );
    assert.strictEqual(setTemplate.value.value, 20, "Value should be 20");
  });

  test("access raw expressions in properties", () => {
    const ctx = createEnhancedMacroContext();
    let hasExpression = false;
    let expressionTokens = null;

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          if (
            block.properties.width &&
            block.properties.width.type === "Expression"
          ) {
            hasExpression = true;
            expressionTokens = block.properties.width.tokens;
          }
        });
      });
    };

    const input = "[Box (width: ($parent.width - 20))]";
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(hasExpression, true, "Should find expression");
    assert.ok(expressionTokens.length > 0, "Expression should have tokens");
  });

  test("inspect tags in raw tree", () => {
    const ctx = createEnhancedMacroContext();
    const tagsFound = [];

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          if (block.tags && block.tags.length > 0) {
            block.tags.forEach((tag) => {
              tagsFound.push({
                name: tag.name,
                type: tag.tagType,
                argument: tag.argument,
              });
            });
          }
        });
      });
    };

    const input = `
      @component [Button]
      #component(Icon) [IconButton]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(tagsFound.length, 2, "Should find 2 tags");
    assert.strictEqual(tagsFound[0].name, "component", "First tag name");
    assert.strictEqual(
      tagsFound[0].type,
      "definition",
      "First tag is definition",
    );
    assert.strictEqual(tagsFound[1].name, "component", "Second tag name");
    assert.strictEqual(tagsFound[1].type, "instance", "Second tag is instance");
    assert.strictEqual(
      tagsFound[1].argument,
      "Icon",
      "Second tag has argument",
    );
  });
});

// =============================================================================
// 5. Error handling - 2 tests
// =============================================================================

describe("Milestone 1: Error Handling", () => {
  test("MacroError is thrown for validation failures", () => {
    const ctx = createEnhancedMacroContext();

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // Validate something and throw error
      if (tree.blocks.length === 0) {
        ctx.macros.throwError("Document must contain at least one block");
      }
    };

    const input = "<set x = 10>";

    assert.throws(
      () => {
        parseWithMacros(input, "<test>", ctx);
      },
      {
        name: "MacroError",
        message: "Document must contain at least one block",
      },
    );
  });

  test("user errors in onParse are caught and wrapped", () => {
    const ctx = createEnhancedMacroContext();

    ctx.init.onParse = function () {
      // Deliberately cause an error
      throw new Error("User validation failed");
    };

    const input = "[Container]";

    assert.throws(
      () => {
        parseWithMacros(input, "<test>", ctx);
      },
      {
        name: "MacroError",
        message: /Error in onParse callback: User validation failed/,
      },
    );
  });
});

// =============================================================================
// 6. Use cases - 3 tests
// =============================================================================

describe("Milestone 1: Use Cases", () => {
  test("Use case: Code generation - collect component definitions", () => {
    const ctx = createEnhancedMacroContext();
    const components = [];

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // Find all @component definitions
      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          if (block.tags && block.tags.length > 0) {
            block.tags.forEach((tag) => {
              if (tag.tagType === "definition" && tag.name === "component") {
                components.push({
                  id: block.id,
                  properties: Object.keys(block.properties),
                });
              }
            });
          }
        });
      });

      // After collection, could generate code here
      // For test purposes, we just collect
    };

    const input = `
      @component [Button (width: 100, height: 50)]
      @component [Input (placeholder: "Enter text")]
      [Container]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(components.length, 2, "Should find 2 components");
    assert.strictEqual(components[0].id, "Button");
    assert.deepStrictEqual(components[0].properties, ["width", "height"]);
    assert.strictEqual(components[1].id, "Input");
    assert.deepStrictEqual(components[1].properties, ["placeholder"]);
  });

  test("Use case: Static analysis - validate block structure", () => {
    const ctx = createEnhancedMacroContext();
    const issues = [];

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // Validate: all blocks with 'required' tag must have 'id' property
      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          const hasRequiredTag =
            block.tags && block.tags.some((tag) => tag.name === "required");
          const hasIdProperty = block.properties.id !== undefined;

          if (hasRequiredTag && !hasIdProperty) {
            issues.push(
              `Block ${block.id} has @required tag but missing id property`,
            );
          }
        });
      });
    };

    const input = `
      @required [ValidBlock (id: "valid")]
      @required [InvalidBlock (width: 100)]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(issues.length, 1, "Should find 1 validation issue");
    assert.ok(
      issues[0].includes("InvalidBlock"),
      "Issue should mention InvalidBlock",
    );
  });

  test("Use case: Conditional processing based on analysis", () => {
    const ctx = createEnhancedMacroContext();
    let shouldProcess = true;

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // Check if document has any templates
      const hasTemplates = tree.templates.length > 0;

      // If no templates, skip preprocessing
      if (!hasTemplates) {
        shouldProcess = false;
        ctx.finish();
      }
    };

    // Input without templates
    const input1 = "[Container [Child1] [Child2]]";
    parseWithMacros(input1, "<test>", ctx);

    assert.strictEqual(
      shouldProcess,
      false,
      "Should skip processing without templates",
    );

    // Reset for second test
    shouldProcess = true;
    const ctx2 = createEnhancedMacroContext();
    ctx2.init.onParse = function () {
      const tree = ctx2.tree;
      const hasTemplates = tree.templates.length > 0;

      if (!hasTemplates) {
        shouldProcess = false;
        ctx2.finish();
      }
    };

    // Input with templates
    const input2 = `
      <set x = 10>
      [Container]
    `;
    parseWithMacros(input2, "<test>", ctx2);

    assert.strictEqual(shouldProcess, true, "Should process with templates");
  });
});

// =============================================================================
// 7. Additional integration tests
// =============================================================================

describe("Milestone 1: Integration Tests", () => {
  test("complex document analysis with multiple features", () => {
    const ctx = createEnhancedMacroContext();
    const analysis = {
      blockCount: 0,
      templateCount: 0,
      importCount: 0,
      componentDefs: 0,
      componentInstances: 0,
      expressionCount: 0,
    };

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      analysis.templateCount = tree.templates.length;
      analysis.importCount = tree.imports.length;

      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          analysis.blockCount++;

          // Count component tags
          if (block.tags) {
            block.tags.forEach((tag) => {
              if (tag.name === "component") {
                if (tag.tagType === "definition") {
                  analysis.componentDefs++;
                } else {
                  analysis.componentInstances++;
                }
              }
            });
          }

          // Count expressions
          Object.values(block.properties).forEach((prop) => {
            if (prop.type === "Expression") {
              analysis.expressionCount++;
            }
          });
        });
      });
    };

    const input = `
      <import "./utils.ox">
      <set margin = 20>

      @component [Button (width: 100)]

      [Container (padding: (margin))
        #component(Button) [MyButton (label: "Click")]
        [Box (width: ($parent.width))]
      ]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.strictEqual(analysis.blockCount, 4, "Should count all blocks");
    assert.strictEqual(
      analysis.templateCount,
      1,
      "Should count templates (set)",
    );
    assert.strictEqual(analysis.importCount, 1, "Should count imports");
    assert.strictEqual(
      analysis.componentDefs,
      1,
      "Should count component definitions",
    );
    assert.strictEqual(
      analysis.componentInstances,
      1,
      "Should count component instances",
    );
    assert.strictEqual(analysis.expressionCount, 2, "Should count expressions");
  });

  test("parseWithMacros works without macro context", () => {
    const input = "[Container]";
    const tree = parseWithMacros(input, "<test>");

    assert.ok(tree, "Should parse without macro context");
    assert.strictEqual(tree.blocks.length, 1);
    assert.strictEqual(tree.blocks[0].id, "Container");
  });

  test("parseWithMacros works with empty onParse", () => {
    const ctx = createEnhancedMacroContext();
    // Don't set onParse callback

    const input = "[Container]";
    const tree = parseWithMacros(input, "<test>", ctx);

    assert.ok(tree, "Should parse with empty onParse");
    assert.strictEqual(tree.blocks.length, 1);
  });

  test("multiple walk calls in onParse", () => {
    const ctx = createEnhancedMacroContext();
    const firstPass = [];
    const secondPass = [];

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // First walk to collect block IDs
      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          firstPass.push(block.id);
        });
      });

      // Second walk to validate
      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          if (block.children && block.children.length > 0) {
            secondPass.push(block.id);
          }
        });
      });
    };

    const input = `
      [Root
        [Child1]
      ]
    `;
    parseWithMacros(input, "<test>", ctx);

    assert.deepStrictEqual(firstPass, ["Root", "Child1"]);
    assert.deepStrictEqual(secondPass, ["Root"]);
  });

  test("tree structure after onParse remains unchanged", () => {
    const ctx = createEnhancedMacroContext();

    ctx.init.onParse = function () {
      const tree = ctx.tree;

      // Walk and inspect but don't modify
      tree.blocks.forEach((rootBlock) => {
        ctx.walk(rootBlock, (block) => {
          // Just read operations
          const id = block.id;
          const props = block.properties;
        });
      });
    };

    const input = "[Container (width: 100) [Child]]";
    const tree = parseWithMacros(input, "<test>", ctx);

    // Verify tree structure is intact
    assert.strictEqual(tree.blocks.length, 1);
    assert.strictEqual(tree.blocks[0].id, "Container");
    assert.strictEqual(tree.blocks[0].properties.width.value, 100);
    assert.strictEqual(tree.blocks[0].children.length, 1);
    assert.strictEqual(tree.blocks[0].children[0].id, "Child");
  });
});
