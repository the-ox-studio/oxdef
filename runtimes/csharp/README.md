# OX Runtime for C#

A powerful, attribute-based OX parser and mapper for C# with full reflection support.

## Features

- **Complete OX Parser**: Full support for all OX syntax including blocks, properties, tags, free text, and comments
- **Attribute-Based Mapping**: Use C# attributes to declaratively map OX to your domain objects
- **Convention Over Configuration**: Auto-mapping by property name when attributes aren't needed
- **Tag Registry**: Map OX tags to C# types for polymorphic deserialization
- **Type Safety**: Full compile-time type checking with generics
- **Flexible**: Support for collections, nested objects, free text, and more

## Quick Start

### Installation

Add the OX runtime to your project:

```bash
dotnet add reference path/to/OX.csproj
```

### Basic Usage

```csharp
using OX;

var oxSource = """
[Player (name: "Hero", health: 100)]
""";

var mapper = new OXMapper();
var config = mapper.Parse<GameConfig>(oxSource);

Console.WriteLine($"Player: {config.Player.Name}");
```

### Define Your Models

```csharp
class GameConfig
{
    public Player Player { get; set; } = new();
}

class Player
{
    [OXProperty("name")]
    public string Name { get; set; } = "";

    [OXProperty("health")]
    public int Health { get; set; }
}
```

## Attributes

### `[OXTag(tagName, arguments)]`

Map a class to an OX tag for polymorphic deserialization.

```csharp
[OXTag("button")]
public class Button
{
    [OXProperty("text")] 
    public string Text { get; set; } = "";
}

// Register with mapper
mapper.RegisterTag<Button>();

// Use in OX
"""
@button
[MyButton (text: "Click Me")]
"""
```

### `[OXProperty(propertyName)]`

Map a property to an OX property value.

```csharp
class Player
{
    [OXProperty("name")]
    public string Name { get; set; } = "";
    
    [OXProperty("health")]
    public int Health { get; set; }
}
```

### `[OXChild(blockId)]`

Map a property to a child block by ID.

```csharp
class Player
{
    [OXChild("Position")]
    public Position Position { get; set; } = new();
}
```

### `[OXChildren(tagFilter)]`

Map a property to all child blocks (for collections).

```csharp
class Container
{
    [OXChildren] // All children
    public List<Item> Items { get; set; } = new();
    
    [OXChildren("button")] // Only children with @button tag
    public List<Button> Buttons { get; set; } = new();
}
```

### `[OXFreeText]`

Map a property to free text content (triple backtick blocks).

```csharp
class Documentation
{
    [OXFreeText]
    public string Content { get; set; } = "";
}
```

### `[OXBlockId]`

Map a property to the block's ID.

```csharp
class Widget
{
    [OXBlockId]
    public string Id { get; set; } = "";
}
```

## Examples

### Example 1: Nested Objects

```csharp
var oxSource = """
[Player (name: "Hero", health: 100)
    [Position (x: 10.5, y: 20.3, z: 0)]
]
""";

class GameConfig
{
    public Player Player { get; set; } = new();
}

class Player
{
    [OXProperty("name")] public string Name { get; set; } = "";
    [OXProperty("health")] public int Health { get; set; }
    [OXChild] public Position Position { get; set; } = new();
}

class Position
{
    [OXProperty("x")] public double X { get; set; }
    [OXProperty("y")] public double Y { get; set; }
    [OXProperty("z")] public double Z { get; set; }
}
```

### Example 2: Tag-Based Polymorphism

```csharp
var oxSource = """
@button
[SubmitButton (text: "Submit", x: 100)]

@panel
[MainPanel (width: 800, height: 600)]
""";

var mapper = new OXMapper();
mapper.RegisterTag<Button>();
mapper.RegisterTag<Panel>();

var ui = mapper.Parse<UIConfig>(oxSource);

[OXTag("button")]
class Button
{
    [OXProperty("text")] public string Text { get; set; } = "";
    [OXProperty("x")] public int X { get; set; }
}

[OXTag("panel")]
class Panel
{
    [OXProperty("width")] public int Width { get; set; }
    [OXProperty("height")] public int Height { get; set; }
}
```

### Example 3: Collections and Anonymous Blocks

```csharp
var oxSource = """
[Container (name: "Items")
    [ (value: 100, label: "Gold")]
    [ (value: 50, label: "Silver")]
]
""";

class Container
{
    [OXProperty("name")] public string Name { get; set; } = "";
    [OXChildren] public List<Item> Items { get; set; } = new();
}

class Item
{
    [OXProperty("value")] public int Value { get; set; }
    [OXProperty("label")] public string Label { get; set; } = "";
}
```

### Example 4: Free Text Blocks

```csharp
var oxSource = """
[Documentation (title: "User Guide")
```
This is the documentation content.
It can span multiple lines.
```
]
""";

class Documentation
{
    [OXProperty("title")] public string Title { get; set; } = "";
    [OXFreeText] public string Content { get; set; } = "";
}
```

### Example 5: Auto-Mapping (Convention Over Configuration)

When property names match (case-insensitive), attributes are optional:

```csharp
var oxSource = """
[Settings (volume: 0.8, fullscreen: true)]
""";

class Settings
{
    public double Volume { get; set; }      // Auto-maps to "volume"
    public bool Fullscreen { get; set; }    // Auto-maps to "fullscreen"
}
```

## Type Conversions

The mapper automatically handles:

- **Numbers**: `long`, `int`, `short`, `byte`, `double`, `float`
- **Booleans**: `true`, `false`
- **Strings**: With escape sequence support (`\n`, `\t`, `\"`, etc.)
- **Nullables**: `int?`, `double?`, etc.
- **Enums**: By name (case-insensitive)
- **Arrays**: OX arrays `[1, 2, 3]` → `List<int>`
- **Collections**: `List<T>`, `IList<T>`, `IEnumerable<T>`

## API Reference

### `OXMapper`

```csharp
// Register a tagged type
mapper.RegisterTag<Button>();

// Parse OX source
var result = mapper.Parse<T>(source, filename);

// Parse OX file
var result = mapper.ParseFile<T>(path);

// Map existing document
var result = mapper.MapDocument<T>(document);

// Map existing block
var result = mapper.MapTree<T>(block);
```

### `OXParser`

```csharp
var parser = new OXParser(source, filename);
OXDocument document = parser.Parse();
```

## Building and Running

```bash
# Build the library
cd runtimes/csharp
dotnet build

# Run the example
cd Example
dotnet run
```

## What's NOT Implemented (By Design)

Like the Odin runtime, these features are left to the JavaScript preprocessor:

- ❌ Template expansion (`<set>`, `<while>`, `<if>`)
- ❌ Expression evaluation
- ❌ Reference resolution (`$parent`, `$this`)
- ❌ Inject directives

The C# runtime focuses on **parsing and mapping** preprocessed OX files.

## Comparison with Other Runtimes

| Feature | JavaScript | Odin | C# |
|---------|-----------|------|-----|
| Parsing | ✅ | ✅ | ✅ |
| Type Mapping | Manual | Reflection | Attributes + Reflection |
| Templates | ✅ | ❌ | ❌ |
| Tag Registry | ✅ | ✅ | ✅ |
| Auto-Mapping | ❌ | Limited | ✅ |
| Type Safety | ❌ | ✅✅ | ✅✅ |

## Advanced Features

### Custom Naming Conventions

The mapper automatically handles:
- `PascalCase` ↔ `camelCase`
- `kebab-case` ↔ `PascalCase`
- `snake_case` ↔ `PascalCase`

### Nullable Support

```csharp
class Player
{
    [OXProperty("level")]
    public int? Level { get; set; }  // Maps null correctly
}
```

### Enum Support

```csharp
enum Difficulty { Easy, Normal, Hard }

class Settings
{
    [OXProperty("difficulty")]
    public Difficulty Difficulty { get; set; }
}

// OX: (difficulty: "Hard")
```

## License

Same as the main OX project.
