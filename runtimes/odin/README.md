# OX Runtime for Odin

A complete OX parser and type mapping library for the Odin programming language.

## Features

- **Complete OX Parser**: Tokenizer and parser supporting all OX syntax including:
  - Named and anonymous blocks
  - Properties (strings, numbers, booleans, null, arrays)
  - Tags (declaration `@tag` and instance `#tag`)
  - Free text blocks (triple backtick syntax)
  - Comments (line and block)

- **Type Mapping System**: Automatically map OX documents to typed Odin structs using reflection
  - Block IDs map to struct fields with snake_case transformation
  - Properties map to primitive fields
  - Child blocks map to nested structs
  - Anonymous blocks map to `children: [dynamic]T` fields
  - Free text maps to `free_text: string` fields

- **Tag Registry**: Event-driven system for processing tag instances with custom handlers

- **Tree Walking**: Visitor pattern for traversing OX document trees

## Directory Structure

```
runtimes/odin/
├── ox.odin           # OX parser library (package ox)
├── README.md         # This file
└── examples/
    └── basic.odin    # Example usage (package main)
```

## Installation

Copy the `ox.odin` file to your Odin project and import it:

```odin
import ox "path/to/ox"
```

Or reference it directly from the runtimes directory:

```odin
import ox "runtimes/odin"
```

## Building

The library itself (`ox.odin`) uses `package ox` and cannot be built directly as an executable.

To build and run the examples:

```bash
cd runtimes/odin/examples
odin run basic.odin -file
```

Or build as a collection:

```bash
cd runtimes/odin
odin build examples -out:examples/ox_example
```

## Quick Start

### Parsing OX Files

```odin
import ox "."

// Parse from file
doc, ok := ox.parse_file("config.ox")
if !ok {
    // Handle error
}

// Parse from string
doc, ok := ox.parse_string(`
[Player (name: "Hero", health: 100)]
`)
```

### Type Mapping

Define structs that match your OX structure:

```odin
GameConfig :: struct {
    player: Player,
    world: World,
}

Player :: struct {
    name: string,
    health: f64,
}

World :: struct {
    name: string,
    seed: f64,
}
```

Parse and map OX to structs:

```odin
ox_source := `
[Player (name: "Hero", health: 100)]
[World (name: "Overworld", seed: 12345)]
`

doc, _ := ox.parse_string(ox_source)
config, ok := ox.parse_map(doc, GameConfig)

fmt.printf("Player: %s (HP: %.0f)\n", config.player.name, config.player.health)
// Output: Player: Hero (HP: 100)
```

### Naming Convention

Block IDs are automatically converted to snake_case for field matching:

| Block ID | Struct Field |
|----------|--------------|
| `Player` | `player` |
| `PlayerHealth` | `player_health` |
| `max-health` | `max_health` |

### Anonymous Blocks

Anonymous blocks (blocks without IDs) map to a `children` field:

```odin
Container :: struct {
    name: string,
    children: [dynamic]Item,
}

Item :: struct {
    value: f64,
    label: string,
}
```

```odin
ox_source := `
[Container (name: "Items")
    [ (value: 100, label: "Gold")]
    [ (value: 50, label: "Silver")]
]
`

doc, _ := ox.parse_string(ox_source)
container, _ := ox.parse_map(doc, Container)

// Access anonymous blocks via children array
for item in container.children {
    fmt.printf("%s: %.0f\n", item.label, item.value)
}
```

### Free Text Blocks

Free text content maps to a `free_text` field:

```odin
Documentation :: struct {
    title: string,
    free_text: string,
}
```

```odin
ox_source := `
[Documentation (title: "User Guide")
` + "```" + `
This is the documentation content.
It can span multiple lines.
` + "```" + `
]
`

doc, _ := ox.parse_string(ox_source)
docs, _ := ox.parse_map(doc, Documentation)

fmt.printf("Title: %s\n", docs.title)
fmt.printf("Content:\n%s\n", docs.free_text)
```

### Tree Walking

Walk through the OX document tree with a visitor function:

```odin
walk_visitor :: proc(node: ^ox.OXNode, parent: ^ox.OXNode, user_data: rawptr) {
    switch v in node.variant {
    case ox.OXBlock:
        if id, has_id := v.id.?; has_id {
            fmt.printf("Block: %s\n", id)
        }
    case ox.OXFreeText:
        fmt.printf("Free text: %s\n", v.content)
    case:
        // Handle other node types
    }
}

ox.parse_walk(doc, walk_visitor)
```

### Tag Handlers

Register custom handlers for tag instances:

```odin
// Create interpreter
interp := ox.interp_init()
defer ox.interp_destroy(&interp)

// Register tag handler
uppercase_handler :: proc(node: ^ox.OXNode, tag: ox.OXTag, user_data: rawptr) -> ox.TagResult {
    if block, is_block := node.variant.(ox.OXBlock); is_block {
        // Process the tag
        // Return result or error
        return true
    }
    return ox.TagError{message = "Invalid node type"}
}

ox.interp_register_tag(&interp, "uppercase", uppercase_handler)

// Parse and process tags
config, ok := ox.parse_map_with_interp(doc, GameConfig, &interp)
```

## API Reference

### Core Types

#### `OXNode`
Represents any node in the OX document tree.

```odin
OXNode :: struct {
    type: OXNodeType,
    variant: OXNodeVariant,
    location: OXLocation,
}

OXNodeType :: enum {
    Document,
    Block,
    FreeText,
    Tag,
}
```

#### `OXBlock`
Represents a block with optional ID, properties, children, and tags.

```odin
OXBlock :: struct {
    id: Maybe(string),
    properties: map[string]OXProperty,
    children: [dynamic]^OXNode,
    tags: [dynamic]OXTag,
}
```

#### `OXProperty`
Polymorphic union for property values.

```odin
OXProperty :: union {
    string,
    f64,
    bool,
    OXNull,
    OXArray,
}
```

### Parsing Functions

#### `parse_file`
```odin
parse_file :: proc(path: string, allocator := context.allocator) -> (doc: ^OXNode, ok: bool)
```
Parse an OX file from disk.

#### `parse_string`
```odin
parse_string :: proc(source: string, filename := "<input>", allocator := context.allocator) -> (doc: ^OXNode, ok: bool)
```
Parse OX content from a string.

### Type Mapping Functions

#### `parse_map`
```odin
parse_map :: proc(doc: ^OXNode, $T: typeid, allocator := context.allocator) -> (result: T, ok: bool)
```
Map an OX document to a typed struct using reflection.

**Requirements:**
- `T` must be a struct type
- Field names must match block IDs (converted to snake_case)
- Special fields:
  - `children: [dynamic]T` - maps anonymous child blocks
  - `free_text: string` - maps free text content

#### `block_id_to_field_name`
```odin
block_id_to_field_name :: proc(id: string, allocator := context.allocator) -> string
```
Convert block ID to snake_case field name.

### Tree Walking

#### `parse_walk`
```odin
parse_walk :: proc(node: ^OXNode, walk_func: WalkFunc, user_data: rawptr = nil, parent: ^OXNode = nil)
```
Recursively walk the OX tree, calling `walk_func` for each node.

```odin
WalkFunc :: #type proc(node: ^OXNode, parent: ^OXNode, user_data: rawptr)
```

### Tag Registry

#### `TagRegistry`
```odin
TagRegistry :: struct {
    handlers: map[string]TagHandler,
    user_data: rawptr,
}

TagHandler :: #type proc(node: ^OXNode, tag: OXTag, user_data: rawptr) -> TagResult

TagResult :: union {
    string,
    ^OXNode,
    bool,
    f64,
    TagError,
}
```

#### `tag_registry_init`
```odin
tag_registry_init :: proc(allocator := context.allocator) -> TagRegistry
```
Create a new tag registry.

#### `tag_registry_register`
```odin
tag_registry_register :: proc(registry: ^TagRegistry, tag_name: string, handler: TagHandler)
```
Register a handler for a tag name.

#### `tag_registry_handle`
```odin
tag_registry_handle :: proc(registry: ^TagRegistry, node: ^OXNode, tag: OXTag) -> (result: TagResult, ok: bool)
```
Execute the registered handler for a tag.

### Interpreter

#### `Interpreter`
```odin
Interpreter :: struct {
    tag_registry: TagRegistry,
}
```

#### `interp_init`
```odin
interp_init :: proc(allocator := context.allocator) -> Interpreter
```
Create a new interpreter with tag registry.

#### `interp_register_tag`
```odin
interp_register_tag :: proc(interp: ^Interpreter, tag_name: string, handler: TagHandler)
```
Register a tag handler with the interpreter.

#### `parse_map_with_interp`
```odin
parse_map_with_interp :: proc(
    doc: ^OXNode, 
    $T: typeid, 
    interp: ^Interpreter,
    allocator := context.allocator,
) -> (result: T, ok: bool)
```
Parse, process tags, and map to typed struct in one step.

### Utility Functions

#### `print_tree`
```odin
print_tree :: proc(node: ^OXNode, indent := 0)
```
Debug print an OX tree structure.

## Examples

See `examples/basic.odin` for complete working examples demonstrating:
- Type mapping
- Tree walking
- Tag handlers
- Free text blocks
- Anonymous blocks

## Type Mapping Rules

### Block to Struct Mapping

1. **Block ID → Field Name**: Block IDs are converted to snake_case to match struct field names
   ```odin
   [Player ...] → player: Player
   [MaxHealth ...] → max_health: MaxHealth
   ```

2. **Properties → Primitive Fields**: Properties map directly to struct fields
   ```odin
   (name: "Hero", health: 100) → name: string, health: f64
   ```

3. **Child Blocks → Nested Structs**: Named child blocks map to nested struct fields
   ```odin
   [Player
       [Position (x: 10)]
   ]
   → player: Player { position: Position { x: 10 } }
   ```

4. **Anonymous Blocks → Children Array**: Anonymous child blocks map to `children` field
   ```odin
   [Container
       [ (value: 1)]
       [ (value: 2)]
   ]
   → container: Container { children: [dynamic]Item }
   ```

5. **Free Text → String Field**: Free text content maps to `free_text` field
   ```odin
   [Doc
       ```
       Content here
       ```
   ]
   → doc: Doc { free_text: "Content here" }
   ```

### Property Type Mapping

| OX Type | Odin Type |
|---------|-----------|
| String | `string` |
| Number | `f64` |
| Boolean | `bool` |
| Null | `OXNull` |
| Array | `[dynamic]T` |

## Memory Management

All allocations use the provided allocator (defaults to `context.allocator`). Remember to clean up:

```odin
// Strings are cloned during mapping
config, ok := ox.parse_map(doc, GameConfig)

// Clean up the config when done
// (Free strings, dynamic arrays, etc.)
```

## Limitations

- Template expansion (`<set>`, `<while>`, etc.) is not supported in the Odin runtime - use the JavaScript preprocessor for that
- Expression evaluation (`$parent.children[0].value`) is not performed - this is intentional for runtime simplicity
- Reference resolution (`$BlockId`, `$this`, `$parent`) is not performed - handled in JavaScript preprocessing phase

The Odin runtime focuses on parsing and type mapping for already-preprocessed OX files.

## License

Same as the main OX project.
