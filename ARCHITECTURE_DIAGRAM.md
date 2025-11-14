# OX Parser Architecture Diagram

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        OX Source Code                            │
│  [Container (width: 100)                                         │
│    [Header]                                                      │
│  ]                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│        TOKENIZER/LEXER (src/lexer/tokenizer.js)                  │
│                                                                  │
│  • Input: Source code string                                     │
│  • Process: Character-by-character scanning                      │
│    - Skip whitespace/comments                                    │
│    - Recognize keywords (true, false, null)                      │
│    - Build identifiers, numbers, strings                         │
│  • Output: Token[] with types and values                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│  Tokens: [LBRACKET, IDENTIFIER("Container"), LPAREN,            │
│           IDENTIFIER("width"), COLON, NUMBER(100), RPAREN, ...]  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│         PARSER (src/parser/parser.js)                            │
│                                                                  │
│  • Input: Token[]                                                │
│  • Process: Recursive descent parsing                            │
│    - Match token patterns                                        │
│    - Build typed AST nodes                                       │
│    - Validate syntax structure                                   │
│  • Output: DocumentNode (root of AST)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│  AST (Abstract Syntax Tree)                                      │
│                                                                  │
│  DocumentNode                                                    │
│  ├── blocks: BlockNode[]                                         │
│  │   └── BlockNode {                                             │
│  │       id: "Container"                                         │
│  │       properties: { width: LiteralNode(100) }                 │
│  │       children: [ BlockNode("Header") ]                       │
│  │       tags: []                                                │
│  │   }                                                           │
│  ├── imports: ImportNode[]                                       │
│  └── templates: TemplateNode[]  (Set, If, Foreach, etc.)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│      PREPROCESSOR PIPELINE                                       │
│                                                                  │
│  1. Tag Processing (src/preprocessor/tags.js)                   │
│     - Detect @tag definitions and #tag instances                │
│     - Expand tag compositions                                    │
│     - Inject module properties                                   │
│                                                                  │
│  2. Expression Evaluation (src/preprocessor/expressions.js)      │
│     - Evaluate (expression) nodes with operator precedence       │
│     - Lazy evaluation of tokens                                  │
│                                                                  │
│  3. Reference Resolution (src/preprocessor/references.js)        │
│     - Resolve $parent, $root, $var references                    │
│     - Two-pass system for forward references                     │
│                                                                  │
│  4. Template Expansion (src/preprocessor/templates.js)           │
│     - Execute <set> variable definitions                         │
│     - Expand <if>/<elseif>/<else> conditionals                   │
│     - Loop <foreach>/<while>                                     │
│     - Async data source <on-data>                                │
│                                                                  │
│  5. Data Source Handling (src/preprocessor/datasources.js)       │
│     - Async fetching and error handling                          │
│     - Context injection                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│          PROCESSED AST                                           │
│    (All templates expanded, expressions evaluated,               │
│     references resolved, tags expanded)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│    TREE WALKER (src/walker/walker.js)                            │
│                                                                  │
│  • Input: Processed AST                                          │
│  • Process: Depth-first or breadth-first traversal               │
│    - Visit each node with custom callback                        │
│    - Track parent relationships                                  │
│    - Support early termination                                   │
│  • Output: User-defined structure (depends on callback)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              FINAL OUTPUT                                        │
│  (JSON, XML, HTML, or any target format via walker callback)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Interactions

### 1. Tokenizer State Machine

```
┌─────────────────────────────────────────────────────────┐
│                    Tokenizer Input                      │
│  "[Box (width: 100)]"                                   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
   CHARACTER        WHITESPACE    KEYWORDS
   SCANNING         HANDLING      DETECTION
        │              │              │
        └──────────────┼──────────────┘
                       │
                ┌──────┴──────┐
                │             │
            COMMENTS      LITERALS
                │             │
                └──────┬──────┘
                       │
                       ↓
            ┌──────────────────────┐
            │ TOKEN ARRAY          │
            │ [LBRACKET,           │
            │  IDENTIFIER,         │
            │  LPAREN,             │
            │  IDENTIFIER,         │
            │  COLON,              │
            │  NUMBER,             │
            │  RPAREN,             │
            │  RBRACKET,           │
            │  EOF]                │
            └──────────────────────┘
```

### 2. Parser Recursive Descent

```
                    parse()
                      │
                      ├─ parseDocument()
                      │    │
                      │    ├─ parseTemplate() [<set>, <if>, <foreach>, ...]
                      │    │    └─ parseExpression()
                      │    │
                      │    └─ parseBlock()
                      │         │
                      │         ├─ parseTag() [@/# prefix]
                      │         ├─ parseProperties() [(key: value, ...)]
                      │         │    └─ parseValue()
                      │         │         ├─ parseLiteral()
                      │         │         ├─ parseArray() [{items}]
                      │         │         └─ parseExpression() [(...)]
                      │         │
                      │         └─ parseChildren() [recursive blocks]
                      │
                      └─ DocumentNode (root)
```

### 3. AST Node Hierarchy

```
                        ASTNode
                          │
                ┌─────────────────────┬─────────────────────┐
                │                     │                     │
            BlockNode          TemplateNode            ValueNode
                │               │    │    │              │    │
                │          Set If Foreach While      Literal Array
                │               │    │    │         Expression  
                │          OnData Import          FreeTextBlock*
                │
        (Children array)
           (BlockNode[])
```

*FreeTextBlock = new node type to implement

### 4. Tag Processing Pipeline

```
┌──────────────────────────────────────────────┐
│         Original AST with Tags               │
│  @component [Button]                         │
│  #component [MyButton]                       │
└─────────────────────┬────────────────────────┘
                      │
                      ↓
        ┌─────────────────────────────┐
        │ processDefinitions()         │
        │ Detect @tag blocks          │
        │ Register in TagRegistry      │
        └──────────┬──────────────────┘
                   │
                   ↓
        ┌─────────────────────────────┐
        │ validateInstances()          │
        │ Verify #tag references      │
        │ Detect circular deps        │
        └──────────┬──────────────────┘
                   │
                   ↓
        ┌─────────────────────────────┐
        │ expandTags()                 │
        │ Merge properties             │
        │ Copy children from defs      │
        └──────────┬──────────────────┘
                   │
                   ↓
        ┌─────────────────────────────┐
        │ injectModuleProperties()     │
        │ Add computed properties      │
        │ from tag module config       │
        └──────────┬──────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│    Expanded AST without Tags                 │
│  [Button] (definition block or merged)       │
└──────────────────────────────────────────────┘
```

### 5. Expression Evaluation with Operator Precedence

```
           Expression: (2 + 3 * 4 == 14 && true)
                           │
                           ↓
                   parseExpression()
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
   parseLogicalOr()   [lowest precedence]
        │
        ↓
   parseLogicalAnd()
        │
        ↓
   parseEquality()
        │
        ↓
   parseComparison()
        │
        ↓
   parseAdditive()
        │
        ↓
   parseMultiplicative()
        │
        ↓
   parsePower()
        │
        ↓
   parseUnary()
        │
        ↓
   parsePrimary()
        │
        ↓
    Literal Value    [highest precedence]
```

### 6. Tree Walker Traversal Modes

```
                    DocumentNode
                         │
         ┌───────────────┬───────────────┐
         │               │               │
      BlockA          BlockB          BlockC
         │
      ┌──┴──┐
      │     │
   BlockD BlockE


PRE-ORDER (parent before children):
  1. DocumentNode
  2. BlockA
  3. BlockD
  4. BlockE
  5. BlockB
  6. BlockC

POST-ORDER (children before parent):
  1. BlockD
  2. BlockE
  3. BlockA
  4. BlockB
  5. BlockC
  6. DocumentNode

BREADTH-FIRST (level by level):
  1. DocumentNode
  2. BlockA, BlockB, BlockC
  3. BlockD, BlockE
```

---

## Key Data Structures

### Token Structure
```javascript
{
  type: "IDENTIFIER",           // TokenType enum
  value: "Container",           // Semantic value
  line: 1,                       // Line number
  column: 2,                     // Column number
  raw: "Container"              // Original text
}
```

### BlockNode Structure
```javascript
{
  type: "Block",
  id: "Container",
  location: { file: "input", line: 1, column: 1 },
  
  properties: {
    width: { type: "Literal", valueType: "number", value: 100 },
    height: { type: "Literal", valueType: "number", value: 50 }
  },
  
  children: [
    { type: "Block", id: "Header", ... },
    { type: "Block", id: "Content", ... }
  ],
  
  tags: [
    { type: "Tag", tagType: "definition", name: "component", ... }
  ]
}
```

### ExpressionNode (Lazy Evaluation)
```javascript
{
  type: "Expression",
  tokens: [
    { type: "DOLLAR", value: "$" },
    { type: "IDENTIFIER", value: "parent" },
    { type: "DOT", value: "." },
    { type: "IDENTIFIER", value: "width" },
    { type: "MINUS", value: "-" },
    { type: "NUMBER", value: 20 }
  ],
  resolved: false,
  value: null               // Set after evaluation
}
```

---

## Error Handling Flow

```
                        Source Code
                             │
                             ↓
                      ┌─────────────┐
                      │ TOKENIZER   │ → ParseError (char not recognized)
                      └─────────────┘
                             │
                             ↓
                      ┌─────────────┐
                      │ PARSER      │ → ParseError (syntax invalid)
                      └─────────────┘
                             │
                             ↓
                      ┌─────────────┐
                      │PREPROCESSOR │ → PreprocessError (semantic issues)
                      │             │   with subtype & suggestion
                      └─────────────┘
                             │
                             ↓
                      ┌─────────────┐
                      │ WALKER      │ → User-defined error handling
                      └─────────────┘

Location Tracking:
  Every error includes:
  - file: "filename"
  - line: number
  - column: number
```

---

## File Dependencies

```
src/parser/parser.js
  ├── imports: tokenizer, ast, errors
  └── provides: parse() function

src/preprocessor/tags.js
  ├── imports: errors, ast
  └── provides: TagRegistry, TagProcessor classes

src/preprocessor/expressions.js
  ├── imports: errors, tokenizer
  └── provides: ExpressionEvaluator class

src/preprocessor/references.js
  ├── imports: errors, ast
  └── provides: ReferenceResolver class

src/preprocessor/templates.js
  ├── imports: errors, expressions, walker
  └── provides: TemplateExpander class

src/walker/walker.js
  ├── imports: ast
  └── provides: TreeWalker, TraversalOrder classes

src/transaction/transaction.js
  ├── imports: (none - data structure)
  └── provides: Transaction context class
```

---

## Implementation Points for Free Text Blocks

### Current Syntax Support
```ox
// Strings (quoted)
[TextBox (content: "line1\nline2")]

// Arrays
[List (items: {"item1", "item2"})]

// Expressions  
[Box (width: (100 + 50))]
```

### Proposed Free Text Block Syntax
```ox
// Free text block with language identifier
[CodeBlock (source: ```javascript
  function hello() {
    return "world";
  }
```)]

// Free text block without language
[Documentation (text: ```
  This is raw text
  with preserved indentation
  and newlines
```)]

// Nested backticks in free text
[MdBlock (markdown: ```markdown
  # Heading
  
  Code example: ` inline code `
```)]
```

### Required Changes

**1. Tokenizer (tokenizer.js)**
```
Add:
- Token type: BACKTICK or FREETEXT_START
- Detection: Look for triple backtick (```)
- Content capture: Consume until closing triple backtick
- Indentation handling: Track base indentation level
- Newline preservation: Don't skip newlines in free text
```

**2. Parser (parser.js)**
```
Modify parseValue():
- Check for BACKTICK token
- Extract optional language identifier
- Create FreeTextBlockNode
- Handle indentation adjustment
```

**3. AST (ast.js)**
```
Add FreeTextBlockNode:
class FreeTextBlockNode extends ASTNode {
  constructor(content, language = null, location = null)
  - type: "FreeTextBlock"
  - content: string (raw text)
  - language: string | null (e.g., "javascript", "markdown")
  - location: location object
}
```

**4. Tests**
```
Add test cases:
- Simple free text block
- Free text with language identifier  
- Free text with indentation
- Free text with escaped characters
- Free text in nested properties
- Empty free text blocks
- Backticks within free text (escaped)
```

---

## Summary of Key Concepts

| Concept | Location | Purpose |
|---------|----------|---------|
| Tokenizer | lexer/tokenizer.js | Convert text → tokens |
| Parser | parser/parser.js | Convert tokens → AST |
| AST Nodes | parser/ast.js | Typed tree representation |
| Tags | preprocessor/tags.js | Component reuse system |
| Expressions | preprocessor/expressions.js | Dynamic value evaluation |
| References | preprocessor/references.js | $parent, $root shortcuts |
| Templates | preprocessor/templates.js | Control flow expansion |
| Tree Walker | walker/walker.js | AST traversal utilities |
| Errors | errors/errors.js | Error tracking & reporting |

Free text blocks require enhancements primarily in:
1. **Tokenizer** - Backtick detection & text capture
2. **Parser** - Free text value parsing
3. **AST** - FreeTextBlockNode definition
