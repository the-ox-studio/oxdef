# Free Text Blocks - Implementation Checklist (oxdef)

**Target Package:** `oxdef` (authoring-time toolchain)  
**Estimated Time:** 2 weeks  
**Status:** Not Started

---

## 📋 Implementation Tasks

### Phase 1: Lexer Changes

- [ ] **Add backtick delimiter detection**
  - Detect triple backtick sequences: ` ``` `
  - Support variable-length delimiters (4+, 5+, etc.)
  - Track opening delimiter length for matching
  
- [ ] **Raw text consumption**
  - Consume all characters between delimiters as literal text
  - Preserve all whitespace, newlines, and special characters
  - Match closing delimiter with same length as opening
  
- [ ] **Token generation**
  - Create `FREE_TEXT_START` token with delimiter length
  - Create `FREE_TEXT_CONTENT` token with raw text
  - Create `FREE_TEXT_END` token
  
- [ ] **Error detection**
  - Detect unclosed free text blocks (missing closing delimiter)
  - Detect mismatched delimiter lengths
  - Include line/column info in error messages

**Files to modify:**
- `src/lexer/tokenizer.js`

---

### Phase 2: Parser Changes

- [ ] **Add FREE_TEXT node type**
  - Create AST node structure with `type: "FREE_TEXT"`
  - Include `value` property for processed text
  - Include `tags` array for tag instances
  - Include `metadata` for source location
  
- [ ] **Parse free text blocks**
  - Recognize `FREE_TEXT_START` token
  - Consume `FREE_TEXT_CONTENT`
  - Match `FREE_TEXT_END` token
  - Add as child of current parent block
  
- [ ] **Tag association**
  - Support tag instances before free text: `#tag` ` ``` ... ``` `
  - Support tags with arguments: `#tag(arg)` ` ``` ... ``` `
  - Support multiple tags: `#tag1 #tag2` ` ``` ... ``` `
  - Store tags in `FREE_TEXT` node
  
- [ ] **Empty block handling**
  - Parse empty free text blocks: ` ``` ``` `
  - Create node with `value: ""`
  - Preserve in AST (don't skip)

**Files to modify:**
- `src/parser/parser.js`
- `src/ast/nodes.js` (add `FREE_TEXT` node type)

---

### Phase 3: Whitespace Processing

- [ ] **Implement dedent algorithm**
  - Trim leading newline from raw text
  - Trim trailing newline from raw text
  - Calculate minimum indentation across non-empty lines
  - Remove common indentation from all lines
  - Preserve relative indentation
  
- [ ] **Handle edge cases**
  - Empty lines (skip in min indent calculation)
  - Tabs vs spaces (convert tabs to spaces first)
  - Lines with only whitespace
  - Single-line free text blocks
  
- [ ] **Store processed value**
  - Apply dedent to raw text
  - Store result in `value` property
  - Preserve original raw text in metadata (optional, for debugging)

**Files to create/modify:**
- `src/preprocessor/whitespace.js` (new utility module)
- `src/parser/parser.js` (call whitespace processor)

---

### Phase 4: Block Merging

- [ ] **Detect adjacent free text blocks**
  - During tree construction phase
  - Check if current and previous child are both `FREE_TEXT`
  - Compare tags for merge eligibility
  
- [ ] **Merge logic**
  - Merge if both have no tags
  - Merge if both have identical tag arrays
  - Don't merge if tags differ
  - Join values with newline: `value1 + "\n\n" + value2`
  
- [ ] **Configuration option**
  - Add `mergeFreeText: true` to parser config
  - Allow users to disable merging: `mergeFreeText: false`
  - Document in API reference
  
- [ ] **Preserve metadata**
  - Keep line/column from first merged block
  - Track that block was merged (optional, for debugging)

**Files to modify:**
- `src/parser/parser.js` (tree construction phase)
- `src/config.js` (add configuration option)

---

### Phase 5: Tag Integration

- [ ] **Extend tag parsing**
  - Allow tags before free text blocks (already handled in Phase 2)
  - Validate tag syntax: `#tagName` or `#tagName(arg)`
  - Support multiple tags in sequence
  
- [ ] **Tag metadata**
  - Store tag names in `FREE_TEXT` node
  - Store tag arguments if present
  - Maintain tag order (important for multiple tags)
  
- [ ] **Tag handlers**
  - Call registered tag handlers during preprocessing
  - Pass `FREE_TEXT` blocks to handlers
  - Allow handlers to modify `value` or add properties
  - Document handler API for free text blocks

**Files to modify:**
- `src/parser/tags.js`
- `src/preprocessor/tags.js`

---

### Phase 6: Error Handling

- [ ] **Lexer errors**
  - Unclosed free text block: "Expected closing ` ``` ` but found EOF"
  - Mismatched delimiters: "Closing delimiter (4 backticks) doesn't match opening (3 backticks)"
  
- [ ] **Parser errors**
  - Unexpected free text end: "Found closing ` ``` ` without opening delimiter"
  - Invalid tag syntax before free text
  
- [ ] **Error messages**
  - Include file name, line, and column
  - Show snippet of problematic text
  - Suggest corrections when possible
  
- [ ] **Error recovery** (optional)
  - Attempt to continue parsing after error
  - Mark block as erroneous but include in AST

**Files to modify:**
- `src/errors/errors.js`
- `src/lexer/tokenizer.js`
- `src/parser/parser.js`

---

### Phase 7: Testing

- [ ] **Unit tests - Lexer**
  - Tokenize simple free text block
  - Tokenize empty free text block
  - Tokenize with 4+ backtick delimiters
  - Error on unclosed block
  - Error on mismatched delimiters
  
- [ ] **Unit tests - Parser**
  - Parse basic free text block
  - Parse free text with tags
  - Parse multiple tags on free text
  - Parse empty free text block
  - Parse mixed content (free text + regular blocks)
  
- [ ] **Unit tests - Whitespace**
  - Dedent with consistent indentation
  - Dedent with mixed indentation levels
  - Preserve relative indentation
  - Handle tabs vs spaces
  - Handle empty lines
  - Trim leading/trailing newlines
  
- [ ] **Unit tests - Merging**
  - Merge adjacent untagged blocks
  - Merge adjacent blocks with identical tags
  - Don't merge blocks with different tags
  - Respect `mergeFreeText: false` config
  - Join with double newline
  
- [ ] **Integration tests**
  - Complex document with mixed content
  - Real-world examples (login form, article, documentation)
  - Tag handlers processing free text
  - Expression evaluation in surrounding blocks (not in free text)
  
- [ ] **Edge case tests**
  - Free text as only child
  - Free text with no parent
  - Deeply nested free text
  - Very long free text (10k+ characters)
  - Special characters in free text (quotes, brackets, backticks)
  - Unicode content
  - Windows line endings (CRLF)

**Files to create:**
- `test/lexer/free-text.test.js`
- `test/parser/free-text.test.js`
- `test/preprocessor/whitespace.test.js`
- `test/preprocessor/free-text-merging.test.js`
- `test/integration/free-text.test.js`

---

### Phase 8: Documentation

- [ ] **Syntax specification**
  - Add "Free Text Blocks" section to `.ai/README.md`
  - Include syntax examples
  - Document whitespace processing rules
  - Document block merging behavior
  
- [ ] **Parser API**
  - Document `FREE_TEXT` node type in AST reference
  - Document `mergeFreeText` configuration option
  - Document tag integration with free text
  
- [ ] **Tag handler API**
  - Document how to handle `FREE_TEXT` blocks in tag handlers
  - Provide examples (markdown, HTML, code highlighting)
  - Explain `block.type === "FREE_TEXT"` check
  
- [ ] **Use cases & examples**
  - Add examples to documentation:
    - Documentation strings
    - Markdown content
    - HTML injection
    - Code examples
    - Localization strings
    - Mixed content forms
  
- [ ] **Migration guide** (optional)
  - When to use free text vs properties
  - Converting existing string properties
  - Performance considerations

**Files to update:**
- `.ai/README.md` (main specification)
- `docs/API.md` (API reference)
- `docs/EXAMPLES.md` (usage examples)
- `examples/free-text/` (new example directory)

---

### Phase 9: Examples

- [ ] **Create example files**
  - `examples/free-text/basic.ox` - Simple free text
  - `examples/free-text/markdown.ox` - Markdown content
  - `examples/free-text/html.ox` - HTML injection
  - `examples/free-text/code.ox` - Code blocks
  - `examples/free-text/mixed.ox` - Mixed content
  - `examples/free-text/form.ox` - Login form example
  
- [ ] **Create example handlers**
  - `examples/free-text/handlers/markdown.js` - Markdown to HTML
  - `examples/free-text/handlers/syntax-highlight.js` - Code highlighting
  - `examples/free-text/handlers/i18n.js` - Localization
  
- [ ] **Create build scripts**
  - `examples/free-text/build-html.js` - Generate HTML from free text
  - `examples/free-text/build-docs.js` - Generate documentation

**Files to create:**
- `examples/free-text/*.ox`
- `examples/free-text/handlers/*.js`
- `examples/free-text/build-*.js`

---

## 🎯 Success Criteria

- [ ] All unit tests passing (100% coverage on new code)
- [ ] All integration tests passing
- [ ] Documentation complete and accurate
- [ ] Examples working and clear
- [ ] No breaking changes to existing functionality
- [ ] Performance benchmarks show <5% regression
- [ ] Code review completed
- [ ] PR merged to main branch

---

## 📝 Implementation Notes

### Recommended Implementation Order

1. **Start with lexer** - Get tokenization working first
2. **Add parser support** - Build AST nodes
3. **Implement whitespace processing** - Get dedent algorithm right
4. **Add block merging** - Handle adjacent blocks
5. **Integrate with tags** - Connect to existing tag system
6. **Write tests** - Comprehensive coverage
7. **Add documentation** - Keep docs in sync
8. **Create examples** - Practical demonstrations

### Key Design Decisions

- **Block type:** `FREE_TEXT` (distinct from `USER_DEFINED`)
- **Delimiter:** Triple backticks (` ``` `), extensible to 4+
- **Whitespace:** Python's `textwrap.dedent()` algorithm
- **Merging:** Default ON, configurable via `mergeFreeText`
- **Tags:** Use existing tag system, no special handling needed
- **Nesting:** Not supported (free text is atomic)

### Performance Considerations

- Whitespace processing is O(n) where n = text length
- Block merging is O(m) where m = number of adjacent blocks
- Overall impact should be minimal (<5% parse time increase)
- Large free text blocks (1MB+) may need optimization

---

## 🚀 Next Steps After Implementation

1. **Runtime support** (optional, Phase 2)
   - Evaluate need for runtime parsing of free text
   - Consider performance impact on lightweight parsers
   - Implement as optional feature flag if beneficial

2. **Advanced features** (future enhancements)
   - Language hints: ` ```python ... ``` `
   - Interpolation: ` ```Hello ${name}``` ` (authoring time only)
   - Custom delimiters beyond backticks

3. **Tooling integration**
   - VS Code syntax highlighting for free text
   - Zed Tree-sitter grammar updates
   - LSP support for free text validation
   - Prettier/formatter support

---

**Questions or issues?** Open a GitHub issue or contact Luke.

**Ready to start?** Begin with Phase 1: Lexer Changes.
