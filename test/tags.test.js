import { test, describe } from "node:test";
import assert from "node:assert";
import { parse } from "../src/parser/parser.js";
import { TagRegistry, TagProcessor } from "../src/preprocessor/tags.js";

describe("Tag Registry", () => {
  test("defines and retrieves tags", () => {
    const registry = new TagRegistry();

    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    assert.ok(registry.hasTag("component"));
    const tag = registry.getTag("component");
    assert.strictEqual(tag.name, "component");
    assert.strictEqual(tag.block.canReuse, true);
    assert.strictEqual(tag.block.canOutput, false);
  });

  test("prevents duplicate tag definitions", () => {
    const registry = new TagRegistry();

    registry.defineTag("component", {
      block: { canReuse: true },
    });

    assert.throws(() => {
      registry.defineTag("component", {
        block: { canReuse: true },
      });
    }, /already defined/);
  });

  test("registers tag instances", () => {
    const registry = new TagRegistry();
    const mockBlock = { id: "Button", properties: {}, children: [] };

    registry.registerInstance("component(Button)", mockBlock);

    assert.ok(registry.hasInstance("component(Button)"));
    assert.strictEqual(registry.getInstance("component(Button)"), mockBlock);
  });

  test("prevents duplicate instance registration", () => {
    const registry = new TagRegistry();
    const mockBlock = {
      id: "Button",
      properties: {},
      children: [],
      location: null,
    };

    registry.registerInstance("component(Button)", mockBlock);

    assert.throws(() => {
      registry.registerInstance("component(Button)", mockBlock);
    }, /Duplicate tag definition/);
  });

  test("gets instances for tag name", () => {
    const registry = new TagRegistry();
    const block1 = { id: "Button" };
    const block2 = { id: "Icon" };
    const block3 = { id: "Other" };

    registry.registerInstance("component(Button)", block1);
    registry.registerInstance("component(Icon)", block2);
    registry.registerInstance("other", block3);

    const instances = registry.getInstancesForTag("component");
    assert.strictEqual(instances.length, 2);
    assert.ok(instances.some((i) => i.key === "component(Button)"));
    assert.ok(instances.some((i) => i.key === "component(Icon)"));
  });
});

describe("Tag Processor", () => {
  test("creates instance keys", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    assert.strictEqual(processor.createKey("component"), "component");
    assert.strictEqual(
      processor.createKey("component", "Button"),
      "component(Button)",
    );
  });

  test("detects tag usage types", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    // No tags
    const noTags = { tags: [], properties: {}, children: [] };
    assert.strictEqual(processor.detectTagUsage(noTags).type, "none");

    // Definition
    const definition = {
      tags: [{ tagType: "definition", name: "component" }],
      properties: {},
      children: [],
    };
    const defUsage = processor.detectTagUsage(definition);
    assert.strictEqual(defUsage.type, "definition");
    assert.strictEqual(defUsage.tag.name, "component");

    // Instance
    const instance = {
      tags: [{ tagType: "instance", name: "component" }],
      properties: {},
      children: [],
    };
    const instUsage = processor.detectTagUsage(instance);
    assert.strictEqual(instUsage.type, "instance");

    // Composition
    const composition = {
      tags: [
        { tagType: "instance", name: "component" },
        { tagType: "instance", name: "icon" },
      ],
      properties: {},
      children: [],
    };
    const compUsage = processor.detectTagUsage(composition);
    assert.strictEqual(compUsage.type, "composition");
    assert.strictEqual(compUsage.tags.length, 2);
  });

  test("throws on mixed tag types", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    const mixed = {
      tags: [
        { tagType: "definition", name: "component" },
        { tagType: "instance", name: "icon" },
      ],
      properties: {},
      children: [],
      location: null,
    };

    assert.throws(() => {
      processor.detectTagUsage(mixed);
    }, /Cannot mix @tag and #tag/);
  });

  test("validates tag definitions", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    const block = {
      id: "Button",
      properties: { width: { type: "Literal", value: 100 } },
      children: [],
      location: null,
    };

    const tag = { name: "component", tagType: "definition", location: null };

    // Should not throw
    const tagDef = processor.validateTag(tag, block, true);
    assert.strictEqual(tagDef.name, "component");
  });

  test("throws on undefined tag", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    const tag = { name: "unknown", location: null };
    const block = { properties: {}, children: [], location: null };

    assert.throws(() => {
      processor.validateTag(tag, block, false);
    }, /Tag 'unknown' is not defined/);
  });

  test("throws on tag definition with expression", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true },
    });

    const processor = new TagProcessor(registry);

    const block = {
      properties: {
        width: { type: "Expression", tokens: [] },
      },
      children: [],
      location: null,
    };

    const tag = { name: "component", location: null };

    assert.throws(() => {
      processor.validateTag(tag, block, true);
    }, /cannot use expressions/);
  });

  test("throws on composition with properties", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    const tags = [
      { tagType: "instance", name: "component" },
      { tagType: "instance", name: "icon" },
    ];

    const block = {
      properties: { x: { type: "Literal", value: 10 } },
      children: [],
      location: null,
    };

    assert.throws(() => {
      processor.validateComposition(tags, block);
    }, /cannot have properties/);
  });

  test("throws on composition with children", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    const tags = [
      { tagType: "instance", name: "component" },
      { tagType: "instance", name: "icon" },
    ];

    const block = {
      properties: {},
      children: [{ id: "Child" }],
      location: null,
    };

    assert.throws(() => {
      processor.validateComposition(tags, block);
    }, /cannot have children/);
  });

  test("processes tag definitions", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    const input = `
      @component(Button)
      [Button (width: 100)]
    `;

    const doc = parse(input);
    const processed = processor.processDefinitions(doc.blocks);

    // Button should be registered
    assert.ok(registry.hasInstance("component(Button)"));

    // Should not be in output (canOutput: false)
    assert.strictEqual(processed.length, 0);
  });

  test("keeps tag definitions when canOutput is true", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: true },
    });

    const processor = new TagProcessor(registry);

    const input = `
      @component(Button)
      [Button (width: 100)]
    `;

    const doc = parse(input);
    const processed = processor.processDefinitions(doc.blocks);

    // Button should be registered
    assert.ok(registry.hasInstance("component(Button)"));

    // Should be in output (canOutput: true)
    assert.strictEqual(processed.length, 1);
    assert.strictEqual(processed[0].id, "Button");
  });

  test("validates instances reference existing definitions", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    // Register a definition
    const defInput = `
      @component(Button)
      [Button (width: 100)]
    `;
    const defDoc = parse(defInput);
    processor.processDefinitions(defDoc.blocks);

    // Valid instance
    const validInput = `
      #component(Button) [MyButton]
    `;
    const validDoc = parse(validInput);

    // Should not throw
    processor.validateInstances(validDoc.blocks);

    // Invalid instance (no definition)
    const invalidInput = `
      #component(Icon) [MyIcon]
    `;
    const invalidDoc = parse(invalidInput);

    assert.throws(() => {
      processor.validateInstances(invalidDoc.blocks);
    }, /No definition found for #component\(Icon\)/);
  });
});

describe("Tag Expansion", () => {
  test("expands single tag instance", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    // Register definition
    const defInput = `
      @component(Button)
      [Button (width: 100, height: 50, label: "Default")]
    `;
    const defDoc = parse(defInput);
    processor.processDefinitions(defDoc.blocks);

    // Instance with override
    const instInput = `
      #component(Button) [MyButton (label: "Submit")]
    `;
    const instDoc = parse(instInput);
    const expanded = processor.expandTags(instDoc.blocks);

    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "MyButton");
    assert.strictEqual(expanded[0].properties.width.value, 100); // From definition
    assert.strictEqual(expanded[0].properties.height.value, 50); // From definition
    assert.strictEqual(expanded[0].properties.label.value, "Submit"); // Instance override
    assert.strictEqual(expanded[0].tags.length, 0); // Tags removed after expansion
  });

  test("expands tag instance with inherited children", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    // Definition with children
    const defInput = `
      @component(Button)
      [Button (width: 100)
        [Icon (src: "icon.svg")]
        [Label (text: "Default")]
      ]
    `;
    const defDoc = parse(defInput);
    processor.processDefinitions(defDoc.blocks);

    // Instance without children (should inherit)
    const instInput = `
      #component(Button) [MyButton (label: "Submit")]
    `;
    const instDoc = parse(instInput);
    const expanded = processor.expandTags(instDoc.blocks);

    assert.strictEqual(expanded[0].children.length, 2);
    assert.strictEqual(expanded[0].children[0].id, "Icon");
    assert.strictEqual(expanded[0].children[1].id, "Label");
  });

  test("expands tag composition", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    // Define Button and Icon
    const defInput = `
      @component(Button)
      [Button (width: 100, height: 50)]

      @component(Icon)
      [Icon (size: 24, src: "icon.svg")]
    `;
    const defDoc = parse(defInput);
    processor.processDefinitions(defDoc.blocks);

    // Composition
    const compInput = `
      #component(Button) #component(Icon) [ButtonWithIcon]
    `;
    const compDoc = parse(compInput);
    const expanded = processor.expandTags(compDoc.blocks);

    // Should have 2 children: ButtonWithIcon_Button and ButtonWithIcon_Icon
    assert.strictEqual(expanded.length, 1);
    assert.strictEqual(expanded[0].id, "ButtonWithIcon");
    assert.strictEqual(expanded[0].children.length, 2);

    assert.strictEqual(expanded[0].children[0].id, "ButtonWithIcon_Button");
    assert.strictEqual(expanded[0].children[0].properties.width.value, 100);

    assert.strictEqual(expanded[0].children[1].id, "ButtonWithIcon_Icon");
    assert.strictEqual(expanded[0].children[1].properties.size.value, 24);
  });

  test("expands nested tag instances", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    // Definition
    const defInput = `
      @component(Button)
      [Button (width: 100)]
    `;
    const defDoc = parse(defInput);
    processor.processDefinitions(defDoc.blocks);

    // Nested instances
    const instInput = `
      [Container
        #component(Button) [Button1]
        #component(Button) [Button2 (width: 200)]
      ]
    `;
    const instDoc = parse(instInput);
    const expanded = processor.expandTags(instDoc.blocks);

    assert.strictEqual(expanded[0].id, "Container");
    assert.strictEqual(expanded[0].children.length, 2);

    // First button uses default width
    assert.strictEqual(expanded[0].children[0].id, "Button1");
    assert.strictEqual(expanded[0].children[0].properties.width.value, 100);

    // Second button overrides width
    assert.strictEqual(expanded[0].children[1].id, "Button2");
    assert.strictEqual(expanded[0].children[1].properties.width.value, 200);
  });

  test("clones blocks independently", () => {
    const registry = new TagRegistry();
    registry.defineTag("component", {
      block: { canReuse: true, canOutput: false },
    });

    const processor = new TagProcessor(registry);

    // Definition
    const defInput = `
      @component(Counter)
      [Counter (value: 0)]
    `;
    const defDoc = parse(defInput);
    processor.processDefinitions(defDoc.blocks);

    // Two instances
    const instInput = `
      #component(Counter) [Counter1 (value: 5)]
      #component(Counter) [Counter2 (value: 10)]
    `;
    const instDoc = parse(instInput);
    const expanded = processor.expandTags(instDoc.blocks);

    // Each should have independent values
    assert.strictEqual(expanded[0].properties.value.value, 5);
    assert.strictEqual(expanded[1].properties.value.value, 10);

    // Modifying one shouldn't affect the other
    expanded[0].properties.value.value = 99;
    assert.strictEqual(expanded[1].properties.value.value, 10);
  });
});

describe("Module Property Injection", () => {
  test("injects module properties from tag definition", () => {
    const registry = new TagRegistry();

    // Simulate external data source
    const player = { health: 100, mana: 50 };

    registry.defineTag("entity", {
      block: { canReuse: false, canOutput: true },
      module: {
        health: () => player.health,
        mana: () => player.mana,
      },
    });

    const processor = new TagProcessor(registry);

    const input = `
      #entity [Player (x: 50, y: 50)]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    // Should have both user-defined and module properties
    assert.strictEqual(injected[0].properties.x.value, 50);
    assert.strictEqual(injected[0].properties.y.value, 50);
    assert.strictEqual(injected[0].properties.health.value, 100);
    assert.strictEqual(injected[0].properties.mana.value, 50);
  });

  test("throws on module property conflict", () => {
    const registry = new TagRegistry();

    const player = { health: 100 };

    registry.defineTag("entity", {
      block: { canReuse: false, canOutput: true },
      module: {
        health: () => player.health,
      },
    });

    const processor = new TagProcessor(registry);

    // User tries to override module property
    const input = `
      #entity [Player (health: 50, x: 10)]
    `;
    const doc = parse(input);

    assert.throws(() => {
      processor.injectModuleProperties(doc.blocks);
    }, /Cannot override module property 'health'/);
  });

  test("injects module properties with various types", () => {
    const registry = new TagRegistry();

    const gameState = {
      position: { x: 10, y: 20 },
      inventory: ["sword", "shield"],
      isActive: true,
      score: 42,
      nullValue: null,
    };

    registry.defineTag("entity", {
      block: { canReuse: false, canOutput: true },
      module: {
        position: () => gameState.position,
        inventory: () => gameState.inventory,
        isActive: () => gameState.isActive,
        score: () => gameState.score,
        nullValue: () => gameState.nullValue,
      },
    });

    const processor = new TagProcessor(registry);

    const input = `
      #entity [Player]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    const props = injected[0].properties;

    // Object (serialized as JSON string)
    assert.strictEqual(props.position.type, "Literal");
    assert.strictEqual(props.position.valueType, "string");
    assert.strictEqual(props.position.value, JSON.stringify({ x: 10, y: 20 }));

    // Array
    assert.strictEqual(props.inventory.type, "Array");
    assert.strictEqual(props.inventory.elements.length, 2);
    assert.strictEqual(props.inventory.elements[0].value, "sword");
    assert.strictEqual(props.inventory.elements[1].value, "shield");

    // Boolean
    assert.strictEqual(props.isActive.type, "Literal");
    assert.strictEqual(props.isActive.valueType, "boolean");
    assert.strictEqual(props.isActive.value, true);

    // Number
    assert.strictEqual(props.score.type, "Literal");
    assert.strictEqual(props.score.valueType, "number");
    assert.strictEqual(props.score.value, 42);

    // Null
    assert.strictEqual(props.nullValue.type, "Literal");
    assert.strictEqual(props.nullValue.valueType, "null");
    assert.strictEqual(props.nullValue.value, null);
  });

  test("injects module properties into nested blocks", () => {
    const registry = new TagRegistry();

    const player = { health: 100 };

    registry.defineTag("entity", {
      block: { canReuse: false, canOutput: true },
      module: {
        health: () => player.health,
      },
    });

    const processor = new TagProcessor(registry);

    const input = `
      [Container
        #entity [Player (x: 50)]
        [Other
          #entity [Enemy (x: 100)]
        ]
      ]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    // Player should have health
    assert.strictEqual(injected[0].children[0].properties.health.value, 100);

    // Enemy should also have health
    assert.strictEqual(
      injected[0].children[1].children[0].properties.health.value,
      100,
    );
  });

  test("handles multiple tags with different module properties", () => {
    const registry = new TagRegistry();

    const player = { health: 100 };
    const ui = { theme: "dark" };

    registry.defineTag("entity", {
      block: { canReuse: false, canOutput: true },
      module: {
        health: () => player.health,
      },
    });

    registry.defineTag("styled", {
      block: { canReuse: false, canOutput: true },
      module: {
        theme: () => ui.theme,
      },
    });

    const processor = new TagProcessor(registry);

    const input = `
      #entity [Player (x: 50)]
      #styled [Button (label: "Click")]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    // Player has health but not theme
    assert.strictEqual(injected[0].properties.health.value, 100);
    assert.strictEqual(injected[0].properties.theme, undefined);

    // Button has theme but not health
    assert.strictEqual(injected[1].properties.theme.value, "dark");
    assert.strictEqual(injected[1].properties.health, undefined);
  });

  test("module properties are called fresh each time", () => {
    const registry = new TagRegistry();

    let counter = 0;
    const state = {
      getCount: () => {
        counter += 1;
        return counter;
      },
    };

    registry.defineTag("counter", {
      block: { canReuse: false, canOutput: true },
      module: {
        count: () => state.getCount(),
      },
    });

    const processor = new TagProcessor(registry);

    const input = `
      #counter [Counter1]
      #counter [Counter2]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    // Each call should increment the counter
    assert.strictEqual(injected[0].properties.count.value, 1);
    assert.strictEqual(injected[1].properties.count.value, 2);
  });

  test("handles empty module definition", () => {
    const registry = new TagRegistry();

    registry.defineTag("simple", {
      block: { canReuse: false, canOutput: true },
      module: {}, // No module properties
    });

    const processor = new TagProcessor(registry);

    const input = `
      #simple [Block (x: 10)]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    // Should only have user-defined properties
    assert.strictEqual(injected[0].properties.x.value, 10);
    assert.strictEqual(Object.keys(injected[0].properties).length, 1);
  });

  test("handles blocks without tags", () => {
    const registry = new TagRegistry();
    const processor = new TagProcessor(registry);

    const input = `
      [Block (x: 10, y: 20)]
    `;
    const doc = parse(input);
    const injected = processor.injectModuleProperties(doc.blocks);

    // Should remain unchanged
    assert.strictEqual(injected[0].properties.x.value, 10);
    assert.strictEqual(injected[0].properties.y.value, 20);
    assert.strictEqual(Object.keys(injected[0].properties).length, 2);
  });
});
