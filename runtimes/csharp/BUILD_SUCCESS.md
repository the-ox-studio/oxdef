# OX Runtime for C# - Build Success

## ✅ Successfully Implemented

The C# runtime library for OX is now complete and fully functional!

### What Works

1. **Complete OX Parser**
   - ✅ Tokenizer/Lexer for all OX syntax
   - ✅ Parser for blocks (named and anonymous)
   - ✅ Properties (strings, numbers, booleans, null, arrays)
   - ✅ Tags (@declaration and #instance)
   - ✅ Free text blocks (triple backtick syntax)
   - ✅ Comments (line and block)

2. **Attribute-Based Mapping System**
   - ✅ `[OXTag]` - Map classes to OX tags
   - ✅ `[OXProperty]` - Map properties to OX properties
   - ✅ `[OXChild]` - Map properties to child blocks
   - ✅ `[OXChildren]` - Map properties to collections
   - ✅ `[OXFreeText]` - Map properties to free text
   - ✅ `[OXBlockId]` - Map properties to block IDs

3. **Advanced Features**
   - ✅ Tag Registry for polymorphic deserialization
   - ✅ Convention-based auto-mapping (no attributes needed!)
   - ✅ Automatic type conversions (numbers, enums, nullables)
   - ✅ Generic type support with `MapTree<T>()`
   - ✅ Nested object mapping
   - ✅ Collection mapping (List<T>, IList<T>, IEnumerable<T>)
   - ✅ Case-insensitive property matching
   - ✅ PascalCase/camelCase/kebab-case conversions

4. **Type Safety**
   - ✅ Full compile-time type checking
   - ✅ Nullable reference types support
   - ✅ Generic constraints
   - ✅ Reflection-based validation

## Build Status

```bash
cd runtimes/csharp
dotnet build          # ✅ Success (0 errors, 0 warnings)

cd Example
dotnet run           # ✅ All 5 examples working
```

## Example Output

```
=== OX C# Runtime Example ===

--- Example 1: Basic Property Mapping ---
Player: Hero (HP: 100/100)
Position: (10.5, 20.3, 0)

--- Example 2: Tag-Based Mapping ---
Button: 'Click Me' at (100, 50)
Panel: 800x600

--- Example 3: Collections with Anonymous Blocks ---
Container: ItemList
Items: 3
  - Gold: 100
  - Silver: 50
  - Bronze: 25

--- Example 4: Free Text Blocks ---
Title: User Guide
Version: 1.0
Content:
This is a comprehensive user guide for the application.

It supports multiple paragraphs and formatting.

--- Example 5: Auto-Mapping (Convention Over Configuration) ---
Settings: Volume=0.8, Fullscreen=True, Resolution=1920x1080
```

## Key Features Demonstrated

### 1. Attribute-Based Mapping

```csharp
[OXTag("button")]
public class Button
{
    [OXProperty("text")] public string Text { get; set; } = "";
    [OXProperty("x")] public int X { get; set; }
}

var mapper = new OXMapper();
mapper.RegisterTag<Button>();
var ui = mapper.Parse<UIConfig>(oxSource);
```

### 2. Auto-Mapping (Convention Over Configuration)

```csharp
class Settings
{
    public double Volume { get; set; }      // Auto-maps to "volume"
    public bool Fullscreen { get; set; }    // Auto-maps to "fullscreen"
}

// No attributes needed!
```

### 3. Collections with Anonymous Blocks

```csharp
class Container
{
    [OXChildren]
    public List<Item> Items { get; set; } = new();
}

// Maps from:
"""
[Container
    [ (value: 100)]
    [ (value: 50)]
]
"""
```

### 4. Tag-Based Polymorphism

```csharp
mapper.RegisterTag<Button>();
mapper.RegisterTag<Panel>();

// Automatically deserializes to correct type based on @tag
```

## Architecture Highlights

1. **Modern C# Features**
   - Nullable reference types
   - Top-level statements
   - Raw string literals (triple quotes)
   - Pattern matching in switch expressions
   - Record types support (potential)

2. **Reflection-Based**
   - Runtime type inspection
   - Attribute discovery
   - Generic type creation
   - Dynamic value conversion

3. **Flexible Mapping**
   - Attributes for explicit mapping
   - Convention for implicit mapping
   - Tag registry for polymorphism
   - Type conversion system

## Comparison: Odin vs C#

| Feature | Odin Runtime | C# Runtime |
|---------|--------------|------------|
| **Mapping Style** | Reflection + field name matching | Attributes + reflection + auto-mapping |
| **Type System** | Compile-time structs | Classes with attributes |
| **Polymorphism** | Tag handlers (callbacks) | Tag registry (type mapping) |
| **Collections** | `children: [dynamic]T` field | `[OXChildren] List<T>` attribute |
| **Free Text** | `free_text: string` field | `[OXFreeText] string` attribute |
| **Convention** | snake_case transformation | PascalCase/camelCase auto-match |
| **Ease of Use** | ⭐⭐⭐ (requires field names) | ⭐⭐⭐⭐⭐ (attributes OR auto-map) |
| **Type Safety** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Flexibility** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## Files Created

- `runtimes/csharp/OX.csproj` - Project file
- `runtimes/csharp/OXAttributes.cs` - Attribute definitions
- `runtimes/csharp/OXNode.cs` - AST node types
- `runtimes/csharp/OXParser.cs` - Tokenizer and parser (~450 lines)
- `runtimes/csharp/OXMapper.cs` - Reflection-based mapper (~350 lines)
- `runtimes/csharp/Example/` - Working examples
- `runtimes/csharp/README.md` - Complete documentation

## What's NOT Implemented (By Design)

Like the Odin runtime:

- ❌ Template expansion (`<set>`, `<while>`, `<if>`)
- ❌ Expression evaluation
- ❌ Reference resolution (`$parent`, `$this`)
- ❌ Inject directives

The C# runtime focuses on **parsing and attribute-based mapping** for preprocessed OX files.

## Advanced Features

### Type Conversions

Automatic conversion between:
- OX numbers → C# `int`, `long`, `double`, `float`, etc.
- OX booleans → C# `bool`
- OX strings → C# `string`, `enum`
- OX arrays → C# `List<T>`, `IList<T>`, `IEnumerable<T>`
- OX null → C# nullable types (`int?`, `string?`)

### Naming Convention Mapping

```csharp
// All of these automatically match:
[OXProperty("player-health")] → PlayerHealth
[OXProperty("player_health")] → PlayerHealth  
[OXProperty("playerHealth")]  → PlayerHealth
[OXProperty("PlayerHealth")]  → PlayerHealth
```

### Attribute Flexibility

```csharp
// Explicit mapping
[OXProperty("x")] public int X { get; set; }

// Auto-mapping (if property name matches)
public int X { get; set; }  // Maps to "x" or "X" automatically
```

## Usage Patterns

### Pattern 1: DTOs with Attributes (Explicit)

```csharp
class Player
{
    [OXProperty("name")] public string Name { get; set; } = "";
    [OXProperty("health")] public int Health { get; set; }
}
```

### Pattern 2: POCOs with Auto-Mapping (Convention)

```csharp
class Settings
{
    public double Volume { get; set; }
    public bool Fullscreen { get; set; }
}
```

### Pattern 3: Tag-Based Polymorphism

```csharp
[OXTag("button")] class Button { ... }
[OXTag("panel")] class Panel { ... }

mapper.RegisterTag<Button>();
mapper.RegisterTag<Panel>();
```

## Next Steps

The C# runtime is production-ready! Users can:

1. Add reference: `dotnet add reference path/to/OX.csproj`
2. Define models with attributes
3. Parse OX: `var config = mapper.Parse<GameConfig>(source)`
4. Use strongly-typed data!

---

**Status**: ✅ Complete and Tested  
**Build**: ✅ Success (0 errors, 0 warnings)  
**Examples**: ✅ All 5 examples working perfectly  
**Target Framework**: .NET 8.0  
**Language Features**: C# 12 with nullable reference types
