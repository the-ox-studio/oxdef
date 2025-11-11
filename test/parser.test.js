import { test, describe } from "node:test";
import assert from "node:assert";
import { parse } from "../src/parser/parser.js";

describe("Parser", () => {
  test("parses simple block", () => {
    const input = "[Container]";
    const doc = parse(input);

    assert.strictEqual(doc.blocks.length, 1);
    assert.strictEqual(doc.blocks[0].id, "Container");
    assert.strictEqual(doc.blocks[0].type, "Block");
    assert.deepStrictEqual(doc.blocks[0].properties, {});
    assert.strictEqual(doc.blocks[0].children.length, 0);
  });

  test("parses block with properties", () => {
    const input = "[Box (width: 100, height: 50, visible: true)]";
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.id, "Box");
    assert.strictEqual(block.properties.width.valueType, "number");
    assert.strictEqual(block.properties.width.value, 100);
    assert.strictEqual(block.properties.height.value, 50);
    assert.strictEqual(block.properties.visible.valueType, "boolean");
    assert.strictEqual(block.properties.visible.value, true);
  });

  test("parses block with string properties", () => {
    const input = '[Button (label: "Click me", id: unquoted)]';
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.properties.label.value, "Click me");
    assert.strictEqual(block.properties.id.value, "unquoted");
  });

  test("parses nested blocks", () => {
    const input = `
      [Container
        [Header]
        [Content
          [Section]
        ]
      ]
    `;
    const doc = parse(input);

    assert.strictEqual(doc.blocks.length, 1);
    const container = doc.blocks[0];
    assert.strictEqual(container.id, "Container");
    assert.strictEqual(container.children.length, 2);
    assert.strictEqual(container.children[0].id, "Header");
    assert.strictEqual(container.children[1].id, "Content");
    assert.strictEqual(container.children[1].children.length, 1);
    assert.strictEqual(container.children[1].children[0].id, "Section");
  });

  test("parses array properties", () => {
    const input = '[Data (numbers: {1, 2, 3}, tags: {"red", "blue"})]';
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.properties.numbers.type, "Array");
    assert.strictEqual(block.properties.numbers.elements.length, 3);
    assert.strictEqual(block.properties.numbers.elements[0].value, 1);
    assert.strictEqual(block.properties.tags.elements[0].value, "red");
  });

  test("parses expression properties", () => {
    const input = "[Box (width: ($parent.width - 20))]";
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.properties.width.type, "Expression");
    assert.ok(block.properties.width.tokens.length > 0);
  });

  test("parses tags on blocks", () => {
    const input = "@component [Button]";
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.tags.length, 1);
    assert.strictEqual(block.tags[0].tagType, "definition");
    assert.strictEqual(block.tags[0].name, "component");
  });

  test("parses tags with arguments", () => {
    const input = "#component(Button) [MyButton]";
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.tags[0].tagType, "instance");
    assert.strictEqual(block.tags[0].name, "component");
    assert.strictEqual(block.tags[0].argument, "Button");
  });

  test("parses multiple tags", () => {
    const input = "#component(Button) #component(Icon) [Composite]";
    const doc = parse(input);

    const block = doc.blocks[0];
    assert.strictEqual(block.tags.length, 2);
    assert.strictEqual(block.tags[0].name, "component");
    assert.strictEqual(block.tags[0].argument, "Button");
    assert.strictEqual(block.tags[1].argument, "Icon");
  });

  test("parses set template", () => {
    const input = "<set margin = 20>";
    const doc = parse(input);

    assert.strictEqual(doc.templates.length, 1);
    const setNode = doc.templates[0];
    assert.strictEqual(setNode.type, "Set");
    assert.strictEqual(setNode.name, "margin");
    assert.strictEqual(setNode.value.value, 20);
  });

  test("parses if template", () => {
    const input = `
      <if (condition)>
        [Block1]
      </if>
    `;
    const doc = parse(input);

    assert.strictEqual(doc.templates.length, 1);
    const ifNode = doc.templates[0];
    assert.strictEqual(ifNode.type, "If");
    assert.strictEqual(ifNode.condition.type, "Expression");
    assert.strictEqual(ifNode.thenBlocks.length, 1);
    assert.strictEqual(ifNode.thenBlocks[0].id, "Block1");
  });

  test("parses if-else template", () => {
    const input = `
      <if (condition)>
        [ThenBlock]
      <else>
        [ElseBlock]
      </if>
    `;
    const doc = parse(input);

    const ifNode = doc.templates[0];
    assert.strictEqual(ifNode.thenBlocks.length, 1);
    assert.strictEqual(ifNode.elseBlocks.length, 1);
    assert.strictEqual(ifNode.elseBlocks[0].id, "ElseBlock");
  });

  test("parses if-elseif-else template", () => {
    const input = `
      <if (cond1)>
        [Block1]
      <elseif (cond2)>
        [Block2]
      <else>
        [Block3]
      </if>
    `;
    const doc = parse(input);

    const ifNode = doc.templates[0];
    assert.strictEqual(ifNode.elseIfBranches.length, 1);
    assert.strictEqual(ifNode.elseIfBranches[0].blocks[0].id, "Block2");
    assert.strictEqual(ifNode.elseBlocks[0].id, "Block3");
  });

  test("parses foreach template", () => {
    const input = `
      <foreach (item in items)>
        [Item]
      </foreach>
    `;
    const doc = parse(input);

    const foreachNode = doc.templates[0];
    assert.strictEqual(foreachNode.type, "Foreach");
    assert.strictEqual(foreachNode.itemVar, "item");
    assert.strictEqual(foreachNode.collection, "items");
    assert.strictEqual(foreachNode.indexVar, null);
    assert.strictEqual(foreachNode.body.length, 1);
  });

  test("parses foreach with index", () => {
    const input = `
      <foreach (item, index in items)>
        [Item]
      </foreach>
    `;
    const doc = parse(input);

    const foreachNode = doc.templates[0];
    assert.strictEqual(foreachNode.itemVar, "item");
    assert.strictEqual(foreachNode.indexVar, "index");
  });

  test("parses while template", () => {
    const input = `
      <while (condition)>
        [Block]
      </while>
    `;
    const doc = parse(input);

    const whileNode = doc.templates[0];
    assert.strictEqual(whileNode.type, "While");
    assert.strictEqual(whileNode.condition.type, "Expression");
    assert.strictEqual(whileNode.body.length, 1);
  });

  test("parses on-data template", () => {
    const input = `
      <on-data users>
        [UserList]
      </on-data>
    `;
    const doc = parse(input);

    const onDataNode = doc.templates[0];
    assert.strictEqual(onDataNode.type, "OnData");
    assert.strictEqual(onDataNode.sourceName, "users");
    assert.strictEqual(onDataNode.dataBlocks.length, 1);
    assert.strictEqual(onDataNode.errorBlocks.length, 0);
  });

  test("parses on-data with error handling", () => {
    const input = `
      <on-data users>
        [UserList]
      <on-error>
        [ErrorBlock]
      </on-data>
    `;
    const doc = parse(input);

    const onDataNode = doc.templates[0];
    assert.strictEqual(onDataNode.dataBlocks.length, 1);
    assert.strictEqual(onDataNode.errorBlocks.length, 1);
    assert.strictEqual(onDataNode.errorBlocks[0].id, "ErrorBlock");
  });

  test("parses import statement", () => {
    const input = '<import "./config.ox">';
    const doc = parse(input);

    assert.strictEqual(doc.imports.length, 1);
    assert.strictEqual(doc.imports[0].type, "Import");
    assert.strictEqual(doc.imports[0].path, "./config.ox");
    assert.strictEqual(doc.imports[0].alias, null);
  });

  test("parses import with alias", () => {
    const input = '<import "./utils.ox" as util>';
    const doc = parse(input);

    const importNode = doc.imports[0];
    assert.strictEqual(importNode.path, "./utils.ox");
    assert.strictEqual(importNode.alias, "util");
  });

  test("parses complex document", () => {
    const input = `
      <set margin = 20>
      <import "./config.ox">

      @component(Button)
      [Button (width: 100, height: 50)]

      [Container (padding: (margin))
        <if (showHeader)>
          [Header]
        </if>

        <foreach (item in items)>
          #component(Button) [ItemButton (label: (item.name))]
        </foreach>
      ]
    `;
    const doc = parse(input);

    assert.strictEqual(doc.templates.length, 1); // set
    assert.strictEqual(doc.imports.length, 1);
    assert.strictEqual(doc.blocks.length, 2); // Button definition and Container

    const container = doc.blocks[1];
    assert.strictEqual(container.children.length, 2); // if and foreach templates
  });

  test("throws error on unclosed block", () => {
    const input = "[Container";
    assert.throws(() => {
      parse(input);
    }, /Expected \] to close block/);
  });

  test("throws error on missing block identifier", () => {
    const input = "[]";
    assert.throws(() => {
      parse(input);
    }, /Expected block identifier/);
  });

  test("throws error on unclosed if", () => {
    const input = "<if (condition)> [Block]";
    assert.throws(() => {
      parse(input);
    }, /Expected LT but got EOF|Expected \/ in closing if tag/);
  });

  test("throws error on mismatched closing tag", () => {
    const input = "<if (condition)> [Block] </foreach>";
    assert.throws(() => {
      parse(input);
    }, /Expected <\/if> but got <\/foreach>/);
  });
});
