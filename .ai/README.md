# README
Inspired by `interfaceox`, this is a language definition system that improves the readability of data interchange formats and perfoming data structure similar to HTML. Unlike HTML, it is designed to be more concise and expressive. It also supports a wide range of data types and provides a powerful query language for data manipulation.

## Concepts
OX code is written in the form of blocks, enclosed in square brackets.

```
[Identifier]
```

Blocks can contain other blocks, which can be nested to any depth. In addition, blocks can contain attributes, which are key-value pairs enclosed in parentheses.

```
[Identifier (key1:value1, key2:value2)
  [Child (childKey: childValue)
    // etc.
  ]
]
```

Blocks can also have attached tags before their declarations, which can be used to provide additional information about the block.

```
@component [Identifier (key1:value1, key2:value2)]
```

Or advanced tags:

```
@component(Button) [Identifier]
```

For tags to have any meaning, the user must define them at design-time in their language of choice. For example, the tag `@component` can be used to indicate that the block represents a component in a user interface.

In this instance, a user would need to define the tag like so:

```javascript
const oxparser = require('oxparser');
let componentStack = [];
oxparser.defineTag('component', {
  block: {
    output: function(block) {
      componentStack.push(block);
    }
  },
  descriptor: {
    attributes: [
      {
        type: "identifier"
      }
    ]
  }
});
```

In the above example, a "component" is defined accepting an argument of type "identifier".

When using the parser by default, the output blocks are pushed into a global stack within the parser's context.

Otherwise, if a `block.output` function is defined as above, blocks can be added to user-defined arrays and manipulated in isolation.

It exposes the block instance, which corresponds with all its meta-data and respective children.

To use the parser, a user can then parse and access content with the `tree`, like so:

```javascript
const oxparser = require('oxparser');
oxparser.parseFile('example.ox');
console.log(oxparser.tree);
```

The `oxparser.tree` is a property that represents the parsed structure of the OX code, containing blocks and their attributes.

Attributes can be any of the following:

```javascript
class Block {
  constructor(id, properties = {}) {
    this.id = id;
    this.properties = properties;
    this.tags = [];
    this.children = [];
  }
}
```

### Templates
Another feature of the OX language is templates. Templates are wrapped in `<>` notation and are expressions evaluated at runtime. These expressions are parsed and evaluated separately in a pre-processing step. The pre-processor can be accessed like so from the `templates` property of the parser.

#### Template Properties/Functions
Users can toggle the following options:

 * `ifExpr` - tells the pre-processor it can process if expressions.
 * `foreachExpr` - turn on foreach
 * `varExpr` - turn on variable expressions

Uses for templates:

 * Pre-processing is designed so that expressions are evaluated to determine the final output of blocks within a tree. 
 * It is a separate step in order to avoid runtime overhead in preference for simplicity.

If users need dynamic options, they can use various functions that come with templating:

```javascript
const layout = oxparser.find("tag").of("layout");
oxparser.templates.rerun(layout);
```

The `rerun` accepts one or more parsed blocks from the tree. Although the template code is often trimmed, the template parser compares the blocks with it's cached blocks and re-runs the pre-processor on the existing block in the parser's tree, adding or removing blocks as necessary.

For input that can alter variables, or bind them to output code, users have access to the following functions.

```javascript
oxparser.templates.setVariable("count", 5);
```

Set a global variable.

```javascript
oxparser.templates.getVariable("count");
```

Get a variable defined in templates.

```javascript
layout.properties["selected"] = -1;
oxparser.templates.rerun(layout);
const selected = layout.properties["selected"];
```

Set a property on a block or set of blocks, rerun the block(s) through pre-processing and get the returned results.

### Properties
Users can set default properties for blocks that all get the same properties when they are first declared.

```javascript
oxparser.blockOptions.properties = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
}
```

Whenever a new block is parsed, the properties are copied into the block, overwritten by user input in the source file. This also allows custom properties to be defined regardless of consequence.

### Interpreting
Interpretation is left to the user. This means walking the parsed tree and determining how each block is used.

To make things easier, the parser comes with a walk function:

```javascript
oxparser.walk((block, parent, context) => {
  // do something
});
```

This iterates into and out from blocks and their respective parents, exposing their corresponding tags, properties and attributes.

A third argument, `context`, allows to reverse walk if required up to a certain point. `context` provides a `level` and `index` property that is preserved each time the callback is called.

When `oxparser.reverseWalk()` function is used, the context tells the reverser at which point it should stop reversing.

```javascript
oxparser.walk((block, parent, context) => {
  context.level = parent.level;
  context.index = parent.index; // index in the tree at the given level
  oxparser.reverseWalk(context, (block, parent) => {
    // block = parent from last context, parent = parent of this scope's block
  });
});
```

Reverse walk always goes up each level until it reaches the specified context's `level` and `index`, at which point `reverseWalk` is cancelled and `walk` proceeds. This allows users to perform top-down, bottom-up analysis and perform hierarchical systems typical in things like user interfaces.

Unlike walk, `reverseWalk` does not iterate child nodes, it only goes up one parent at a time until it reaches the document level. If `context` values are set to defaults (`-1`), `reverseWalk` ends at root level.

