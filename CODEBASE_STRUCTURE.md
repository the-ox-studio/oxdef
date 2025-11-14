# OX Definition Language - Codebase Structure & Architecture

## Overview

The oxdef parser is a three-phase system for processing the OX data definition language:
1. **Lexical Analysis (Tokenization)** - Convert source text to tokens
2. **Syntax Analysis (Parsing)** - Convert tokens to AST (Abstract Syntax Tree)
3. **Preprocessing & Execution** - Template evaluation, expression resolution, tag processing

## Directory Structure

```
oxdef/
├── src/
│   ├── lexer/
│   │   └── tokenizer.js           # Tokenizer/Lexer implementation
│   ├── parser/
│   │   ├── ast.js                 # AST node definitions
│   │   └── parser.js              # Parser (recursive descent)
│   ├── preprocessor/
│   │   ├── tags.js                # Tag registry & processor
│   │   ├── expressions.js         # Expression evaluator
│   │   ├── references.js          # Reference resolution ($parent.width)
│   │   ├── macros.js              # Macro system (user-defined processing)
│   │   ├── templates.js           # Template expansion (<set>, <if>, <foreach>, etc.)
│   │   └── datasources.js         # Data source handling (<on-data>)
│   ├── walker/
│   │   └── walker.js              # AST tree traversal utilities
│   ├── transaction/
│   │   └── transaction.js         # Transaction context for execution
│   └── errors/
│       └── errors.js              # Error classes & location tracking
├── test/
│   ├── lexer.test.js
│   ├── parser.test.js
│   ├── tags.test.js
│   ├── templates.test.js
│   ├── expressions.test.js
│   ├── references.test.js
│   ├── datasources.test.js
│   ├── macros-milestone1.test.js
│   ├── macros-milestone2.test.js
│   ├── template-expansion.test.js
│   ├── two-pass-integration.test.js
│   └── walker.test.js
└── examples/
    ├── run.js
    └── run-module-demo.js
```

---

## 1. LEXER / TOKENIZER

**Location:** `src/lexer/tokenizer.js`

### Purpose
Converts raw OX source code into a sequence of tokens.

### Key Classes

#### `Token`
Represents a single token with:
- `type` - TokenType enum value
- `value` - The token's semantic value
- `line`, `column` - Location for error reporting
- `raw` - Original text representation

#### `Tokenizer`
Main lexer class with methods:
- `nextToken()` - Get next single token
- `tokenize()` - Tokenize entire input
- `readIdentifier()`, `readNumber()`, `readString()` - Value readers
- `skipWhitespace()`, `skipLineComment()`, `skipBlockComment()` - Whitespace/comment handling

### Token Types (TokenType enum)

**Literals:**
- `IDENTIFIER` - Variable/block names
- `STRING` - Quoted strings ("..." or '...')
- `NUMBER` - Integers and floats
- `BOOLEAN` - `true` / `false`
- `NULL` - `null` keyword

**Delimiters:**
- `LBRACKET` / `RBRACKET` - `[` `]` (blocks)
- `LPAREN` / `RPAREN` - `(` `)` (properties)
- `LBRACE` / `RBRACE` - `{` `}` (arrays)

**Operators:**
- `COLON` `:` (property separator)
- `COMMA` `,` (list separator)
- `DOT` `.` (property access)
- `EQUALS` `=` (assignment)
- `DOLLAR` `$` (reference prefix)
- `AT` `@` (tag definition)
- `HASH` `#` (tag instance)

**Arithmetic:** `PLUS`, `MINUS`, `STAR`, `SLASH`, `PERCENT`, `POWER` (`**`)

**Comparison:** `EQ` (`==`), `NEQ` (`!=`), `GT` (`>`), `LT` (`<`), `GTE` (`>=`), `LTE` (`<=`)

**Logical:** `AND` (`&&`), `OR` (`||`), `NOT` (`!`)

**Special:**
- `LT` / `GT` - `<` `>` (also used for templates)
- `SLASH` - `/` (also used for closing tags)
- `NEWLINE` - Newline character
- `EOF` - End of file
- `COMMENT` - Comment text

### Example
```javascript
import { tokenize, TokenType } from './src/lexer/tokenizer.js';

const tokens = tokenize('[Box (width: 100)]');
// Output: [LBRACKET, IDENTIFIER, LPAREN, IDENTIFIER, COLON, NUMBER, RPAREN, RBRACKET, EOF]
```

---

## 2. PARSER

**Location:** `src/parser/parser.js`

### Purpose
Converts tokens into an Abstract Syntax Tree (AST) using recursive descent parsing.

### Key Class

#### `Parser`
Main parser class with methods:

**Core Methods:**
- `parse()` - Parse entire document
- `parseBlock()` - Parse `[Identifier (properties) children...]`
- `parseTag()` - Parse `@identifier` or `#identifier(arg)`
- `parseProperties()` - Parse `(key: value, ...)`
- `parseValue()` - Parse literal, array, or expression
- `parseExpression()` - Parse `(tokens...)`
- `parseArray()` - Parse `{item1, item2, ...}`
- `parseTemplate()` - Parse `<keyword ...>`

**Template Methods:**
- `parseSet()` - Parse `<set name = value>`
- `parseIf()` - Parse `<if (condition)>...<elseif>...<else>...</if>`
- `parseForeach()` - Parse `<foreach (item in collection)>...</foreach>`
- `parseWhile()` - Parse `<while (condition)>...</while>`
- `parseOnData()` - Parse `<on-data source>...<on-error>...</on-data>`
- `parseImport()` - Parse `<import "path" as alias>`

**Helper Methods:**
- `current()` / `peek(n)` - Token inspection
- `advance()` / `match()` / `expect()` - Token consumption
- `check(type)` - Type checking
- `isAtEnd()` - EOF detection
- `error(message)` - Error reporting

### Parsing Flow
1. **Document level** → Imports, templates, blocks
2. **Block level** → Tags, identifier, properties, children
3. **Value level** → Literals, arrays, expressions
4. **Expression level** → Token sequences (lazy evaluation)

### Example
```javascript
import { parse } from './src/parser/parser.js';

const ast = parse('[Box (width: 100, height: 50)]');
// ast.blocks[0] = BlockNode {
//   id: 'Box',
//   properties: { width: LiteralNode(100), height: LiteralNode(50) },
//   children: [],
//   tags: []
// }
```

---

## 3. AST NODE DEFINITIONS

**Location:** `src/parser/ast.js`

### Base Class

#### `ASTNode`
Base class for all AST nodes:
- `type` - String type identifier (e.g., 'Block', 'Tag')
- `location` - Location object for error reporting

### Node Types

#### `BlockNode`
Represents: `[Identifier (properties) children...]`

Properties:
- `id` - Block identifier (string)
- `properties` - Object mapping property names to values
- `children` - Array of child BlockNodes or TemplateNodes
- `tags` - Array of TagNode definitions/instances
- `location` - Source location

#### `TagNode`
Represents: `@tag` or `@tag(arg)` or `#tag` or `#tag(arg)`

Properties:
- `tagType` - 'definition' (@) or 'instance' (#)
- `name` - Tag name
- `argument` - Optional tag argument
- `location` - Source location

#### `PropertyNode`
Represents: Key-value pair in properties

Properties:
- `key` - Property name
- `value` - LiteralNode, ArrayNode, or ExpressionNode

#### `LiteralNode`
Represents: Literal values

Properties:
- `valueType` - 'string', 'number', 'boolean', 'null'
- `value` - The actual value

#### `ArrayNode`
Represents: `{item1, item2, item3}`

Properties:
- `elements` - Array of LiteralNode or ExpressionNode

#### `ExpressionNode`
Represents: `(expression)` - lazy-evaluated token sequences

Properties:
- `tokens` - Array of Token objects
- `resolved` - Boolean (whether evaluated)
- `value` - Evaluated result (after preprocessing)

#### `SetNode`
Represents: `<set name = value>`

Properties:
- `name` - Variable name
- `value` - LiteralNode or ExpressionNode

#### `IfNode`
Represents: `<if (condition)>...<elseif>...<else>...</if>`

Properties:
- `condition` - ExpressionNode
- `thenBlocks` - Array of blocks to execute if true
- `elseIfBranches` - Array of {condition, blocks}
- `elseBlocks` - Array of blocks for else clause

#### `ForeachNode`
Represents: `<foreach (item in collection)>...</foreach>`

Properties:
- `itemVar` - Loop item variable name
- `indexVar` - Optional loop index variable
- `collection` - Collection variable/expression name
- `body` - Array of blocks in loop

#### `WhileNode`
Represents: `<while (condition)>...</while>`

Properties:
- `condition` - ExpressionNode
- `body` - Array of blocks in loop

#### `OnDataNode`
Represents: `<on-data source>...<on-error>...</on-data>`

Properties:
- `sourceName` - Data source name
- `dataBlocks` - Blocks to execute on data
- `errorBlocks` - Blocks to execute on error

#### `ImportNode`
Represents: `<import "path" as alias>`

Properties:
- `path` - File path to import
- `alias` - Optional import alias

#### `DocumentNode`
Represents: The entire parsed document

Properties:
- `blocks` - Array of top-level BlockNodes
- `imports` - Array of ImportNode
- `templates` - Array of template nodes (Set, If, Foreach, etc.)

---

## 4. TAGS SYSTEM

**Location:** `src/preprocessor/tags.js`

### Purpose
Manages tag definitions and instances, validates tag usage, and expands tag compositions.

### Key Classes

#### `TagRegistry`
Manages tag definitions and instances:

Methods:
- `defineTag(name, config)` - Register a tag definition
- `getTag(name)` / `hasTag(name)` - Retrieve tag definition
- `registerInstance(key, blockNode)` - Register tag instance from `@tag` block
- `getInstance(key)` / `hasInstance(key)` - Retrieve tag instance
- `getInstancesForTag(tagName)` - Get all instances for a tag name
- `clearInstances()` - Clear all registered instances

#### `TagProcessor`
Validates and expands tags:

Methods:
- `createKey(tagName, argument)` - Create instance key format
- `validateTag(tag, blockNode, isDefinition)` - Validate tag usage
- `validateNoExpressions(blockNode)` - Ensure tag definitions have no expressions
- `validateComposition(tags, blockNode)` - Validate multiple tags on same block
- `detectTagUsage(blockNode)` - Detect tag usage type (definition/instance/composition/none)
- `processDefinitions(blocks)` - Extract and register `@tag` blocks
- `validateInstances(blocks)` - Verify all `#tag` instances reference valid definitions
- `expandComposition(blockNode, tags)` - Expand multiple tags into child blocks
- `expandInstance(blockNode, tag)` - Expand single tag instance with definition
- `expandTags(blocks)` - Expand all tag instances in blocks
- `injectModuleProperties(blocks)` - Inject module-computed properties
- `cloneBlock(block)` - Deep clone a block node

### Tag Definition Config

```javascript
registry.defineTag('component', {
  block: {
    canReuse: true,        // Can be used as @component and #component
    canOutput: true,       // Include definition block in output
    acceptChildren: true,  // Allow children on instances
    output: null           // Optional custom output function
  },
  module: {
    computedProp: () => 'value'  // Module properties (computed)
  },
  descriptor: {
    attributes: [],  // Exposed attributes
    exposeAs: []     // Exposed as array
  }
});
```

### Tag Usage Patterns

**Definition (@ prefix):**
```
@component [Button (label: "Click")]
```
- Defines a reusable component
- Cannot have expressions in properties
- Registered in TagRegistry

**Instance (# prefix):**
```
#component [MyButton]
```
- Uses a previously defined component
- Merges properties with definition
- Expands to definition's structure

**Composition (multiple # tags):**
```
#component #animated [Button]
```
- Applies multiple tags sequentially
- Cannot have properties or children
- All tags must be instances (no @)

---

## 5. CURRENT PARSING FLOW

```
Source Code
    ↓
TOKENIZER (src/lexer/tokenizer.js)
    ↓ tokenize()
Token[] (array of Token objects)
    ↓
PARSER (src/parser/parser.js)
    ↓ parse()
DocumentNode (AST)
    ├── blocks: BlockNode[]
    ├── imports: ImportNode[]
    └── templates: (Set|If|Foreach|While|OnData)Node[]
    ↓
PREPROCESSOR (src/preprocessor/*.js)
    ├── Tag Processing (tags.js)
    ├── Expression Evaluation (expressions.js)
    ├── Reference Resolution (references.js)
    ├── Template Expansion (templates.js)
    └── Data Source Handling (datasources.js)
    ↓
Processed AST
    ↓
TREE WALKER (src/walker/walker.js)
    ↓ walk()
User-defined Processing (via callbacks)
```

---

## 6. WHITESPACE & PREPROCESSING HANDLING

### Tokenizer Whitespace Handling
- **Skipped:** Spaces, tabs, carriage returns (except newlines)
- **Preserved:** Newlines (as `NEWLINE` tokens, but filtered by parser)
- **Comments:** `//` (line) and `/* */` (block) are completely skipped

### String Escape Sequences
Supported in string literals:
- `\n` → newline
- `\t` → tab
- `\r` → carriage return
- `\\` → backslash
- `\"` → double quote
- `\'` → single quote

### No Current Markdown-like Preprocessing
The tokenizer does not currently support:
- Triple backtick syntax (```text```)
- Indentation-based blocks
- Raw text blocks without quotation

---

## 7. EXPRESSION EVALUATION

**Location:** `src/preprocessor/expressions.js`

### ExpressionEvaluator
Evaluates expression nodes with operator precedence:

**Operator Precedence (highest to lowest):**
1. Primary (literals, identifiers, parentheses)
2. Power (`**`)
3. Unary (`-`, `!`)
4. Multiplication/Division (`*`, `/`, `%`)
5. Addition/Subtraction (`+`, `-`)
6. Comparison (`<`, `>`, `<=`, `>=`)
7. Equality (`==`, `!=`)
8. Logical AND (`&&`)
9. Logical OR (`||`)

### Token-based Lazy Evaluation
Expressions are stored as raw `Token[]` in `ExpressionNode.tokens` and evaluated later during preprocessing phase.

---

## 8. REFERENCE RESOLUTION

**Location:** `src/preprocessor/references.js`

### Reference Syntax
- `$parent` - Parent block
- `$parent.propertyName` - Parent property access
- `$root` - Root document
- `$currentBlock` - Current block
- `$var` - Variable from context

### Two-Pass System
1. **First Pass** - Collect all blocks and variable definitions
2. **Second Pass** - Resolve references with full context

---

## 9. TREE WALKER

**Location:** `src/walker/walker.js`

### TreeWalker Class
Provides flexible AST traversal with:

**Traversal Orders:**
- `PRE` - Depth-first, visit parent before children
- `POST` - Depth-first, visit children before parent
- `BREADTH` - Breadth-first level-by-level

**Features:**
- `trackParents` - Maintain parent chain
- `filter` - Custom node filtering
- `callback(node, parent)` - Process each node
- `WalkerControl.SKIP` - Skip children
- `WalkerControl.STOP` - Stop entire traversal

### Example
```javascript
const walker = new TreeWalker(ast, (node, parent) => {
  console.log(`Node: ${node.id}`);
  if (shouldSkip) return WalkerControl.SKIP;
  if (shouldStop) return WalkerControl.STOP;
});
walker.walk();
```

---

## 10. ERROR HANDLING

**Location:** `src/errors/errors.js`

### Error Classes

#### `OXError` (Base)
Base class for all OX errors with location tracking.

#### `ParseError`
Thrown during tokenization/parsing phase (Stage 1).
- Fails fast at first error
- Includes location and context information

#### `PreprocessError`
Thrown during preprocessing phase (Stage 2).
- Can collect multiple errors
- Includes error subtype, location, suggestion

#### `OXWarning`
Non-fatal issues with location tracking.

#### `ErrorCollector`
Collects multiple errors/warnings:
- `addError(error)` / `addWarning(warning)`
- `hasErrors()` / `hasWarnings()`
- `getReport()` - Get full error/warning report
- `clear()` - Reset collected errors

---

## 11. TEST STRUCTURE

Located in `test/` directory:

| Test File | Purpose |
|-----------|---------|
| `lexer.test.js` | Tokenizer functionality |
| `parser.test.js` | Parser and AST generation |
| `tags.test.js` | Tag registry and processor |
| `templates.test.js` | Template parsing and expansion |
| `expressions.test.js` | Expression evaluation |
| `references.test.js` | Reference resolution |
| `datasources.test.js` | Data source handling |
| `macros-milestone1.test.js` | Macro system Phase 1 |
| `macros-milestone2.test.js` | Macro system Phase 2 |
| `template-expansion.test.js` | Template integration |
| `two-pass-integration.test.js` | Two-pass reference resolution |
| `walker.test.js` | Tree walker functionality |

---

## 12. IMPLEMENTATION POINTS FOR FREE TEXT BLOCKS

### Current Constraints
1. **Strings are always quoted** - Double or single quotes required
2. **No multiline text handling** - Strings must escape newlines as `\n`
3. **No raw text blocks** - No Markdown-like syntax support
4. **No indentation-based processing** - Whitespace is mostly ignored

### Key Integration Points for Free Text Support

To implement triple backtick free text blocks (```` ``` ````), you would need to:

1. **Tokenizer (tokenizer.js)**
   - Add detection for triple backtick sequence
   - Create new token type: `FREETEXT_BLOCK` or `BACKTICK`
   - Handle indentation-aware multiline text capture
   - Preserve whitespace and newlines in free text

2. **Parser (parser.js)**
   - Handle `FreeTextBlockNode` in `parseValue()`
   - Allow free text blocks in property values
   - Support optional language identifier after opening backticks
   - Handle closing backticks with proper nesting

3. **AST (ast.js)**
   - Add `FreeTextBlockNode` class:
     ```javascript
     class FreeTextBlockNode extends ASTNode {
       constructor(content, language = null, location = null) {
         super('FreeTextBlock', location);
         this.content = content;
         this.language = language;
       }
     }
     ```

4. **Tests**
   - Add free text block tests to existing test files
   - Test edge cases: nested backticks, indentation, empty blocks

### Example Syntax to Support
```ox
[CodeBlock (
  source: ```javascript
    function hello() {
      console.log("world");
    }
  ```,
  description: "A simple function"
)]
```

---

## Summary

The OX parser uses a clean three-phase architecture:

1. **Lexer** → Tokens (handles strings, numbers, operators, delimiters)
2. **Parser** → AST (recursive descent, creates typed nodes)
3. **Preprocessor** → Execution (templates, tags, expressions, references)

Key systems:
- **Tags** enable component reuse with instance/definition pattern
- **Templates** provide control flow (`<if>`, `<foreach>`, etc.)
- **Expressions** support lazy evaluation with operator precedence
- **References** resolve `$parent`, `$root` shortcuts
- **TreeWalker** provides flexible AST traversal

For free text blocks, integration points are primarily in the **tokenizer** (detecting backticks), **parser** (creating free text nodes), and **AST** (new node type).
