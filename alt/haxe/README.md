# Haxe Externs for OXDef

This directory contains Haxe extern definitions for the oxdef JavaScript library, allowing Haxe developers to use the OX specification parser and preprocessor with full type safety.

## Structure

```
alt/haxe/
├── oxdef/           # Extern definitions
│   ├── AST.hx       # AST node types and factory functions
│   ├── Parser.hx    # Parser class and functions
│   └── Tokenizer.hx # Tokenizer and token types
├── examples/        # Usage examples
│   └── Basic.hx     # Basic parsing example
├── bin/             # Compiled output
├── build.hxml       # Haxe build configuration
└── README.md        # This file
```

## Installation

1. **Link the oxdef package** (from the project root, then haxe directory):
   ```bash
   # From project root
   npm link
   
   # From alt/haxe directory
   cd alt/haxe
   npm init -y
   npm link oxdef
   ```

2. **Build the example**:
   ```bash
   haxe build.hxml
   ```

3. **Run the example**:
   ```bash
   node bin/example.cjs
   ```

## Usage

### Basic Parsing

```haxe
import oxdef.Parser;
import oxdef.AST;

class Example {
    static function main() {
        var source = '[Player (name: "Hero", health: 100)]';
        var ast = ParserModule.parse(source, "example.ox");
        
        trace('AST type: ${ast.type}');
        trace('Blocks: ${ast.blocks.length}');
    }
}
```

### Using the Parser Class

```haxe
import oxdef.Parser;
import oxdef.Tokenizer;

var tokens = TokenizerModule.tokenize(source);
var parser = new Parser(tokens, "example.ox");
var ast = parser.parse();
```

## Extern Architecture

The externs use the `@:jsRequire` and `@:native` pattern for FFI:

- **`@:jsRequire("oxdef", "ClassName")`** - Imports a named export from the oxdef npm package
- **`@:jsRequire("oxdef")`** - Imports the entire module for accessing multiple named exports
- **`@:native("functionName")`** - Binds to a specific exported function within the module

### Example Pattern

```haxe
// For a class export
@:jsRequire("oxdef", "Parser")
extern class Parser {
    function new(tokens:Array<Token>);
    function parse():DocumentNode;
}

// For module-level functions
@:jsRequire("oxdef")
extern class ParserModule {
    @:native("parse")
    public static function parse(source:String):DocumentNode;
}
```

## Available Modules

### Parser (`oxdef.Parser`)
- **Parser** class - Recursive descent parser
- **ParserModule.parse()** - Parse OX source to AST
- **ParserModule.parseWithMacros()** - Parse with macro expansion

### AST (`oxdef.AST`)
- All AST node types (DocumentNode, BlockNode, PropertyNode, etc.)
- **ASTFactory** - Factory functions for creating AST nodes

### Tokenizer (`oxdef.Tokenizer`)
- **TokenType** - Token type constants
- **Token** class - Individual token representation
- **Tokenizer** class - Lexical analyzer
- **TokenizerModule.tokenize()** - Tokenize source code

## Building

The build configuration (`build.hxml`) compiles to CommonJS format (`.cjs`) to work with the ES module oxdefinition package:

```hxml
-main Basic
-js bin/example.cjs
-cp examples/
-D js-es=6
-dce full
-debug
```

## Notes

- The oxdef package must be installed/linked as an npm module
- Output is compiled to CommonJS (`.cjs`) format
- The externs provide type-safe access to all major oxdef features
- Haxe's type system ensures correct usage of the API

## Future Improvements

Additional externs can be added for:
- Preprocessor modules (expressions, references, tags, templates, macros)
- Walker/traversal utilities
- Project management
- Error handling utilities
- Transaction system

## License

Same as the main oxdef project (MIT).
