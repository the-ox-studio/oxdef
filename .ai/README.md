# OX Language Definition - Implementation Roadmap

## Table of Contents

1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Core Concepts](#core-concepts)
4. [Syntax Specification](#syntax-specification)
5. [Template System](#template-system)
6. [Expression System](#expression-system)
7. [Transaction Architecture](#transaction-architecture)
8. [Data Sources and Async Handling](#data-sources-and-async-handling)
9. [Parser API](#parser-api)
10. [Error Handling](#error-handling)
11. [Multi-File Support](#multi-file-support)
12. [Streaming Architecture](#streaming-architecture)
13. [Use Cases](#use-cases)
14. [Implementation Roadmap](#implementation-roadmap)

---

## Overview

OX is a language definition system that improves the readability of data interchange formats while providing powerful data structure capabilities similar to HTML. Unlike HTML or JSON, OX is designed to be:

- **More concise and expressive** than traditional markup languages
- **Language-agnostic** - can target any programming language or runtime
- **Pre-processed** - all expressions and templates evaluated at build time for zero runtime overhead
- **Flexible** - separates authoring, data structure, and interpretation concerns

### Key Innovation

OX uses a **three-phase architecture**:

1. **Authoring Phase**: Write expressive OX code with templates, expressions, and dynamic data
2. **Pre-processing Phase**: Evaluate all templates and expressions to produce pure data structures
3. **Interpretation Phase**: User-defined walkers transform pure data into target output

This separation ensures **zero runtime overhead** while maintaining **maximum authoring convenience**.

### Positioning

OX aims to be:
- A better alternative to **YAML** (no whitespace sensitivity, clearer syntax)
- More expressive than **JSON** (supports comments, templates, expressions)
- More concise than **XML/HTML** (less boilerplate, cleaner hierarchy)
- More powerful than **TOML** (complex structures, templating, expressions)

---

## Design Philosophy

### 1. Blocks Are Structure, Properties Are Metadata

- **Blocks** (`[]`) represent objects and complex structures
- **Properties** (`()`) represent simple key-value metadata
- **Arrays** (`{}`) represent ordered collections of primitives

This keeps the language clean and forces good data modeling.

```ox
// ✓ Correct: Use blocks for structure
[User (name: "John", age: 30)
  [Address (street: "123 Main St", city: "Boston")]
]

// ✗ Wrong: Don't nest objects in properties
[User (address: (street: "123 Main St", city: "Boston"))]
```

### 2. Zero Runtime Overhead

All computation happens at build/compile time:
- Templates expand before runtime
- Expressions resolve to literals before runtime
- Final output is pure data (strings, numbers, booleans, arrays)

### 3. Language Agnostic

OX doesn't assume:
- Target language type systems
- Runtime capabilities (async, threading)
- Execution environment

Users control interpretation completely.

### 4. Explicit Over Implicit

- Expressions require parentheses: `(value + 10)` not `value + 10`
- Block references use `$` prefix: `$parent.width`
- Template variables use no prefix: `margin`
- Data sources use explicit `<on-data>` blocks

### 5. Separation of Concerns

**OX Parser** handles:
- Syntax parsing
- Template expansion
- Expression evaluation
- Tree building

**User Code** handles:
- Data source implementation
- Function libraries
- Tree interpretation
- Target code generation

---

## Core Concepts

### Blocks

Blocks are the fundamental building unit, enclosed in square brackets.

```ox
[Identifier]
```

Blocks can be nested to any depth:

```ox
[Parent
  [Child
    [GrandChild]
  ]
]
```

### Properties

Properties are key-value pairs attached to blocks, enclosed in parentheses.

```ox
[Block (key1: "value1", key2: 42, key3: true)]
```

Properties can be:
- **Literals**: strings, numbers, booleans, null
- **Arrays**: collections of values `{1, 2, 3}`
- **Expressions**: computed values `(width: ($parent.width - 20))`

### Tags

Tags provide metadata about blocks and are defined programmatically by users.

```ox
@component
[Button]

@component(PrimaryButton)
[LoginButton]
```

Tags allow users to:
- Mark blocks for special handling
- Filter blocks during interpretation
- Attach custom processing logic

### Comments

```ox
// Single-line comment

/* Multi-line
   comment */

[Block (key: "value")]  // Inline comment
```

---

## Syntax Specification

### Block Syntax

```
[Identifier (properties) {children}]
```

**Components:**
- `Identifier`: Block type/name (alphanumeric, underscore, hyphen)
- `(properties)`: Optional key-value pairs
- `{children}`: Child blocks

**Examples:**

```ox
// Block with no properties
[Container]

// Block with properties
[Box (width: 100, height: 50)]

// Block with children
[Container
  [Child1]
  [Child2]
]

// Block with properties and children
[Container (width: 200)
  [Child (x: 10)]
]
```

### Property Syntax

**Key-value pairs separated by commas:**

```ox
(key1: value1, key2: value2, key3: value3)
```

**Value types:**

```ox
// Strings (quotes optional for simple values)
(name: John)
(name: "John Doe")

// Numbers
(count: 42)
(price: 19.99)

// Booleans
(active: true)
(disabled: false)

// Null
(optional: null)

// Arrays
(items: {1, 2, 3})
(tags: {"red", "blue", "green"})

// Expressions (must be in parentheses)
(width: ($parent.width - 20))
(total: (price * quantity))
```

### Array Syntax

Arrays use curly braces `{}` to distinguish from blocks `[]`.

```ox
[Data (
  numbers: {1, 2, 3, 4, 5},
  colors: {"red", "green", "blue"},
  mixed: {1, "two", 3, "four"}
)]
```

### Expression Syntax

Expressions **must** be wrapped in parentheses within property values.

```ox
// ✓ Correct
[Box (width: (baseWidth + margin * 2))]

// ✗ Wrong - Parser error
[Box (width: baseWidth + margin * 2)]
```

**Why?** Prevents ambiguity and makes expressions explicit.

### Free Text Blocks

Free text blocks provide a native way to express prose, documentation, and unstructured text content using triple-backtick syntax (familiar from Markdown).

```ox
[Document
  ```
  This is a paragraph with free text content.
  It can span multiple lines and preserves whitespace.
  ```
]
```

**Key Features:**

1. **Whitespace Processing** - Uses Python's `textwrap.dedent()` algorithm:
   - Leading/trailing newlines are trimmed
   - Common indentation is removed from all lines
   - Intentional relative indentation is preserved

2. **Tag Support** - Free text blocks can have tag instances for semantic meaning:

```ox
[Article
  #markdown
  ```
  ## Heading
  
  Some **bold** text.
  ```
  
  #code(lang: "python")
  ```
  def factorial(n):
      return 1 if n <= 1 else n * factorial(n - 1)
  ```
]
```

3. **Block Merging** - Adjacent free text blocks with identical tags (or no tags) merge automatically:

```ox
[Content
  ```
  First paragraph.
  ```
  
  ```
  Second paragraph.
  ```
]
// Merges to: "First paragraph.\n\nSecond paragraph."
```

Blocks with different tags remain separate. Configure with `mergeFreeText: false` to disable.

4. **Escaping** - Use four or more backticks to include triple backticks in content:

```ox
[Example
  ````
  Here's markdown with a code block:
  ```
  code here
  ```
  ````
]
```

**Important:** Free text blocks are only allowed as children of blocks, not in properties.

```ox
// ✓ Correct - Free text as child
[Document
  ```Hello```
]

// ✗ Wrong - Free text not allowed in properties
[Block (prop: ```text```)]
```

### Tag Syntax

```ox
// Simple tag
@component
[Button]

// Tag with argument
@component(ButtonType)
[PrimaryButton]

// Multiple tags
@component
@interactive
[DraggableButton]
```

### Reusable Tags and Pattern Matching

Tags can enable pattern matching through the `canReuse` modifier, creating a powerful system for reusable blocks.

#### Tag Definition (`@` prefix)

Define reusable blocks that can be instantiated via pattern matching:

```ox
@component(Button)
[Button (width: 100, height: 50, bgColor: "blue")
  [Label (text: "Default")]
  [Icon (src: "icon.svg")]
]
```

**Rules for tag definitions:**
- Must use **literals only** (no expressions allowed)
- Can have children (including other tag instances)
- Stored in tag registry (not in final tree if `canOutput: false`)
- Pattern matched when tag instances (`#`) reference them

**Example with error:**
```ox
<set baseWidth = 100>

// ✗ ERROR: Tag definitions cannot use expressions
@component(Button)
[Button (width: (baseWidth))]

// ✓ Correct: Use literals only
@component(Button)
[Button (width: 100)]
```

**Tag definitions can contain tag instances:**
```ox
// Define container and button components
@component(Button)
[Button (width: 100, height: 50)]

@component(Container)
[Container (padding: 20)]

// Scene definition with tag instances inside
@scene [MainMenu
  #component(Container) [MenuButtons (flow: "top-down", spacing: 10)
    #component(Button) [NewGame (text: "New Game")]
    #component(Button) [LoadGame (text: "Load Game")]
    #component(Button) [Settings (text: "Settings")]
    #component(Button) [Exit (text: "Exit Game")]
  ]
]
```

This is valid because `@scene` is a definition, and definitions can contain tag instances as children.

#### Tag Instance (`#` single tag)

Instantiate a tag definition with custom properties:

```ox
#component(Button) [submitButton (text: "Submit", bgColor: "green")]
```

**Result (after pattern matching):**
```javascript
{
  id: "submitButton",
  properties: {
    width: 100,        // From tag definition
    height: 50,        // From tag definition
    bgColor: "green",  // Instance overrides definition
    text: "Submit"     // From instance
  },
  children: [
    { id: "Label", properties: { text: "Default" } },
    { id: "Icon", properties: { src: "icon.svg" } }
  ]
}
```

**Rules for tag instances:**
- **Can** have properties (with expressions)
- **Cannot** have children
- Properties merge with definition (instance overrides)
- Inherits definition's children

**Example with error:**
```ox
// ✗ ERROR: Tag instances cannot have children
#component(Button) [myButton (text: "Click")
  [CustomChild]
]

// ✓ Correct: Properties only
#component(Button) [myButton (text: "Click")]
```

#### Tag Composition (`#` multiple tags)

Compose multiple tag definitions into a single block:

```ox
#component(Button) #component(Icon) [ButtonWithIcon]
```

**Expansion process:**

1. Detect multiple tags on block
2. Generate child blocks (one per tag, in order)
3. Auto-generate child IDs: `{parentId}_{tagName}`
4. Pattern match each child to its tag definition
5. Expand recursively until no tags remain

**Result:**
```
[ButtonWithIcon
  [ButtonWithIcon_Button (width: 100, height: 50, bgColor: "blue")
    [Label (text: "Default")]
  ]
  [ButtonWithIcon_Icon (size: 24, src: "icon.svg")]
]
```

**Rules for tag composition:**
- **Cannot** have properties (composition is pure structure)
- **Cannot** have children
- Tag order determines child order
- Each generated child inherits from its tag definition

**Example with errors:**
```ox
// ✗ ERROR: Tag composition cannot have properties
#component(Button) #component(Icon) [Composite (x: 10)]

// ✗ ERROR: Tag composition cannot have children
#component(Button) #component(Icon) [Composite
  [Child]
]

// ✓ Correct: Pure composition
#component(Button) #component(Icon) [Composite]
```

#### Tag Declaration vs Usage

**Clear separation:**
```ox
// ✓ Declaration only
@component(Button)
[Button (width: 100)]

// ✓ Usage only (single or multiple)
#component(Button) [myButton]
#component(Button) #component(Icon) [composite]

// ✗ ERROR: Cannot mix declaration and usage
@component(Button) #component(Icon) [invalid]
```

#### Module System

Modules inject computed properties from external scope into tagged blocks.

**Definition:**
```javascript
parser.defineTag('entity', {
  block: {
    canReuse: true,
    canOutput: true
  },

  // Module properties (external data injection)
  module: {
    health: () => player.health,
    mana: () => player.mana,
    position: () => gameState.getPosition(),
    inventory: () => player.getInventory()
  },

  descriptor: {
    attributes: [{ type: "identifier" }]
  }
});
```

**Usage in OX:**
```ox
#entity(Player) [Player (x: 50, y: 50)]
```

**Result:**
```javascript
{
  id: "Player",
  properties: {
    x: 50,
    y: 50,
    health: 100,      // Injected from module
    mana: 50,         // Injected from module
    position: {...},  // Injected from module
    inventory: [...]  // Injected from module
  }
}
```

**Rules for module properties:**
- Module functions are simple value getters (no parameters)
- Called during preprocessing (synchronous)
- Module properties **cannot** be overridden in OX (error on conflict)
- Values can be any type (primitives, arrays, objects)

**Example with error:**
```ox
// ✗ ERROR: Cannot override module property 'health'
#entity(Player) [Player (health: 50)]

// ✓ Correct: Module owns 'health'
#entity(Player) [Player (x: 50, y: 50)]
```

#### Tag Scope

**Tags are global** - defined in JavaScript/user code, available in all OX files:

```javascript
// User defines tags once when setting up parser
parser.defineTag('component', {
  block: { canReuse: true, canOutput: false }
});

// Now @component and #component available in all OX files
```

### Tag Rules Summary

| Block Type | Properties Allowed | Children Allowed | Expressions Allowed | Notes |
|------------|-------------------|------------------|---------------------|-------|
| `@tag` (definition) | ✓ (literals only) | ✓ (including tag instances) | ✗ | Stored in registry, may be excluded from tree |
| `#tag` (single instance) | ✓ | ✗ (if acceptChildren: false) | ✓ | Merges with definition, inherits children |
| `#tag #tag` (composition) | ✗ | ✗ | N/A | Generates child blocks, pure structure |
| Regular block | ✓ | ✓ | ✓ | Standard block behavior |
| Module-tagged block | ✓ (non-module) | ✓ | ✓ | Module properties injected, cannot override |

---

## Macro System

The macro system provides users with powerful meta-programming capabilities during preprocessing. Users can intercept blocks during evaluation, control processing order, and manipulate properties before the final tree is generated.

### Two Macro Hooks

#### 1. Pre-Parse Hook (`onParse`)

Called **once** before any preprocessing begins, giving access to the raw parsed tree:

```javascript
oxparser.init.onParse = function() {
  // Full parsed tree available
  // Templates, expressions, tags all intact (not evaluated)
  // Use for: code generation, analysis, custom transformations

  // Can walk entire tree
  oxparser.walk(oxparser.tree, (block, parent) => {
    console.log(`Block: ${block.id}, Tags: ${block.tags}`);
  });

  // Can terminate preprocessing early
  if (someCondition) {
    oxparser.finish(); // Skip all preprocessing, return current tree
  }
};
```

**Use cases:**
- Code generation requiring template/expression visibility
- Static analysis of OX structure
- Custom preprocessing transformations
- Early termination for partial processing

#### 2. Macro Walk Hook (`onWalk`)

Called for **every block** during preprocessing, after block properties are evaluated but before children are processed:

```javascript
oxparser.macros.onWalk = function(block, parent) {
  // block.properties: EVALUATED (expressions resolved to literals)
  // block.children: EXIST but properties NOT YET evaluated
  // parent: parent block (or null if root)

  // User controls child evaluation order
  const next = oxparser.macros.nextBlock();
  if (next) {
    oxparser.macros.invokeWalk(next, block);
    // After this: next.properties are evaluated
  }

  // Modify parent based on evaluated children
  block.properties.width = next.properties.width + 10;
};
```

**Use cases:**
- Auto-sizing layouts (parent dimensions from children)
- Conditional child processing (skip hidden branches)
- Property validation and defaults
- Dynamic property computation

### Evaluation Flow with Macros

**Without macros:**
```
Parse → Evaluate Block A → Evaluate Child 1 → Evaluate Child 2 → Final Tree
```

**With macros:**
```
Parse → onParse() →
  Evaluate Block A properties →
  onWalk(Block A) →
    User can:
      - Peek at Child 1 (nextBlock)
      - Evaluate Child 1 (invokeWalk)
      - Read Child 1 properties (now literals)
      - Modify Block A properties
  Return from onWalk →
  Auto-evaluate remaining children →
  Commit Block A to final tree
```

### Macro API Reference

#### Pre-Parse API

```javascript
// Set pre-parse callback
oxparser.init.onParse = function() {
  // Called once before preprocessing
  // Full tree available in oxparser.tree
};

// Early termination
oxparser.finish();
// Stops preprocessing immediately
// Returns current tree state
```

#### Macro Walk API

```javascript
// Set macro walk callback
oxparser.macros.onWalk = function(block, parent) {
  // Called for each block during preprocessing
  // block: current block (properties evaluated)
  // parent: parent block or null
};

// Peek at next block
const next = oxparser.macros.nextBlock();
// Returns: next block or null
// Doesn't advance cursor
// next.properties still contain expressions (not evaluated)

// Manually evaluate block
oxparser.macros.invokeWalk(block, parent);
// Advances cursor to this block
// Evaluates block's properties (resolves expressions)
// Calls onWalk(block, parent) recursively
// After return: block.properties are literals

// Move cursor backward
oxparser.macros.back();
// Moves cursor back one position
// Use with caution - can create infinite loops

// Throw macro error
oxparser.macros.throwError(message);
// Stops preprocessing with error
// User-controlled validation errors
```

### Property Evaluation Guarantees

When `onWalk(block, parent)` is called:

**Guaranteed evaluated:**
- `block.properties` - All expressions resolved to literals
- `parent.properties` - Parent was already processed
- Module-injected properties - Available and evaluated

**Not yet evaluated:**
- `block.children[].properties` - Still contain expressions
- Next sibling properties - Until you call `invokeWalk()`

**To evaluate a child:**
```javascript
const child = oxparser.macros.nextBlock();
oxparser.macros.invokeWalk(child, block);
// Now: child.properties are literals
```

### Use Case Examples

#### Auto-Sizing Container

```javascript
oxparser.macros.onWalk = function(block, parent) {
  if (block.properties["auto-size"] === true) {
    let totalWidth = 0;
    let totalHeight = 0;
    let next;

    // Manually process all children
    while ((next = oxparser.macros.nextBlock()) && next.parent === block) {
      oxparser.macros.invokeWalk(next, block); // Evaluate child

      totalWidth += next.properties.width || 0;
      totalHeight = Math.max(totalHeight, next.properties.height || 0);
    }

    // Set parent size based on children
    block.properties.width = totalWidth;
    block.properties.height = totalHeight;
  }
};
```

**OX input:**
```ox
[Container (auto-size: true, padding: 10)
  [Item (width: 100, height: 50)]
  [Item (width: 150, height: 75)]
  [Item (width: 80, height: 60)]
]
```

**Result:**
```javascript
{
  id: "Container",
  properties: {
    "auto-size": true,
    padding: 10,
    width: 330,   // 100 + 150 + 80
    height: 75    // max(50, 75, 60)
  }
}
```

#### Conditional Child Processing

```javascript
oxparser.macros.onWalk = function(block, parent) {
  // Only process children if parent is visible
  if (block.properties.visible === false) {
    // Skip all children - won't be in final tree
    return;
  }

  // Let preprocessor auto-evaluate children
};
```

**OX input:**
```ox
[Container (visible: false)
  [ExpensiveComponent]  // Won't be evaluated or in final tree
  [AnotherComponent]    // Won't be evaluated or in final tree
]
```

#### Property Validation

```javascript
oxparser.macros.onWalk = function(block, parent) {
  // Validate required properties
  if (block.id === "Button" && !block.properties.label) {
    oxparser.macros.throwError(`Button at ${block.metadata.line} must have a label property`);
  }

  // Set defaults
  if (block.id === "Container" && block.properties.padding === undefined) {
    block.properties.padding = 0;
  }

  // Type validation
  if (block.properties.width && typeof block.properties.width !== 'number') {
    oxparser.macros.throwError(`Width must be a number, got ${typeof block.properties.width}`);
  }
};
```

#### Peek and Conditional Evaluation

```javascript
oxparser.macros.onWalk = function(block, parent) {
  const next = oxparser.macros.nextBlock();

  if (next && next.id === "Separator") {
    // Don't process separator if it's the last child
    const afterSeparator = oxparser.macros.nextBlock(); // Peek further
    if (!afterSeparator) {
      // Skip separator - it's trailing
      return;
    }
    oxparser.macros.back(); // Go back to separator
  }

  // Let preprocessor handle normal processing
};
```

#### Code Generation with Pre-Parse

```javascript
oxparser.init.onParse = function() {
  // Generate TypeScript types from OX structure
  const types = [];

  oxparser.walk(oxparser.tree, (block) => {
    if (block.tags.includes('component')) {
      const props = Object.keys(block.properties).join(', ');
      types.push(`interface ${block.id} { ${props} }`);
    }
  });

  fs.writeFileSync('generated-types.ts', types.join('\n'));

  // Continue with normal preprocessing
};
```

### Important Notes

**Cursor Management:**
- `nextBlock()` is a **peek** - doesn't advance cursor
- `invokeWalk()` is an **advance** - processes block and moves cursor
- `back()` is a **rewind** - moves cursor backward
- Users must be careful to avoid infinite loops

**Property Modification:**
- Can modify: `block.properties.width = 100;`
- Can add: `block.properties.customProp = "value";`
- Cannot delete (not recommended): `delete block.properties.width;`
- Modifications are permanent in final tree

**Auto-Processing:**
- If user doesn't manually walk children, preprocessor auto-evaluates them
- Depth-first traversal is default
- User only needs control when custom ordering required

**Error Handling:**
- Use `throwError()` for validation failures
- Errors stop preprocessing immediately
- User is responsible for loop prevention with `back()`

---

### Template Syntax

Templates use angle brackets `<>` with explicit parentheses for expressions.

```ox
// Variable declaration
<set variableName = value>

// Conditional
<if (condition)>
  [Block]
</if>

// Loop
<foreach (item in collection)>
  [Item (value: (item))]
</foreach>

// Data source
<on-data dataSourceName>
  [Block]
<on-error>
  [ErrorBlock]
</on-data>
```

---

## Template System

Templates are evaluated during the **pre-processing phase** to generate the final block tree.

### Variable Declaration

```ox
<set variableName = value>
<set screenWidth = 1920>
<set margin = 20>
<set isDark = true>
<set colors = {"red", "green", "blue"}>
```

**Scope:**
- Variables defined at root level are global
- Variables defined inside blocks are scoped to that subtree
- Variables from transaction are globally available

### Variable References

Template variables are referenced **without** the `$` prefix:

```ox
<set margin = 20>

[Box (
  padding: (margin),
  width: (screenWidth - margin * 2)
)]
```

### Conditional Blocks

```ox
<if (condition)>
  [Block1]
</if>

<if (count > 0)>
  [Display (label: "Has items")]
<elseif (count == 0)>
  [Display (label: "Empty")]
<else>
  [Display (label: "Error")]
</if>
```

**Supported conditions:**
- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logical: `&&`, `||`, `!`
- Parentheses for grouping: `((a > 5) && (b < 10))`

### Foreach Loops

**Basic iteration:**

```ox
<set items = {"apple", "banana", "cherry"}>

<foreach (item in items)>
  [Item (value: (item))]
</foreach>
```

**With index:**

```ox
<foreach (item, index in items)>
  [Item (
    value: (item),
    position: (index),
    isFirst: (index == 0)
  )]
</foreach>
```

**Range iteration:**

```ox
<foreach (i in range(0, 10))>
  [Box (id: (i))]
</foreach>

<foreach (i in range(5, 15, 2))>  // Start, end, step
  [Item (value: (i))]
</foreach>
```

### While Loops (Optional)

```ox
<set count = 0>
<set limit = 10>

<while (count < limit)>
  [Item (index: (count))]
  <set count = (count + 1)>
</while>
```

**Note:** While loops should be used sparingly. Most use cases are better served by `foreach`.

### Nested Templates

Templates can be nested:

```ox
<set rows = 3>
<set cols = 4>

<foreach (row in range(0, rows))>
  [Row (index: (row))
    <foreach (col in range(0, cols))>
      [Cell (row: (row), col: (col))]
    </foreach>
  ]
</foreach>
```

---

## Expression System

### Reference Syntax

**Block references** (with `$` prefix):

```ox
[Parent (width: 100)
  [Child (
    width: ($parent.width - 20),    // Parent block
    x: ($this.width / 2),           // Current block
    y: ($Sibling.height + 10)       // Named sibling
  )]
  [Sibling (height: 50)]
]
```

**Template variables** (no `$` prefix):

```ox
<set margin = 20>

[Box (padding: (margin))]
```

### Block Reference Types

**`$parent`** - Direct parent block:

```ox
[Container (width: 100)
  [Child (width: ($parent.width))]  // 100
]
```

**`$parent.parent`** - Grandparent (chaining):

```ox
[Root (size: 200)
  [Container
    [Child (size: ($parent.parent.size))]  // 200
  ]
]
```

**`$this`** - Current block (self-reference):

```ox
[Box (
  width: 100,
  centerX: ($this.width / 2)  // 50
)]
```

**`$BlockId`** - Named block reference (within parent scope):

```ox
[Container
  [Sidebar (width: 300)]
  [Content (
    x: ($Sidebar.width + 20),  // 320
    width: ($parent.width - $Sidebar.width)
  )]
]
```

### Resolution Order

When resolving `$BlockId`:
1. Search siblings at current level
2. If not found, error: "Block 'BlockId' not found"

**Note:** Forward references require two-pass resolution (covered in implementation).

### Operators

**Arithmetic:**
- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Division
- `%` Modulo
- `**` Exponentiation

**Comparison:**
- `==` Equals
- `!=` Not equals
- `>` Greater than
- `<` Less than
- `>=` Greater than or equal
- `<=` Less than or equal

**Logical:**
- `&&` And
- `||` Or
- `!` Not

**Grouping:**
- `()` Parentheses for precedence

**Examples:**

```ox
[Box (
  // Arithmetic
  width: (baseWidth * 2 + margin),
  height: (100 / 2 ** 2),  // 25

  // Comparison
  visible: (count > 0),
  active: (status == "ready"),

  // Logical
  enabled: (isActive && !isDisabled),
  show: ((count > 0) || forceShow),

  // Complex
  x: ((screenWidth - $this.width) / 2)  // Center horizontally
)]
```

### Type Coercion

Since all values are strings until interpreted, OX performs minimal coercion during expression evaluation:

- Numbers are parsed from strings: `"100" → 100`
- Booleans: `"true" → true`, `"false" → false`
- Null: `"null" → null`

Users control final type interpretation in their code.

### Functions

Functions are provided by the user via transaction configuration:

```ox
[Box (
  width: (max(100, $parent.width * 0.5)),
  height: (clamp($value, 50, 200)),
  label: (concat("Item ", index))
)]
```

**Standard function library is recommended but not required:**
- Math: `min`, `max`, `abs`, `round`, `floor`, `ceil`, `sqrt`
- String: `concat`, `length`, `substring`, `uppercase`, `lowercase`
- Array: `length`, `join`
- Type casting: `string`, `number`, `boolean`

---

## Transaction Architecture

Transactions provide a clean interface for supplying data, functions, and configuration to the OX parser.

### Transaction Creation

```javascript
const transaction = parser.createTransaction({
  // Variables (globally available in OX)
  variables: {
    screenWidth: 1920,
    screenHeight: 1080,
    margin: 20,
    theme: "dark"
  },

  // Functions (available in expressions)
  functions: {
    max: Math.max,
    min: Math.min,
    round: Math.round,
    clamp: (val, min, max) => Math.max(min, Math.min(max, val))
  },

  // Data sources
  dataSources: {
    // Option A: Direct async function
    users: async () => {
      return await db.query("SELECT * FROM users");
    },

    // Option B: Wrapper with transaction access (setup phase)
    posts: (tx) => {
      const limit = tx.getVariable('limit') || 10;
      return async () => {
        return await db.query("SELECT * FROM posts LIMIT ?", [limit]);
      };
    }
  },

  // Configuration
  config: {
    timeout: 5000,  // Data source timeout
    allowVariableOverride: false,  // Prevent OX from shadowing JS variables
    strictMode: true  // Error on undefined variables
  }
});
```

### Variable Scoping

**JavaScript → OX (global):**

Variables defined in the transaction are immediately available in OX files without declaration:

```javascript
transaction.setVariable('margin', 20);
```

```ox
// No declaration needed
[Box (padding: (margin))]
```

**Naming conflicts:**

```ox
// Transaction provides: screenWidth = 1920

<set screenWidth = 1024>  // ← Behavior depends on config

// If allowVariableOverride = false: ERROR
// If allowVariableOverride = true: WARNING, uses 1024
```

### Data Source Configuration

**Configurator pattern** - User controls external configuration:

```javascript
// User-side configuration (outside OX)
function createUserDataSource(config) {
  const { limit, offset, filters } = config;

  // Return function that OX will call
  return async function() {
    return await db.query(`
      SELECT * FROM users
      WHERE ${filters}
      LIMIT ${limit} OFFSET ${offset}
    `);
  };
}

// User can modify configuration
let userDataSource = createUserDataSource({ limit: 50, offset: 0, filters: "active = true" });

// Pass to transaction
transaction.addDataSource('users', userDataSource);

// Later, update configuration without touching OX
userDataSource = createUserDataSource({ limit: 100, offset: 0, filters: "active = true" });
transaction.setDataSource('users', userDataSource);
```

**Wrapper with transaction access:**

```javascript
dataSources: {
  users: (tx) => {
    // Setup phase: access transaction state
    const role = tx.getVariable('userRole');
    const limit = tx.getVariable('limit') || 50;

    // Return the function OX calls
    return async () => {
      return await db.query(`
        SELECT * FROM users
        WHERE role = ?
        LIMIT ?
      `, [role, limit]);
    };
  }
}
```

### Transaction API

```javascript
// Variable management
transaction.setVariable(name, value);
transaction.getVariable(name);
transaction.hasVariable(name);
transaction.deleteVariable(name);
transaction.getAllVariables();

// Function management
transaction.addFunction(name, func);
transaction.removeFunction(name);
transaction.hasFunction(name);

// Data source management
transaction.addDataSource(name, asyncFuncOrWrapper);
transaction.setDataSource(name, asyncFuncOrWrapper);  // Update existing
transaction.removeDataSource(name);
transaction.hasDataSource(name);

// Data source execution
transaction.fetchDataSources(names);  // Manually fetch specific sources
transaction.getDataSourceResult(name);
transaction.getDataSourceError(name);
transaction.clearDataSourceCache();

// State
transaction.reset();  // Clear all modifications
transaction.clone();  // Create independent copy
```

---

## Data Sources and Async Handling

### The `<on-data>` Template

Data sources are accessed using the explicit `<on-data>` template block:

```ox
<on-data dataSourceName>
  // Blocks here have access to fetched data
  <foreach (item in dataSourceName)>
    [Item (value: (item))]
  </foreach>

<on-error>
  // Blocks here render if fetch fails
  [ErrorBlock (message: "Failed to load data")]
</on-error>
</on-data>
```

**Why `<on-data>`?**
- Makes async boundaries explicit in OX syntax
- Language-agnostic (doesn't assume async/await support)
- Gives users control over fetch mechanism
- Clear separation from regular templates

### Basic Usage

```ox
<on-data users>
  <if (users.length > 0)>
    [UserList
      <foreach (user in users)>
        [User (
          id: (user.id),
          name: (user.name),
          role: (user.role)
        )]
      </foreach>
    ]
  <else>
    [EmptyState (message: "No users found")]
  </if>

<on-error>
  [ErrorState (message: "Failed to fetch users")]
</on-error>
</on-data>
```

### Error Handling with `$error`

The `<on-error>` block provides access to error details via `$error`:

```ox
<on-data users>
  [UserList]

<on-error>
  [ErrorBlock (
    message: ($error.message),
    code: ($error.code),
    source: ($error.source),
    timestamp: ($error.timestamp)
  )]

  <if ($error.code == "TIMEOUT")>
    [RetryButton (label: "Connection timeout - Retry?")]
  <elseif ($error.code == "NOT_FOUND")>
    [InfoMessage (text: "No data available")]
  <else>
    [GenericError (details: ($error.message))]
  </if>
</on-error>
</on-data>
```

**`$error` structure:**

```javascript
{
  message: "Database connection failed",
  code: "ECONNREFUSED",
  source: "users",  // Data source name
  timestamp: 1234567890
}
```

### Nested Data Sources

```ox
<on-data users>
  [UserSection
    <foreach (user in users)>
      [User (name: (user.name))]
    </foreach>
  ]

  <on-data posts>
    [PostSection
      <foreach (post in posts)>
        [Post (title: (post.title))]
      </foreach>
    ]

  <on-error>
    [Error (message: "Failed to load posts")]
  </on-error>
  </on-data>

<on-error>
  [Error (message: "Failed to load users")]
</on-error>
</on-data>
```

**Execution order:**
1. Fetch `users`
2. If success, expand users blocks
3. Fetch `posts`
4. If success, expand posts blocks
5. Each `<on-error>` catches its corresponding `<on-data>`

### Parallel Data Sources

```ox
// Parallel (separate top-level blocks)
<on-data users>
  [UserList]
</on-data>

<on-data posts>
  [PostList]
</on-data>
```

**Pre-processor behavior:**

```javascript
// Fetches both in parallel
await Promise.all([
  dataSource.users(),
  dataSource.posts()
]);
```

### Pre-processing Phases for Data Sources

```
Phase 1: Parse
  - Build initial tree
  - Extract templates
  - Identify <on-data> blocks

Phase 2: Data Source Detection
  - Scan for <on-data> references
  - Build dependency graph
  - Validate all sources exist

Phase 3: Data Source Execution
  - Execute fetch (respecting nesting/parallel)
  - Cache results
  - Capture errors per source

Phase 4: Template Expansion
  - Expand <on-data> with fetched data
  - Or expand <on-error> if fetch failed
  - Continue normal template processing

Phase 5: Expression Resolution
  - Resolve $references
  - Evaluate expressions
  - Output pure data tree
```

---

## Complete Preprocessing Architecture

The OX parser follows a multi-phase preprocessing pipeline to transform authored OX code into pure data structures.

### Phase 1: Parse & Tag Detection
```
Parse all blocks into initial AST
For each block:
  - Identify tags (@tag or #tag)
  - Check tag definitions exist
  - Classify blocks:
    * Tag definition (@tag with canReuse)
    * Tag instance (#tag)
    * Tag composition (multiple #tags)
    * Regular block
  - Validate: no mixing @ and # on same block
  - Extract expressions (cache for later resolution)
  - Extract templates (cache for later expansion)
```

### Phase 2: Tag Registry
```
For blocks with @tag (canReuse):
  - Validate: all properties are literals (no expressions)
  - Store in tag registry: { "tagName(Argument)": blockDefinition }
  - If canOutput: false, mark for exclusion from final tree
  - If duplicate definition: ERROR
```

### Phase 3: Tag Composition Expansion
```
For blocks with multiple #tags:
  - Generate child blocks (one per tag, in order)
  - Auto-generate child IDs: {parentId}_{tagName}
  - Error if parent has properties or children
  - Recurse until no more multiple tags
```

### Phase 4: Tag Instance Expansion
```
For blocks with single #tag:
  - Pattern match to tag definition by name/argument
  - Merge properties (instance overrides definition)
  - Copy definition's children to instance
  - Error if instance has children (when acceptChildren: false)
  - Continue to next phase
```

### Phase 5: Module Property Injection
```
For all blocks with tags that have module definitions:
  - Call module functions (simple value getters)
  - Inject returned values as properties
  - Error if property name conflicts with existing property
```

### Phase 6: Pre-Parse Macro Hook (NEW)
```
If oxparser.init.onParse is defined:
  - Call onParse() once
  - User can:
    * Walk full parsed tree (templates/expressions intact)
    * Generate code from raw structure
    * Call oxparser.finish() for early termination
  - If finish() called: skip remaining phases, return current tree
  - Otherwise: continue to next phase
```

### Phase 7: Data Source Detection
```
Scan for <on-data> blocks:
  - Build dependency graph
  - Validate all data sources exist in transaction
  - Determine fetch order (parallel vs sequential)
```

### Phase 8: Data Source Execution
```
Execute data source fetches:
  - Call async functions (respecting timeout)
  - Cache results in transaction
  - Capture errors per source
```

### Phase 9: Template Expansion with Macro Walk (MODIFIED)
```
Expand templates and evaluate expressions (depth-first):
  For each block:
    9a. Evaluate templates (<if>, <foreach>, <on-data>, etc.)
    9b. For each resulting block:
        - Evaluate block's property expressions → literals
        - Mark block as "semi-final"

        If oxparser.macros.onWalk is defined:
          - Call onWalk(block, parent)
          - User can:
            * Read block.properties (evaluated literals)
            * Peek at children via nextBlock()
            * Manually evaluate children via invokeWalk()
            * Modify block.properties
            * Throw validation errors via throwError()
          - User returns from onWalk

        - Auto-evaluate any unwalked children (depth-first)
        - Each child goes through same process (9a-9b recursively)
        - Mark block as "final"
        - Commit to tree
```

### Phase 10: Final Expression Resolution
```
Resolve any remaining expressions:
  - Resolve template variables
  - Resolve $parent, $this, $BlockId references
  - Evaluate arithmetic, logical, comparison operators
  - Call user-supplied functions
  - Convert to literals
```

### Phase 11: Output Pure Tree
```
Final tree contains:
  - Regular blocks
  - Tag instances (fully expanded and resolved)
  - Module properties injected
  - User-modified properties (from macro walk)
  - Expressions resolved to literals
  - NO tag definitions (if canOutput: false)
  - NO template markers
  - NO expressions
  → Pure data: strings, numbers, booleans, arrays
```

---

## Parser API

### Parser Creation

```javascript
const oxparser = require('oxparser');

const parser = oxparser.createParser({
  // Timeout configuration
  timeout: 5000,  // Default for data sources (ms)

  // Parser mode
  streaming: false,  // true for streaming parser

  // Error handling
  errorHandling: {
    continueOnError: true,    // Continue if one data source fails
    throwOnParseError: true,  // Fail fast on syntax errors
    collectAllErrors: true    // Collect all preprocessing errors
  },

  // Performance
  caching: {
    parseCache: true,        // Cache parsed AST
    dataSourceCache: true    // Cache data source results
  }
});
```

### Parsing

```javascript
// Parse from file
const parsed = parser.parse("layout.ox");

// Parse from string
const code = `
  [Container (width: 100)
    [Child]
  ]
`;
const parsed = parser.parseString(code);
```

**Parsed object contains:**
- Initial block tree (with template/expression markers)
- Extracted expressions cache
- Extracted templates cache
- Import dependencies
- Metadata (file paths, line numbers)

### Execution

```javascript
// Create transaction
const transaction = parser.createTransaction({
  variables: { screenWidth: 1920 },
  functions: { max: Math.max },
  dataSources: {
    users: async () => await fetchUsers()
  }
});

// Execute (automatic data fetching)
const result = await parser.executeWithTransaction(parsed, transaction);

// Result structure
result = {
  tree: [...],      // Pure data blocks
  errors: [...],    // Preprocessing errors
  warnings: [...],  // Warnings

  metadata: {
    parseTime: 10,           // ms
    preprocessTime: 45,      // ms
    dataSourceTime: 230,     // ms
    totalTime: 285,          // ms
    dataSourcesFetched: ['users', 'posts'],
    dataSourcesTimedOut: [],
    dataSourcesFailed: [],
    blocksProcessed: 156
  }
};
```

### Tree Access

```javascript
// Access root blocks
const blocks = result.tree;  // Array of root blocks

// Find block by ID
const container = parser.find(result.tree, "Container");

// Query with predicate
const buttons = parser.query(result.tree, block =>
  block.id === "Button" && block.properties.primary === true
);
```

### Walking

```javascript
// Walk tree (depth-first)
parser.walk(result.tree, (block, parent, context) => {
  console.log(`Block: ${block.id}`);
  console.log(`Properties:`, block.properties);
  console.log(`Parent:`, parent?.id);
  console.log(`Level: ${context.level}, Index: ${context.index}`);
});

// Reverse walk (up the tree)
parser.walk(result.tree, (block, parent, context) => {
  // Set context for reverse walk
  context.level = parent.level;
  context.index = parent.index;

  parser.reverseWalk(context, (ancestorBlock, ancestorParent) => {
    console.log(`Ancestor: ${ancestorBlock.id}`);
  });
});
```

**Walk callback signature:**

```javascript
(block, parent, context) => {
  // block: Current block object
  // parent: Parent block (null if root)
  // context: { level: number, index: number }
}
```

### Tag Definition

```javascript
parser.defineTag('component', {
  // Block-level configuration
  block: {
    output: function(block) {
      // Called for blocks with this tag
      // Even if canOutput: false, this is still invoked
      // User can perform custom processing here
      componentRegistry.push(block);
    },

    canReuse: true,        // Enables pattern matching (#tag syntax)
    canOutput: false,      // Exclude @tag definitions from tree
    acceptChildren: false  // When false, #tag instances cannot have children
                           // (definitions can always have children)
  },

  // Module properties (computed from external scope)
  module: {
    propertyName: () => externalValue,
    // Simple value getters - no parameters
    // Called during preprocessing
    // Values injected as properties
  },

  // Descriptor configuration
  descriptor: {
    attributes: [
      {
        type: "identifier",  // Expected argument type
        required: false
      }
    ],
    exposeAs: []  // User metadata for code generation
  }
});
```

**Usage in OX:**

```ox
@component(Button)
[Button (label: "Click")]

@component(PrimaryButton)
[LoginButton]
```

### Custom Block Properties

```javascript
// Set default properties for all blocks
parser.blockOptions.properties = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  visible: true
};

// Now all blocks inherit these properties
// (overridden by user-specified properties)
```

### Serialization

```javascript
// Serialize parsed object (before preprocessing)
const serialized = parser.serializeParsed(parsed);
fs.writeFileSync("parsed.json", JSON.stringify(serialized));

// Deserialize and execute later
const loaded = parser.deserializeParsed(serialized);
const result = await parser.executeWithTransaction(loaded, transaction);

// Serialize final tree (after preprocessing)
const serializedTree = parser.serializeTree(result.tree);
fs.writeFileSync("tree.json", JSON.stringify(serializedTree));

// Load pure data tree
const tree = parser.deserializeTree(serializedTree);
```

---

## Error Handling

### Two-Stage Error Handling

**Stage 1: Parsing (fail fast)**

Syntax errors cause immediate failure:

```javascript
try {
  const parsed = parser.parse("layout.ox");
} catch (error) {
  console.error(`Parse error: ${error.message}`);
  console.error(`  at line ${error.line}, column ${error.column}`);
  // Don't proceed to preprocessing
}
```

**Stage 2: Preprocessing (collect all)**

Preprocessing errors are collected and reported together:

```javascript
const result = await parser.executeWithTransaction(parsed, transaction);

if (result.errors.length > 0) {
  console.error("Preprocessing errors:");
  result.errors.forEach(error => {
    console.error(`  ${error.type}: ${error.message}`);
    console.error(`    at ${error.location.file}:${error.location.line}`);
  });
}

// Even with errors, partial tree may be available
if (result.tree) {
  // Continue with interpretation or fail
}
```

### Error Types

**Parse errors (Stage 1):**
- Syntax errors: `Unexpected token ']'`
- Unclosed brackets: `Expected ']' but reached end of file`
- Invalid tokens: `Invalid character '\u0000'`
- Expression without parentheses: `Expression used as literal. Use parentheses`

**Preprocessing errors (Stage 2):**
- Undefined variable: `Variable 'margin' is not defined`
- Undefined block reference: `Block 'Sidebar' not found in scope`
- Circular dependency: `Circular reference: Block A → Block B → Block A`
- Type mismatch: `Cannot add string and number`
- Division by zero: `Division by zero in expression`
- Data source timeout: `Data source 'users' timed out after 5000ms`
- Data source error: `Data source 'users' failed: Network error`
- Tag not defined: `Tag 'component' is not defined`
- Tag definition not found: `No definition found for #component(Button)`
- Duplicate tag definition: `Tag @component(Button) already defined`
- Mixed tag usage: `Cannot mix @tag and #tag on same block`
- Tag definition with expression: `Tag definitions cannot use expressions in properties`
- Tag instance with children: `Tag instances cannot have children`
- Tag composition with properties: `Tag composition cannot have properties`
- Tag composition with children: `Tag composition cannot have children`
- Module property conflict: `Cannot override module property 'health'`

### Error Object Structure

```javascript
{
  type: "PreprocessError",
  subtype: "UndefinedVariable",
  message: "Variable 'margin' is not defined",
  location: {
    file: "layout.ox",
    line: 10,
    column: 15
  },
  context: "[Box (width: (margin * 2))]",
  suggestion: "Did you mean 'marginX'?"
}
```

### Error Recovery

When preprocessing encounters errors, it:
1. **Skip errored blocks** - Don't include in final tree
2. **Continue processing** - Process other blocks
3. **Collect all errors** - Report everything at end
4. **Produce partial tree** - Return what succeeded

This allows users to see all issues at once rather than fixing one at a time.

### Warnings

Non-fatal issues reported as warnings:

```javascript
result.warnings = [
  {
    type: "VariableOverride",
    message: "Variable 'screenWidth' overrides transaction variable",
    location: { file: "layout.ox", line: 5, column: 1 }
  },
  {
    type: "UnusedVariable",
    message: "Variable 'unused' is declared but never used",
    location: { file: "layout.ox", line: 12, column: 1 }
  }
];
```

---

## Multi-File Support

### Import Syntax

```ox
// Import single file
<import "./config.ox">

// Import all files in directory
<import "./components">

// Import with namespace (future feature)
<import "./utils" as util>
```

### Import Resolution

**Relative imports:**

```
project/
├── main.ox
├── config.ox
└── components/
    ├── button.ox
    └── card.ox
```

```ox
// In main.ox:
<import "./config.ox">
<import "./components">
```

**Resolution rules:**
1. Resolve relative to current file's directory
2. For directories, load all `.ox` files (non-recursive by default)
3. Files imported in alphabetical order
4. Circular imports detected and reported as error

### Import Behavior

**Template variables:**

```ox
// config.ox:
<set appName = "MyApp">
<set version = "1.0.0">
```

```ox
// main.ox:
<import "./config.ox">

[Header (title: (appName + " v" + version))]
```

Template variables from imported files are available in importing file.

**Blocks:**

```ox
// components/button.ox:
[ButtonTemplate (label: "Default", width: 100)]
```

```ox
// main.ox:
<import "./components">

@component
[Button
  $ButtonTemplate  // Reference imported block
]
```

**Scoping:**
- Imports are file-scoped (not global)
- Each file's imports only affect that file
- No implicit transitive imports

### Parser API for Imports

```javascript
// Parse with import resolution
const parsed = parser.parse("main.ox", {
  basePath: "./project",  // Base directory for imports
  recursive: false,       // Recurse into subdirectories
  extensions: [".ox"]     // File extensions to load
});

// Get import graph
const imports = parser.getImports(parsed);
// Returns: { "main.ox": ["./config.ox", "./components/button.ox", ...] }

// Resolve all imports
const resolved = await parser.resolveImports(parsed);
```

---

## Streaming Architecture

### Design Philosophy

Streaming is handled by **separate parser instances** to avoid conflating large data structures with UI definitions. Users programmatically merge streamed data into UI trees.

### Architecture

```
┌─────────────────────┐
│  UI Parser          │ → Static structure
│  (regular mode)     │    Fast, cached
└─────────────────────┘
          ↓
    [Container]
    [Sidebar]
    [ContentArea ← injection point]

┌─────────────────────┐
│  Stream Parser      │ → Dynamic data
│  (streaming mode)   │    Chunked, progressive
└─────────────────────┘
          ↓
    [Item 1] → chunk
    [Item 2] → chunk
    [Item 3] → chunk
    ...
```

### Streaming Parser Creation

```javascript
const streamParser = oxparser.createParser({
  streaming: true,  // Enable streaming mode
  timeout: 30000,   // Longer timeout for streams
  chunkSize: 10     // Emit every N blocks
});
```

### Streaming Data Sources

```javascript
const streamTransaction = streamParser.createTransaction({
  dataSources: {
    items: (tx) => {
      return {
        subscribe: (observer) => {
          // Observable-like interface
          const stream = db.streamQuery("SELECT * FROM items");

          stream.on('data', (row) => {
            observer.next({ item: row });  // Emit data
          });

          stream.on('end', () => {
            observer.complete();  // Signal completion
          });

          stream.on('error', (err) => {
            observer.error(err);  // Signal error
          });
        }
      };
    }
  }
});
```

### Streaming Execution

```javascript
const streamParsed = streamParser.parse("items.ox");

streamParser.executeWithStreaming(streamParsed, streamTransaction, {
  onChunk: (blocks) => {
    // Handle chunk of processed blocks
    console.log(`Received ${blocks.length} blocks`);
  },

  onComplete: () => {
    console.log("Stream complete");
  },

  onError: (error) => {
    console.error("Stream error:", error);
  }
});
```

### Programmatic Merging

```javascript
// UI parser (regular mode)
const uiParser = oxparser.createParser();
const uiParsed = uiParser.parse("ui.ox");
const uiResult = await uiParser.executeWithTransaction(uiParsed, uiTransaction);

// Find injection target
const contentArea = uiResult.tree
  .find(b => b.id === "Container")
  .children
  .find(b => b.id === "ContentArea");

// Stream parser (streaming mode)
const streamParser = oxparser.createParser({ streaming: true });
const streamParsed = streamParser.parse("items.ox");

// Inject streamed blocks into UI tree
streamParser.executeWithStreaming(streamParsed, streamTransaction, {
  onChunk: (blocks) => {
    // Append to UI tree
    contentArea.children.push(...blocks);

    // Optionally trigger UI update
    renderUI(uiResult.tree);
  },

  onComplete: () => {
    console.log(`Loaded ${contentArea.children.length} items`);
  }
});
```

### Streaming OX Template

```ox
// items.ox (streaming mode)
// Each top-level block emitted as ready

<on-data item>
  [Item (
    id: (item.id),
    name: (item.name),
    price: (item.price)
  )]
</on-data>
```

**Note:** In streaming mode, each `<on-data>` block is processed and emitted individually as data arrives.

### Use Cases for Streaming

1. **Large datasets** - Process thousands of items without loading all into memory
2. **Real-time data** - Display items as they arrive from APIs/databases
3. **Progressive rendering** - Show content incrementally for better UX
4. **Server-sent events** - Stream updates from server

---

## Use Cases

### 1. UI Framework Generation

**Input (OX):**

```ox
<set screenWidth = 1920>
<set margin = 20>

[Container (width: (screenWidth), padding: (margin))
  [Header (height: 60)]

  [MainContent (
    y: 60,
    height: ($parent.height - 60 - margin)
  )
    <on-data users>
      <foreach (user in users)>
        [UserCard (
          name: (user.name),
          avatar: (user.avatar)
        )]
      </foreach>
    </on-data>
  ]
]
```

**Output (React):**

```javascript
parser.walk(result.tree, (block, parent) => {
  const props = Object.entries(block.properties)
    .map(([k, v]) => `${k}={${JSON.stringify(v)}}`)
    .join(' ');

  console.log(`<${block.id} ${props}>`);
});

// Generates:
// <Container width={1920} padding={20}>
//   <Header height={60} />
//   <MainContent y={60} height={900}>
//     <UserCard name="Alice" avatar="alice.jpg" />
//     <UserCard name="Bob" avatar="bob.jpg" />
//   </MainContent>
// </Container>
```

### 2. CSS Generation

**Input (OX):**

```ox
<set baseSize = 16>

[Container (
  width: 1200,
  padding: (baseSize * 2)
)
  [Sidebar (
    width: 300,
    background: "#f0f0f0"
  )]

  [Content (
    width: ($parent.width - $Sidebar.width - baseSize * 4),
    marginLeft: (baseSize * 2)
  )]
]
```

**Output (CSS):**

```javascript
parser.walk(result.tree, (block, parent) => {
  console.log(`.${block.id} {`);
  Object.entries(block.properties).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const cssValue = typeof value === 'number' ? `${value}px` : value;
    console.log(`  ${cssKey}: ${cssValue};`);
  });
  console.log(`}`);
});

// Generates:
// .Container {
//   width: 1200px;
//   padding: 32px;
// }
// .Sidebar {
//   width: 300px;
//   background: #f0f0f0;
// }
// .Content {
//   width: 836px;
//   margin-left: 32px;
// }
```

### 3. Configuration Files

**Input (OX):**

```ox
<set environment = "production">

[Database (
  host: "db.example.com",
  port: 5432,
  maxConnections: (environment == "production" ? 100 : 10)
)]

[Cache (
  enabled: (environment == "production"),
  ttl: 3600
)]
```

**Output (JSON):**

```javascript
const config = {};
parser.walk(result.tree, (block, parent) => {
  config[block.id] = block.properties;
});

console.log(JSON.stringify(config, null, 2));

// Generates:
// {
//   "Database": {
//     "host": "db.example.com",
//     "port": 5432,
//     "maxConnections": 100
//   },
//   "Cache": {
//     "enabled": true,
//     "ttl": 3600
//   }
// }
```

### 4. Game Engine Entities

**Input (OX):**

```ox
<set screenWidth = 1920>
<set screenHeight = 1080>

[Player (
  x: (screenWidth / 2),
  y: (screenHeight / 2),
  health: 100,
  speed: 5
)
  [Sprite (src: "player.png", width: 64, height: 64)]

  [Collider (
    width: ($parent.Sprite.width),
    height: ($parent.Sprite.height)
  )]
]

[Enemy (
  x: 100,
  y: 100,
  health: 50,
  damage: (Player.health * 0.1)
)]
```

**Output (Game Engine):**

```javascript
const entities = [];

parser.walk(result.tree, (block, parent) => {
  const entity = {
    type: block.id,
    ...block.properties,
    components: block.children.map(child => ({
      type: child.id,
      ...child.properties
    }))
  };

  entities.push(entity);
});

// Use in game engine:
entities.forEach(entity => {
  gameEngine.createEntity(entity);
});
```

### 5. Database Migrations

**Input (OX):**

```ox
[Table (name: "users")
  [Column (name: "id", type: "integer", primaryKey: true)]
  [Column (name: "email", type: "string", unique: true)]
  [Column (name: "created_at", type: "timestamp")]

  [Index (columns: {"email"})]
]
```

**Output (SQL):**

```javascript
parser.walk(result.tree, (block, parent) => {
  if (block.id === "Table") {
    console.log(`CREATE TABLE ${block.properties.name} (`);

    const columns = block.children.filter(c => c.id === "Column");
    columns.forEach((col, i) => {
      const constraints = [];
      if (col.properties.primaryKey) constraints.push("PRIMARY KEY");
      if (col.properties.unique) constraints.push("UNIQUE");

      const constraintStr = constraints.length ? ` ${constraints.join(' ')}` : '';
      const comma = i < columns.length - 1 ? ',' : '';

      console.log(`  ${col.properties.name} ${col.properties.type}${constraintStr}${comma}`);
    });

    console.log(`);`);
  }
});

// Generates:
// CREATE TABLE users (
//   id integer PRIMARY KEY,
//   email string UNIQUE,
//   created_at timestamp
// );
```

---

## Implementation Roadmap

### Phase 1: Core Parser (Foundation)

**Goal:** Parse OX syntax into AST without templates or expressions.

**Tasks:**

1. **Lexer (Tokenization)**
   - Tokenize: `[`, `]`, `(`, `)`, `{`, `}`, `,`, `:`, identifiers, strings, numbers, booleans
   - Handle comments: `//` and `/* */`
   - Line/column tracking for error reporting

2. **Parser (AST Building)**
   - Parse blocks: `[Identifier]`
   - Parse properties: `(key: value, key2: value2)`
   - Parse arrays: `{value1, value2}`
   - Build initial AST
   - Error on syntax issues (fail fast)

3. **Basic Tree Structure**
   - Block class: `{ id, properties, children, tags, metadata }`
   - Tree representation
   - Utility functions: find, query

4. **Tests**
   - Unit tests for lexer
   - Unit tests for parser
   - Edge cases: nested blocks, empty blocks, complex properties

**Deliverable:** Parser that converts OX syntax to AST (no expressions/templates).

**Estimated Time:** 2-3 weeks

---

### Phase 2: Expression System

**Goal:** Parse and resolve expressions in property values.

**Tasks:**

1. **Expression Parser**
   - Detect expressions: `(expression)`
   - Parse operators: arithmetic, comparison, logical
   - Build expression AST
   - Error on malformed expressions

2. **Block Reference Resolution**
   - Implement `$parent`, `$root`, `$this`, `$BlockId`
   - Two-pass resolution (build tree first, then resolve)
   - Scope lookup algorithm
   - Error on undefined references

3. **Template Variable Resolution**
   - Resolve identifiers without `$` prefix
   - Lookup in transaction variables
   - Error on undefined variables

4. **Expression Evaluation**
   - Evaluate arithmetic: `+`, `-`, `*`, `/`, `%`, `**`
   - Evaluate comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
   - Evaluate logical: `&&`, `||`, `!`
   - Type coercion (string → number, boolean)
   - Function calls (user-supplied)

5. **Tests**
   - Expression parsing
   - Reference resolution
   - Evaluation correctness
   - Error cases

**Deliverable:** Expression system that resolves and evaluates property expressions.

**Estimated Time:** 2-3 weeks

---

### Phase 3: Template System

**Goal:** Implement template preprocessing (variables, conditionals, loops).

**Tasks:**

1. **Template Lexer/Parser**
   - Parse `<set>`, `<if>`, `<foreach>` templates
   - Build template AST
   - Error on malformed templates

2. **Variable System**
   - `<set variableName = value>`
   - Variable scoping (global vs block-scoped)
   - Transaction variables (provided by user)

3. **Conditional Templates**
   - `<if (condition)> ... </if>`
   - `<elseif (condition)>` and `<else>`
   - Evaluate conditions
   - Expand/skip blocks based on condition

4. **Loop Templates**
   - `<foreach (item in collection)>`
   - `<foreach (item, index in collection)>`
   - `range()` function
   - Block duplication for each iteration

5. **Template Expansion**
   - Pre-process templates before expression resolution
   - Build final block tree
   - Remove template markers

6. **Tests**
   - Variable declaration/lookup
   - Conditionals (if/elseif/else)
   - Loops (foreach, range)
   - Nested templates
   - Edge cases

**Deliverable:** Full template system with variables, conditionals, and loops.

**Estimated Time:** 3-4 weeks

---

### Phase 4: Transaction System

**Goal:** Implement transaction API for providing data, functions, configuration.

**Tasks:**

1. **Transaction Class**
   - `createTransaction(options)`
   - Variable management methods
   - Function management methods
   - Data source management methods

2. **Variable Integration**
   - Transaction variables available globally in OX
   - Override detection/warning
   - Variable scoping with transaction

3. **Function Integration**
   - User-supplied functions callable in expressions
   - Function registration
   - Error on undefined function calls

4. **Configuration**
   - Timeout settings
   - Error handling options
   - Strict mode

5. **Tests**
   - Transaction creation
   - Variable/function management
   - Configuration options
   - Integration with parser

**Deliverable:** Transaction system for user configuration.

**Estimated Time:** 2 weeks

---

### Phase 5: Data Sources and Async

**Goal:** Implement `<on-data>` and async data source handling.

**Tasks:**

1. **`<on-data>` Template**
   - Parse `<on-data name>` syntax
   - Parse `<on-error>` blocks
   - Build data source dependency graph

2. **Data Source Execution**
   - Call user-provided async functions
   - Handle wrapper pattern (setup with transaction)
   - Timeout handling
   - Error capture per data source

3. **Template Expansion with Data**
   - Expand `<on-data>` blocks with fetched data
   - Expand `<on-error>` blocks on failure
   - Inject `$error` variable in error blocks

4. **Async Execution Flow**
   - `executeWithTransaction()` async method
   - Parallel data source fetching
   - Sequential (nested) data source fetching

5. **Tests**
   - Data source registration
   - Fetch success/failure
   - Error handling
   - Nested data sources
   - Parallel fetching

**Deliverable:** Full async data source system with `<on-data>`.

**Estimated Time:** 3 weeks

---

### Phase 6: Error Handling

**Goal:** Robust error detection, reporting, and recovery.

**Tasks:**

1. **Parse Error Handling**
   - Fail fast on syntax errors
   - Line/column tracking
   - Detailed error messages
   - Error object structure

2. **Preprocessing Error Collection**
   - Collect all errors during preprocessing
   - Continue on error (skip errored blocks)
   - Error categories (undefined, type, circular, etc.)

3. **Error Recovery**
   - Partial tree generation
   - Skip errored blocks
   - Mark error locations

4. **Warning System**
   - Variable override warnings
   - Unused variable warnings
   - Warning object structure

5. **Error Reporting**
   - Pretty-print errors
   - Context lines
   - Suggestions (did you mean...?)

6. **Tests**
   - All error types
   - Error recovery
   - Warning generation
   - Error message quality

**Deliverable:** Comprehensive error handling system.

**Estimated Time:** 2 weeks

---

### Phase 7: Multi-File Support

**Goal:** Import system for splitting OX across multiple files.

**Tasks:**

1. **Import Syntax**
   - Parse `<import>` directives
   - File path resolution
   - Directory imports

2. **Import Resolution**
   - Load and parse imported files
   - Merge imported variables/blocks
   - Circular import detection

3. **Scoping**
   - File-scoped imports
   - No transitive imports
   - Variable/block availability

4. **API**
   - `parse()` with import resolution
   - `getImports()` for dependency graph
   - `resolveImports()` helper

5. **Tests**
   - Single file imports
   - Directory imports
   - Circular import detection
   - Scoping correctness

**Deliverable:** Multi-file import system.

**Estimated Time:** 2 weeks

---

### Phase 8: Streaming Support

**Goal:** Separate streaming parser for large/progressive data.

**Tasks:**

1. **Streaming Parser Mode**
   - `createParser({ streaming: true })`
   - Chunk-based emission
   - Observable interface for data sources

2. **Streaming Execution**
   - `executeWithStreaming()` method
   - `onChunk`, `onComplete`, `onError` callbacks
   - Progressive block processing

3. **Programmatic Merging**
   - Inject streamed blocks into existing trees
   - Utilities for finding injection points

4. **Tests**
   - Streaming data sources
   - Chunk emission
   - Merging with static trees
   - Error handling in streams

**Deliverable:** Streaming parser for progressive data loading.

**Estimated Time:** 2-3 weeks

---

### Phase 9: Tree Walking and Utilities

**Goal:** Utilities for interpreting and manipulating parsed trees.

**Tasks:**

1. **Walk Function**
   - Depth-first traversal
   - Callback with block, parent, context
   - Level and index tracking

2. **Reverse Walk**
   - Upward traversal from context
   - Stop at specified level/index

3. **Query Functions**
   - Find by ID
   - Query by predicate
   - CSS-like selectors (future)

4. **Tree Manipulation**
   - Add/remove blocks
   - Modify properties
   - Re-evaluation (rerun)

5. **Tests**
   - Walk correctness
   - Reverse walk
   - Query functions
   - Tree modification

**Deliverable:** Tree walking and manipulation utilities.

**Estimated Time:** 1-2 weeks

---

### Phase 10: Tag System

**Goal:** Complete tag system with definitions, instances, composition, and modules.

**Tasks:**

1. **Tag Definition API**
   - `defineTag(name, definition)`
   - Block output handlers
   - `canReuse`, `canOutput`, `acceptChildren` modifiers
   - Module properties (external data injection)
   - `exposeAs` metadata for code generation
   - Tag descriptors with arguments

2. **Tag Parsing**
   - Parse `@tagName` syntax (definition)
   - Parse `#tagName` syntax (instance)
   - Parse `@tagName(argument)` and `#tagName(argument)`
   - Support multiple `#` tags on single block (composition)
   - Detect and error on mixed `@` and `#` usage
   - Attach tags to blocks with metadata

3. **Tag Registry**
   - Store tag definitions with `canReuse: true`
   - Pattern matching by name and argument
   - Validate no duplicate definitions
   - Exclude definitions with `canOutput: false` from tree

4. **Tag Instance Processing**
   - Pattern match `#tag(Name)` to `@tag(Name)` definition
   - Property merging (instance overrides definition)
   - Copy definition's children to instance
   - Error if instance has children (when `acceptChildren: false`)
   - Validate definition properties are literals (no expressions)

5. **Tag Composition**
   - Detect multiple `#` tags on single block
   - Generate child blocks (one per tag, in order)
   - Auto-generate child IDs: `{parentId}_{tagName}`
   - Error if composition block has properties or children
   - Recursive expansion until no tags remain

6. **Module System**
   - Call module functions during preprocessing
   - Inject returned values as block properties
   - Error if OX code tries to override module property
   - Support any return type (primitives, arrays, objects)

7. **Tests**
   - Tag definition with all modifiers
   - Tag parsing (`@` and `#` syntax)
   - Pattern matching and property merging
   - Tag composition expansion
   - Module property injection
   - Error cases (mixed `@`/`#`, override module property, etc.)
   - Handler invocation
   - Multiple tags per block

**Deliverable:** Full tag system with definitions, instances, composition, and modules.

**Estimated Time:** 3-4 weeks

---

### Phase 11: Macro System

**Goal:** Implement macro hooks for user-controlled preprocessing and meta-programming.

**Tasks:**

1. **Pre-Parse Hook (`onParse`)**
   - Call `oxparser.init.onParse()` before preprocessing
   - Provide access to full parsed tree (templates/expressions intact)
   - Implement `oxparser.finish()` for early termination
   - Expose `oxparser.tree` for walking
   - Allow code generation use cases

2. **Macro Walk Hook (`onWalk`)**
   - Call `oxparser.macros.onWalk(block, parent)` during preprocessing
   - Hook invoked after block properties evaluated, before children
   - Pass evaluated block and parent to callback
   - Integrate with template expansion phase

3. **Cursor Control API**
   - Implement `oxparser.macros.nextBlock()` (peek without advancing)
   - Implement `oxparser.macros.invokeWalk(block, parent)` (evaluate and advance)
   - Implement `oxparser.macros.back()` (rewind cursor)
   - Track cursor state during preprocessing
   - Prevent infinite loops (cycle detection)

4. **Property Evaluation Control**
   - Evaluate block properties before calling onWalk
   - Leave children properties unevaluated until invokeWalk
   - Allow user to modify properties in onWalk
   - Auto-evaluate remaining children after onWalk returns
   - Ensure modifications persist to final tree

5. **Error Handling**
   - Implement `oxparser.macros.throwError(message)` for user validation
   - Stop preprocessing on macro error
   - Include location information in error messages
   - Distinguish macro errors from preprocessing errors

6. **Auto-Processing Behavior**
   - Implement default depth-first traversal
   - Auto-evaluate unwalked children after onWalk
   - Mark blocks as "semi-final" (evaluated) vs "final" (committed)
   - Ensure all blocks get processed (manual or automatic)

7. **Integration with Existing Phases**
   - Integrate onParse with Phase 6
   - Integrate onWalk with Phase 9 (template expansion)
   - Ensure module properties available before onWalk
   - Coordinate with expression resolution

8. **Tests**
   - onParse callback execution
   - Early termination with finish()
   - onWalk invocation for each block
   - Manual child evaluation with invokeWalk
   - Cursor management (nextBlock, back)
   - Property modification persistence
   - Auto-processing of unwalked children
   - Error handling with throwError
   - Integration with templates and expressions
   - Use case scenarios (auto-sizing, validation, etc.)

**Deliverable:** Complete macro system enabling user-controlled preprocessing and meta-programming.

**Estimated Time:** 3-4 weeks

---

### Phase 12: Serialization and Caching

**Goal:** Serialize parsed/preprocessed trees for caching.

**Tasks:**

1. **Parsed Object Serialization**
   - Serialize before preprocessing
   - Include all cached data (expressions, templates)
   - Deserialize for re-execution

2. **Tree Serialization**
   - Serialize pure data tree (after preprocessing)
   - JSON format
   - Deserialize for direct use

3. **Caching Strategy**
   - Parse cache (skip parsing if unchanged)
   - Data source cache (reuse results)
   - Cache invalidation

4. **Tests**
   - Serialize/deserialize correctness
   - Cache hit/miss
   - Cache invalidation

**Deliverable:** Serialization and caching for performance.

**Estimated Time:** 1-2 weeks

---

### Phase 13: Documentation and Examples

**Goal:** Comprehensive documentation and example use cases.

**Tasks:**

1. **API Documentation**
   - Parser API
   - Transaction API
   - Walking API
   - Tag API
   - Macro API (onParse, onWalk, cursor control)

2. **Language Reference**
   - Syntax specification
   - Template reference
   - Expression reference
   - Macro system guide
   - Best practices

3. **Examples**
   - React component generation
   - CSS generation
   - Configuration files
   - Game engine entities
   - Database migrations
   - Auto-sizing layouts with macros
   - Property validation with macros

4. **Tutorials**
   - Getting started guide
   - Building a simple interpreter
   - Working with data sources
   - Multi-file projects
   - Using macros for meta-programming

**Deliverable:** Full documentation suite.

**Estimated Time:** 2-3 weeks

---

### Phase 14: Testing and Polish

**Goal:** Comprehensive test suite and production readiness.

**Tasks:**

1. **Unit Tests**
   - All core components
   - Edge cases
   - Error cases

2. **Integration Tests**
   - End-to-end parsing
   - Real-world use cases
   - Performance benchmarks

3. **Performance Optimization**
   - Parsing performance
   - Memory usage
   - Caching effectiveness

4. **Error Message Quality**
   - Clear, actionable messages
   - Suggestions for common mistakes
   - Context in error output

5. **Code Quality**
   - Code review
   - Refactoring
   - Documentation cleanup

**Deliverable:** Production-ready parser with comprehensive tests.

**Estimated Time:** 2-3 weeks

---

## Total Estimated Timeline

**Core Development:** 30-38 weeks (7-9 months)

**By Phase:**
- Phase 1 (Core Parser): 2-3 weeks
- Phase 2 (Expressions): 2-3 weeks
- Phase 3 (Templates): 3-4 weeks
- Phase 4 (Transactions): 2 weeks
- Phase 5 (Data Sources): 3 weeks
- Phase 6 (Error Handling): 2 weeks
- Phase 7 (Multi-File): 2 weeks
- Phase 8 (Streaming): 2-3 weeks
- Phase 9 (Walking): 1-2 weeks
- Phase 10 (Tags): 3-4 weeks
- Phase 11 (Macros): 3-4 weeks
- Phase 12 (Serialization): 1-2 weeks
- Phase 13 (Documentation): 2-3 weeks
- Phase 14 (Testing/Polish): 2-3 weeks

---

## Technology Recommendations

### Implementation Language

**JavaScript/TypeScript (recommended)**
- Excellent parsing libraries (PEG.js, nearley, chevrotain)
- Easy to distribute (npm)
- Good for both Node.js and browser
- TypeScript provides type safety

**Alternative: Rust**
- Excellent performance
- Memory safety
- Can compile to WASM for browser
- Steeper learning curve

### Parser Generator

**PEG.js or nearley**
- Declarative grammar definition
- Good error reporting
- Easy to extend
- Well-documented

**Or hand-written recursive descent**
- Full control
- Better error messages
- More work upfront

### Testing Framework

**Jest (JavaScript)**
- Comprehensive
- Good DX
- Snapshot testing

### Documentation

**JSDoc + TypeDoc** for API docs
**Markdown** for guides
**GitHub Pages** for hosting

---

## Success Metrics

1. **Parsing Performance**: Parse 10,000 lines in < 100ms
2. **Preprocessing Performance**: Preprocess 1,000 blocks in < 50ms
3. **Memory Usage**: < 10MB for typical projects
4. **Error Quality**: Clear, actionable error messages
5. **Test Coverage**: > 90% code coverage
6. **Documentation**: Complete API and language reference
7. **Examples**: 5+ real-world use cases

---

## Future Enhancements (Post-MVP)

1. **LSP (Language Server Protocol)**
   - Syntax highlighting
   - Auto-completion
   - Error checking in editor
   - Go-to-definition

2. **Watch Mode**
   - File watching
   - Incremental parsing
   - Hot reload

3. **Plugins**
   - User-defined preprocessors
   - Custom syntax extensions
   - Hook system

4. **CLI Tool** (as mentioned, will be discussed separately)
   - File compilation
   - Project scaffolding
   - Build system integration

5. **Web Playground**
   - Browser-based editor
   - Live preview
   - Share snippets

6. **Type System (optional)**
   - Schema validation
   - Type checking for properties
   - IDE integration

---

## Conclusion

OX represents a new approach to data structure definition that combines:
- **Authoring convenience** through templates and expressions
- **Runtime performance** through pre-processing
- **Flexibility** through user-controlled interpretation
- **Language agnosticism** through clean separation of concerns

The implementation roadmap provides a clear path from basic parsing to a full-featured system that can target any language or runtime.

The key innovation is the **three-phase architecture**:
1. Author with expressions and templates
2. Pre-process to pure data
3. Interpret however needed

This gives the best of both worlds: ease of authoring and zero runtime overhead.

---

## Appendix: Complete API Reference

### Parser API

```javascript
// Create parser
const parser = oxparser.createParser(options);

// Parsing
parser.parse(filename, options);
parser.parseString(code, options);

// Execution
parser.executeWithTransaction(parsed, transaction);
parser.executeWithStreaming(parsed, transaction, handlers);

// Tree access
parser.find(tree, id);
parser.query(tree, predicate);

// Walking
parser.walk(tree, callback);
parser.reverseWalk(context, callback);

// Tags
parser.defineTag(name, definition);

// Serialization
parser.serializeParsed(parsed);
parser.deserializeParsed(serialized);
parser.serializeTree(tree);
parser.deserializeTree(serialized);

// Imports
parser.getImports(parsed);
parser.resolveImports(parsed);

// Utilities
parser.blockOptions.properties = {...};
```

### Transaction API

```javascript
// Create transaction
const tx = parser.createTransaction(options);

// Variables
tx.setVariable(name, value);
tx.getVariable(name);
tx.hasVariable(name);
tx.deleteVariable(name);
tx.getAllVariables();

// Functions
tx.addFunction(name, func);
tx.removeFunction(name);
tx.hasFunction(name);

// Data sources
tx.addDataSource(name, funcOrWrapper);
tx.setDataSource(name, funcOrWrapper);
tx.removeDataSource(name);
tx.hasDataSource(name);

// Data source execution
tx.fetchDataSources(names);
tx.getDataSourceResult(name);
tx.getDataSourceError(name);
tx.clearDataSourceCache();

// State
tx.reset();
tx.clone();
```

### Macro API

```javascript
// Pre-parse hook (called once before preprocessing)
oxparser.init.onParse = function() {
  // Full parsed tree available
  // Templates and expressions not yet evaluated
  // Can walk tree: oxparser.walk(oxparser.tree, callback)
  // Can terminate early: oxparser.finish()
};

// Macro walk hook (called for each block during preprocessing)
oxparser.macros.onWalk = function(block, parent) {
  // block: current block (properties evaluated)
  // parent: parent block or null

  // User can:
  // - Read block.properties (literals)
  // - Peek at children (nextBlock)
  // - Manually evaluate children (invokeWalk)
  // - Modify properties
  // - Validate and throw errors
};

// Cursor control
const next = oxparser.macros.nextBlock();
// Returns next block or null (peek, doesn't advance)

oxparser.macros.invokeWalk(block, parent);
// Evaluate block properties, call onWalk recursively, advance cursor

oxparser.macros.back();
// Move cursor backward one position (use with caution)

oxparser.macros.throwError(message);
// Stop preprocessing with user-defined error

// Early termination
oxparser.finish();
// Stop preprocessing immediately, return current tree state
```

### Block Structure

```javascript
{
  id: "BlockIdentifier",
  properties: {
    key: "value",
    number: 42,
    boolean: true,
    array: [1, 2, 3]
  },
  children: [
    { id: "Child1", properties: {}, children: [] },
    { id: "Child2", properties: {}, children: [] }
  ],
  tags: ["component", "interactive"],
  metadata: {
    line: 10,
    column: 5,
    file: "layout.ox"
  }
}
```

### Tag Definition API

```javascript
parser.defineTag(name, {
  // Block-level configuration
  block: {
    output: function(block) {
      // Custom processing (called even if canOutput: false)
      // block: The block object with this tag
      customRegistry.push(block);
    },

    canReuse: true,        // Enable pattern matching (#tag syntax)
    canOutput: false,      // Exclude @tag definitions from final tree
    acceptChildren: false  // When false, #tag instances cannot have children
                           // (definitions can always have children)
  },

  // Module properties (external data injection)
  module: {
    propertyName: () => externalValue,
    health: () => player.health,
    position: () => gameState.getPosition()
    // Simple value getters, no parameters
    // Called during preprocessing
    // Cannot be overridden in OX
  },

  // Descriptor configuration
  descriptor: {
    attributes: [
      {
        type: "identifier",  // Expected argument type
        required: true       // Whether argument is required
      }
    ],
    exposeAs: ["metadata", "for", "users"]  // User metadata for code generation
  }
});
```

### Tag Usage Patterns

```ox
// Definition (with canReuse: true)
@component(Button)
[Button (width: 100, height: 50)]

// Single instance
#component(Button) [myButton (text: "Click")]

// Composition (multiple tags)
#component(Button) #component(Icon) [ButtonWithIcon]

// With module properties
#entity(Player) [Player (x: 50, y: 50)]
// Module injects: health, mana, position, etc.
```

---

**End of Implementation Roadmap**
