# OX Language Roadmap Update: Free Text Blocks

**Document Version:** 1.0  
**Date:** November 14, 2025  
**Status:** Specification - Pending Implementation

---

## Overview

This document specifies the addition of **Free Text Blocks** to the OX data format. Free text blocks provide a native way to express prose, documentation, and unstructured text content within OX documents using triple-backtick syntax borrowed from Markdown.

---

## Motivation

Currently, OX lacks a native way to express free-form text content for blocks. While properties can contain string literals, there's no ergonomic way to include multi-line prose, documentation, or HTML/Markdown content that may contain special characters without extensive escaping.

Free text blocks solve this by:
- Providing a clear, familiar syntax for literal text content (triple backticks from Markdown)
- Treating text as first-class blocks in the AST rather than as properties
- Enabling semantic differentiation through tag instances
- Supporting flexible interpretation strategies via user-defined handlers

---

## Syntax Specification

### Basic Syntax

Free text blocks use triple backticks (` ``` `) as delimiters:

```ox
[Document
  ```
  This is a paragraph with free text content.
  ```
]
```

### With Tag Instances

Free text blocks can have tag instances to indicate how they should be interpreted:

```ox
[Document
  #markdown
  ```
  ## This is a heading
  
  Some **bold** text.
  ```
  
  #html
  ```
  <div class="custom">Raw HTML content</div>
  ```
  
  #plaintext
  ```
  Just plain text, no processing.
  ```
]
```

### Multiple Tags

Free text blocks can have multiple tags for composition:

```ox
[Article
  #markdown #syntax-highlight
  ```
  ```python
  def hello():
      print("Hello, world!")
  ```
  ```
]
```

### Mixed Content

Free text blocks can be interspersed with regular blocks:

```ox
[LoginForm (submit: "api/register", method: "post")
  ```
  Please login using the form below.
  ```

  #formInput(text) [Username (label: "Username")]
  #formInput(password) [Password (label: "Password")]

  #button [Submit (label: "Submit")]

  ```
  [Forgot your password?](/account/forgot-password/)

  [Create a New Account](/register/)
  ```
]
```

---

## AST Representation

### Block Type

Free text blocks are represented as a distinct block type in the AST:

```javascript
{
  type: "FREE_TEXT",
  value: "The text content after whitespace processing",
  tags: ["markdown"],  // Optional tag instances
  metadata: {
    line: 10,
    column: 5,
    file: "document.ox"
  }
}
```

### Comparison with User-Defined Blocks

```javascript
// Free text block
{
  type: "FREE_TEXT",
  value: "Please login using the form below.",
  tags: [],
  metadata: { ... }
}

// Regular user-defined block
{
  type: "USER_DEFINED",
  id: "formInput",
  tags: ["text"],
  properties: { label: "Username" },
  children: [
    { type: "USER_DEFINED", id: "Username", ... }
  ],
  metadata: { ... }
}
```

---

## Whitespace Processing

Free text blocks use **Python's `textwrap.dedent()`-style** processing:

1. **Leading/trailing newlines**: Trimmed
2. **Common indentation**: Removed based on the least-indented non-empty line
3. **Intentional indentation**: Preserved relative to the common indent level

### Example

**Input:**
```ox
[Document
  ```
  Line one
    Line two (indented)
  Line three
  ```
]
```

**Processed value:**
```
Line one
  Line two (indented)
Line three
```

The leading indentation (spaces before "Line one") is removed, but the relative indentation of "Line two" is preserved.

---

## Block Merging Behavior

### Adjacent Untagged Blocks

Adjacent free text blocks **with no tags** or **with identical tags** will merge into a single block by default:

**Input:**
```ox
[Content
  ```
  First paragraph.
  ```
  
  ```
  Second paragraph.
  ```
]
```

**Output (merged):**
```javascript
{
  type: "FREE_TEXT",
  value: "First paragraph.\n\nSecond paragraph."
}
```

### Blocks with Different Tags

Free text blocks with **different tags** remain separate:

**Input:**
```ox
[Content
  #markdown
  ```
  # Heading
  ```
  
  #html
  ```
  <div>Content</div>
  ```
]
```

**Output (not merged):**
```javascript
[
  { type: "FREE_TEXT", tags: ["markdown"], value: "# Heading" },
  { type: "FREE_TEXT", tags: ["html"], value: "<div>Content</div>" }
]
```

### Configuration Option

Users can control merging behavior via configuration:

```javascript
oxparser.configure({
  mergeFreeText: true,  // Default: merge adjacent untagged blocks
  // mergeFreeText: false  // Keep all free text blocks separate
});
```

---

## Edge Cases

### 1. Empty Free Text Blocks

Empty blocks are valid and create empty string values:

```ox
[Placeholder
  ```
  ```
]
```

**Result:**
```javascript
{ type: "FREE_TEXT", value: "" }
```

**Use case:** Placeholders that may be filled programmatically during interpretation.

### 2. Escaping Triple Backticks

If the content itself contains triple backticks, users can use **four or more backticks** as delimiters:

```ox
[CodeExample
  ````
  Here's some markdown:
  ```
  code block
  ```
  ````
]
```

The parser matches the opening delimiter count (4 backticks) with the closing delimiter.

### 3. Nested Blocks (Not Supported)

Free text blocks **cannot contain nested OX blocks**. They are atomic:

```ox
// ✗ Invalid - cannot nest blocks inside free text
[Document
  ```
  Some text
  [NestedBlock]  // This will be treated as literal text
  ```
]
```

The `[NestedBlock]` syntax appears as literal text within the free text block.

### 4. Adjacent Free Text with Intervening Content

If other blocks appear between free text blocks, they do **not** merge:

```ox
[Content
  ```
  First text
  ```
  
  [SomeBlock]
  
  ```
  Second text
  ```
]
```

**Result:** Two separate `FREE_TEXT` blocks with `SomeBlock` between them.

---

## Tag-Based Interpretation

### Purpose of Tags on Free Text

Tags provide **semantic hints** for how free text should be interpreted, without prescribing specific behavior at parse time. This aligns with OX's philosophy of user-controlled interpretation.

### Example Use Cases

**Markdown Processing:**
```ox
#markdown
```
## Features

- Feature 1
- Feature 2
```
```

**HTML Injection:**
```ox
#html
```
<script src="analytics.js"></script>
```
```

**Code Syntax Highlighting:**
```ox
#code(lang: "python")
```
def factorial(n):
    return 1 if n <= 1 else n * factorial(n - 1)
```
```

**Localization Keys:**
```ox
#i18n(key: "welcome_message")
```
Welcome to our application!
```
```

### Handler Registration

Users register handlers for specific tags:

```javascript
oxparser.defineTag("markdown", {
  block: {
    output: function(block) {
      if (block.type === "FREE_TEXT") {
        // Convert markdown to HTML
        block.htmlValue = markdownToHTML(block.value);
      }
    }
  }
});

oxparser.defineTag("code", {
  descriptor: {
    attributes: [
      { type: "identifier", required: true }  // lang parameter
    ]
  },
  block: {
    output: function(block) {
      const lang = block.tags[0].argument;
      block.highlighted = syntaxHighlight(block.value, lang);
    }
  }
});
```

---

## Implementation Phases

### Phase 1: Parser Support (oxdef - Authoring Time)

**Target:** Add free text block parsing to the `oxdef` package

**Tasks:**

1. **Lexer Changes**
   - Detect triple backtick sequences (` ``` `)
   - Support variable-length backtick delimiters (4+, 5+, etc.)
   - Track delimiter length for matching closing delimiter
   - Consume all characters between delimiters as raw text

2. **Parser Changes**
   - Add `FREE_TEXT` node type to AST
   - Parse free text blocks as children of parent blocks
   - Associate tags with free text blocks
   - Handle empty free text blocks (empty string)

3. **Whitespace Processing**
   - Implement `textwrap.dedent()` algorithm
   - Trim leading/trailing newlines
   - Calculate minimum indentation across non-empty lines
   - Remove common indentation from all lines

4. **Block Merging**
   - Detect adjacent free text blocks during tree construction
   - Merge blocks with identical tags (or no tags) by default
   - Add `mergeFreeText` configuration option
   - Preserve newlines between merged blocks

5. **Tag Integration**
   - Support tag instances (`#tag`) on free text blocks
   - Support tag instances with arguments (`#tag(arg)`)
   - Support multiple tags per free text block
   - Store tags in `FREE_TEXT` node metadata

6. **Error Handling**
   - Error on unclosed free text blocks
   - Error on mismatched delimiter lengths
   - Provide clear error messages with line/column info

7. **Tests**
   - Basic free text block parsing
   - Whitespace processing edge cases
   - Tag association with free text
   - Block merging with various tag combinations
   - Empty blocks
   - Escaped backticks (4+ delimiter)
   - Mixed content (free text + regular blocks)
   - Multi-line content preservation

**Deliverable:** Full support for free text blocks in `oxdef` with comprehensive test coverage.

**Estimated Time:** 2 weeks

---

### Phase 2: Runtime Support (Optional, Future)

**Target:** Add free text block support to runtime parsers (C99, JavaScript, Haxe, etc.)

**Rationale:** Runtime parsers currently handle **preprocessed** OX trees (post-evaluation). Free text blocks in runtime contexts would enable:
- Dynamic content generation
- Server-side template rendering
- Runtime documentation injection
- Streaming content from external sources

**Considerations:**

1. **Preprocessed vs. Runtime**
   - Most free text will be evaluated during preprocessing (authoring time)
   - Runtime support is optional for dynamic use cases
   - Adds parsing overhead to lightweight runtime libraries

2. **Performance Impact**
   - Runtime parsers optimized for speed (~3-5x faster than oxdef)
   - Adding free text parsing may reduce performance gains
   - Consider making it an optional feature flag

3. **Implementation Strategy**
   - Start with JavaScript runtime (easiest to test)
   - Port to C99 runtime (most complex)
   - Add to Haxe runtime (cross-platform benefits)
   - Document as optional feature in runtime libraries

**Tasks (if implemented):**

1. Add free text lexer/parser to each runtime
2. Implement whitespace processing in target language
3. Support tag metadata on free text blocks
4. Add configuration option to enable/disable
5. Update runtime documentation
6. Add runtime-specific tests

**Deliverable:** Optional free text support in runtime libraries.

**Estimated Time:** 1 week per runtime (3-4 weeks total)

---

## Documentation Updates Required

### 1. Syntax Specification

Update core syntax documentation to include:
- Free text block syntax with examples
- Tag usage on free text blocks
- Whitespace processing rules
- Block merging behavior

**File:** `.ai/README.md` (Syntax Specification section)

### 2. Parser API

Document new API elements:
- `FREE_TEXT` node type in AST
- `mergeFreeText` configuration option
- Tag integration with free text blocks

**File:** `.ai/README.md` (Parser API section)

### 3. Use Cases

Add free text block examples for:
- Documentation generation
- Markdown/HTML content
- Code examples with syntax highlighting
- Localization strings
- Mixed content forms

**File:** `.ai/README.md` (Use Cases section)

### 4. Migration Guide

Provide guidance for existing users:
- How to convert string properties to free text blocks
- When to use free text vs. properties
- Performance considerations

**File:** New file `docs/MIGRATION_FreeTextBlocks.md`

---

## Design Rationale

### Why Triple Backticks?

1. **Familiar syntax**: Universally recognized from Markdown code blocks
2. **Visual clarity**: Clearly signals literal content boundaries
3. **Minimal conflict**: Backticks rarely appear in natural prose
4. **Escapable**: Can use 4+ backticks for content containing triple backticks
5. **Consistent**: Aligns with existing developer conventions

### Why a Separate Block Type?

1. **Clean architecture**: Maintains separation between structure (`USER_DEFINED`) and content (`FREE_TEXT`)
2. **Flexible interpretation**: Users can handle free text differently than structured blocks
3. **Performance**: Parsers can optimize free text processing separately
4. **Type safety**: Clear distinction in AST enables better tooling

### Why Tag-Based Interpretation?

1. **Semantic flexibility**: Tags provide hints without enforcing behavior
2. **User control**: Interpretation happens at user's discretion (three-phase architecture)
3. **Composability**: Multiple tags enable complex processing pipelines
4. **Consistency**: Aligns with existing tag system (`@` definitions, `#` instances)

### Why Block Merging?

1. **Authoring convenience**: Natural to split prose across multiple blocks for readability
2. **Semantic unity**: Adjacent paragraphs often form a single logical unit
3. **Opt-out available**: Configuration option for users who need explicit boundaries
4. **Tag-aware**: Different tags prevent unwanted merging

---

## Breaking Changes

**None.** Free text blocks are additive and fully backward compatible:
- Existing OX documents continue to parse correctly
- No changes to existing block or property syntax
- New `FREE_TEXT` node type doesn't conflict with existing types
- Configuration option defaults to merging (new behavior), but can be disabled

---

## Future Enhancements

### 1. Language Hints (Like Markdown)

Support syntax like:

```ox
```python
def hello():
    print("Hello")
```
```

This could be parsed as:
```javascript
{
  type: "FREE_TEXT",
  language: "python",
  value: "def hello():\n    print(\"Hello\")"
}
```

### 2. Interpolation in Free Text

Allow expressions within free text blocks:

```ox
```
Hello, ${userName}! Your balance is ${formatCurrency(balance)}.
```
```

This would require:
- Expression parsing within free text
- Evaluation during preprocessing
- Escaping mechanism for literal `${...}`

**Note:** This should only exist in `oxdef` (authoring time), not in runtime parsers.

### 3. Advanced Escaping

Beyond 4+ backticks, consider:
- Custom delimiter characters
- Backslash escaping within free text
- Configurable escape sequences

---

## Conclusion

Free text blocks provide a powerful, ergonomic way to include prose and unstructured content in OX documents. The triple-backtick syntax is familiar, the tag-based interpretation aligns with OX's philosophy, and the implementation is straightforward.

**Next Steps:**

1. Review and approve this specification
2. Begin Phase 1 implementation in `oxdef`
3. Add comprehensive test coverage
4. Update documentation
5. Consider Phase 2 (runtime support) after evaluating use cases

---
