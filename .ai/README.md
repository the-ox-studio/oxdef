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
  [Child (childKey:childValue)
    // etc.
  ]
]
```

Blocks can also have attached tags before their declarations, which can be used to provide additional information about the block.

```
@component [Identifier (key1:value1, key2:value2)]
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
  }
});
```

When using the parser by default, the output blocks are pushed into a global stack within the parser's context. This stack can be accessed and manipulated by the user's code.

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

Another feature of the OX language is templates. Templates are wrapped in `<>` notation and are expressions evaluated at runtime. These expressions are parsed and evaluated separately in a pre-processing step. The pre-processor can be accessed like so:

```javascript
const oxparser = require('oxparser');
oxparser.templates.options = {
  "if-expr": {

  }
};
```
