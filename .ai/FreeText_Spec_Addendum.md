# Free Text Blocks - Syntax Specification Addendum

**For Integration into `.ai/README.md` - Syntax Specification Section**

---

## Free Text Blocks

Free text blocks provide a native way to express prose, documentation, and unstructured text content using triple-backtick syntax.

### Basic Syntax

```ox
[Document
  ```
  This is a paragraph with free text content.
  It can span multiple lines and preserves whitespace.
  ```
]
```

### Whitespace Processing

Free text blocks use Python's `textwrap.dedent()` algorithm:
- Leading/trailing newlines are trimmed
- Common indentation (minimum indent level) is removed from all lines
- Intentional relative indentation is preserved

**Example:**

```ox
[Code
  ```
  def hello():
      print("Hello")
  ```
]
```

The block's leading indentation is removed, but the `print` statement's indentation relative to `def` is preserved.

### With Tag Instances

Free text blocks can have tag instances to indicate semantic meaning:

```ox
[Article
  #markdown
  ```
  ## Heading
  
  Some **bold** text.
  ```
  
  #html
  ```
  <div class="custom">Raw HTML</div>
  ```
  
  #code(lang: "python")
  ```
  def factorial(n):
      return 1 if n <= 1 else n * factorial(n - 1)
  ```
]
```

Tags provide interpretation hints without prescribing specific behavior. Users define handlers for tags to control processing.

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

### Block Merging

Adjacent free text blocks with **identical tags** (or no tags) merge into a single block by default:

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

Blocks with **different tags** remain separate:

```ox
[Content
  #markdown
  ```
  # Heading
  ```
  
  #html
  ```
  <div>HTML</div>
  ```
]
// Two separate FREE_TEXT blocks
```

**Configuration:**

```javascript
oxparser.configure({
  mergeFreeText: true   // Default: merge adjacent identical/untagged blocks
});
```

### Escaping Backticks

Use four or more backticks to include triple backticks in content:

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

### AST Representation

```javascript
{
  type: "FREE_TEXT",
  value: "The processed text content",
  tags: ["markdown"],  // Optional
  metadata: {
    line: 10,
    column: 5,
    file: "document.ox"
  }
}
```

### Edge Cases

**Empty blocks:**
```ox
[Placeholder
  ```
  ```
]
// Creates: { type: "FREE_TEXT", value: "" }
```

**No nesting:**
Free text blocks cannot contain nested OX blocks. All content is treated as literal text.

---

## Integration with Tag System

### Tag Handler Example

```javascript
oxparser.defineTag("markdown", {
  block: {
    output: function(block) {
      if (block.type === "FREE_TEXT") {
        // Convert markdown to HTML during preprocessing
        block.htmlValue = convertMarkdownToHTML(block.value);
      }
    }
  }
});

oxparser.defineTag("code", {
  descriptor: {
    attributes: [
      { type: "identifier", required: true }  // Language parameter
    ]
  },
  block: {
    output: function(block) {
      if (block.type === "FREE_TEXT") {
        const lang = block.tags[0].argument;
        block.highlighted = applySyntaxHighlighting(block.value, lang);
      }
    }
  }
});
```

### Use Cases

**Documentation:**
```ox
#documentation
```
This component renders a login form with username and password fields.
Submits to the registration API endpoint.
```
```

**Localization:**
```ox
#i18n(key: "welcome_message", lang: "en")
```
Welcome to our application!
```
```

**HTML injection:**
```ox
#html
```
<script src="analytics.js"></script>
```
```

**Code examples:**
```ox
#example(lang: "javascript")
```
const result = await fetchData();
console.log(result);
```
```

---

## Implementation Status

**Phase 1: oxdef (Authoring Time)** - Pending Implementation
- Full parsing support for free text blocks
- Whitespace processing with dedent algorithm
- Tag association and multiple tag support
- Block merging with configuration option
- Comprehensive test coverage

**Phase 2: Runtime Libraries** - Optional Future Enhancement
- Consider adding to runtime parsers (C99, JavaScript, Haxe)
- Evaluate performance impact
- Add as optional feature flag if implemented

---

## Design Rationale

**Why triple backticks?**
- Familiar from Markdown (zero learning curve)
- Clearly signals literal content boundaries
- Rarely conflicts with prose content
- Easy to escape when needed

**Why a separate block type?**
- Clean separation: structure (`USER_DEFINED`) vs. content (`FREE_TEXT`)
- Enables specialized handling and optimization
- Better type safety in AST
- Clear distinction for tooling and editors

**Why tag-based interpretation?**
- Maintains OX's user-controlled interpretation philosophy
- No prescriptive behavior at parse time
- Flexible for different use cases (Markdown, HTML, code, i18n, etc.)
- Composable via multiple tags

**Why block merging?**
- Natural authoring: split prose for readability
- Semantic unity: adjacent paragraphs often form single unit
- Tag-aware: prevents unwanted merging of different content types
- Configurable: opt-out available

---

**Status:** Specification approved, ready for implementation in oxdef.
