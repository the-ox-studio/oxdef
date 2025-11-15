# OX Runtime for Haxe

A lightweight, Dynamic-based OX parser and mapper for Haxe with cross-platform support.

## Features

- **Complete OX Parser**: Full support for all OX syntax including blocks, properties, tags, free text, and comments
- **Dynamic Mapping**: Uses Haxe's `Dynamic` type for flexible object mapping
- **Cross-Platform**: Works on all Haxe targets (JS, C++, HashLink, JVM, C#, Python, etc.)
- **Convention Over Configuration**: Auto-mapping by property name without annotations
- **Type-Safe Where Possible**: Leverages Haxe's typedef system for structure
- **Lightweight**: No external dependencies

## Quick Start

### Installation

Add the OX runtime to your Haxe project by including the source files or adding to your classpath:

```bash
-cp path/to/oxdef/runtimes/haxe
```

### Basic Usage

```haxe
import ox.*;

var oxSource = '
[Player (name: "Hero", health: 100)]
';

var mapper = new OXMapper();
var config:GameConfig = mapper.parse(oxSource);

trace('Player: ${config.player.name}');
```

### Define Your Models

```haxe
typedef GameConfig = {
    var player:Player;
}

typedef Player = {
    var name:String;
    var health:Int;
}
```

## Design Philosophy: Dynamic vs Generics

Unlike the C# runtime which uses generics with `where T : class, new()` constraints, the Haxe runtime uses **`Dynamic`** for property mapping. This is because:

1. **Haxe's type system** doesn't support the same generic constraints as C#
2. **Reflection limitations** - Haxe's compile-time and runtime reflection differ across targets
3. **Cross-platform compatibility** - Dynamic works consistently across all Haxe targets
4. **Simplicity** - Typedef structures + Dynamic mapping is more idiomatic in Haxe

However, we still get **type safety** through:
- **Typedef structures** for your domain models
- **Compile-time checking** when accessing fields
- **Type inference** when calling `parse<T>()`

## Mapping Approach

The Haxe runtime uses a **simplified, convention-based approach**:

### 1. Auto-Mapping by Name (Recommended)

Properties and child blocks are automatically mapped by matching names (case-insensitive):

```haxe
typedef Player = {
    var name:String;      // Auto-maps to property "name"
    var health:Int;       // Auto-maps to property "health"
    var position:Position; // Auto-maps to child block [Position]
}

// OX:
// [Player (name: "Hero", health: 100)
//     [Position (x: 10, y: 20)]
// ]
```

### 2. Typedef Structures

Use typedefs to define your object structures:

```haxe
typedef GameConfig = {
    var player:Player;
    var settings:Settings;
}
```

### 3. Dynamic for Flexibility

When you need complete flexibility, use `Dynamic`:

```haxe
var config:Dynamic = mapper.parse(oxSource);
trace(config.player.name); // Access any field
```

## Examples

### Example 1: Nested Objects

```haxe
var oxSource = '
[Player (name: "Hero", health: 100)
    [Position (x: 10.5, y: 20.3, z: 0)]
]
';

typedef GameConfig = {
    var player:Player;
}

typedef Player = {
    var name:String;
    var health:Int;
    var position:Position;
}

typedef Position = {
    var x:Float;
    var y:Float;
    var z:Float;
}

var mapper = new OXMapper();
var config:GameConfig = mapper.parse(oxSource);
```

### Example 2: Collections and Anonymous Blocks

```haxe
var oxSource = '
[Container (name: "Items")
    [ (value: 100, label: "Gold")]
    [ (value: 50, label: "Silver")]
]
';

typedef Container = {
    var name:String;
    var items:Array<Item>;
}

typedef Item = {
    var value:Int;
    var label:String;
}
```

### Example 3: Free Text Blocks

```haxe
var oxSource = '
[Documentation (title: "User Guide")
```
This is the documentation content.
It can span multiple lines.
```
]
';

typedef Documentation = {
    var title:String;
    var content:String;
}
```

### Example 4: Multiple Blocks

```haxe
var oxSource = '
[Player (name: "Hero")]
[Settings (volume: 0.8)]
';

typedef GameConfig = {
    var player:Player;
    var settings:Settings;
}
```

## Type Conversions

The mapper automatically handles:

- **Numbers**: Converts to `Int` or `Float` based on presence of decimal point
- **Booleans**: `true`, `false`
- **Strings**: With escape sequence support (`\n`, `\t`, `\"`, etc.)
- **Null**: Properly handles null values
- **Arrays**: OX arrays `[1, 2, 3]` → `Array<Dynamic>`
- **Collections**: Anonymous child blocks → `Array<T>`

## API Reference

### `OXMapper`

```haxe
// Create mapper
var mapper = new OXMapper();

// Register a tagged type (optional, for polymorphism)
mapper.registerTag(ButtonClass);

// Parse OX source
var result:T = mapper.parse(source, filename);

// Parse OX file (sys targets only)
var result:T = mapper.parseFile(path);

// Map existing document
var result:T = mapper.mapDocument(document);

// Map existing block
var result:T = mapper.mapTree(block);
```

### `OXParser`

```haxe
var parser = new OXParser(source, filename);
var document:OXDocument = parser.parse();
```

## Building and Running

### Compile and Run Example

```bash
# JavaScript target
cd runtimes/haxe
haxe -cp . -main example.Example -js example.js
node example.js

# C++ target
haxe -cp . -main example.Example -cpp bin
./bin/Example

# HashLink target
haxe -cp . -main example.Example -hl example.hl
hl example.hl

# Neko target
haxe -cp . -main example.Example -neko example.n
neko example.n
```

### Build Configuration (build.hxml)

```hxml
-cp .
-main example.Example
-js example.js
```

Then run:
```bash
haxe build.hxml
```

## What's NOT Implemented (By Design)

Like other runtimes, these features are left to the JavaScript preprocessor:

- ❌ Template expansion (`<set>`, `<while>`, `<if>`)
- ❌ Expression evaluation
- ❌ Reference resolution (`$parent`, `$this`)
- ❌ Inject directives

The Haxe runtime focuses on **parsing and mapping** preprocessed OX files.

## Comparison with Other Runtimes

| Feature | JavaScript | Odin | C# | Haxe |
|---------|-----------|------|-----|------|
| Parsing | ✅ | ✅ | ✅ | ✅ |
| Type Mapping | Manual | Reflection | Attributes + Reflection | Dynamic + Typedef |
| Templates | ✅ | ❌ | ❌ | ❌ |
| Type Safety | ❌ | ✅✅ | ✅✅ | ✅ |
| Cross-Platform | Browser/Node | Native | .NET | All Targets |
| Mapping Style | Manual | Struct Tags | Attributes | Convention |

## Cross-Platform Support

The Haxe runtime works on all major Haxe targets:

- ✅ **JavaScript** (Browser & Node.js)
- ✅ **C++** (Native, high performance)
- ✅ **HashLink** (Fast VM)
- ✅ **JVM** (Java Virtual Machine)
- ✅ **C#** (.NET)
- ✅ **Python**
- ✅ **Neko** (Haxe VM)
- ✅ **PHP**
- ✅ **Lua**

Note: File I/O (`parseFile`) requires `sys` targets (C++, HashLink, Neko, JVM, C#, Python, PHP).

## Naming Conventions

The mapper automatically handles:
- `PascalCase` ↔ `camelCase`
- `kebab-case` ↔ `PascalCase`
- `snake_case` ↔ `PascalCase`
- Case-insensitive matching

## Advanced: Using Dynamic Fully

For maximum flexibility, you can skip typedefs entirely:

```haxe
var config:Dynamic = mapper.parse(oxSource);

// Access any field dynamically
trace(config.player.name);
trace(config.player.position.x);

// Iterate over arrays
for (item in cast(config.container.items, Array<Dynamic>)) {
    trace(item.label);
}
```

This is useful for:
- Prototyping
- Unknown schemas
- Dynamic configuration
- Generic tools

## Why Haxe?

Haxe is perfect for OX runtime because:

1. **Cross-Platform**: Write once, run everywhere
2. **Type Safety**: Optional typing with typedef
3. **Performance**: Compiles to efficient native code
4. **Modern**: Supports lambdas, pattern matching, macros
5. **Ecosystem**: Rich standard library and packages

## Contributing

The Haxe runtime follows the same patterns as the C# runtime but adapted for Haxe's type system and idioms.

## License

Same as the main OX project.
