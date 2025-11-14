package ox

import "core:fmt"
import "core:mem"
import "core:strings"
import "core:strconv"
import "core:unicode/utf8"
import "core:reflect"
import "core:os"
import "base:intrinsics"
import "base:runtime"

// ============================================================================
// Core Data Structures
// ============================================================================

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

OXNodeVariant :: union {
    OXDocument,
    OXBlock,
    OXFreeText,
    OXTag,
}

OXDocument :: struct {
    blocks: [dynamic]^OXNode,
}

OXBlock :: struct {
    id: Maybe(string),           // Optional for anonymous blocks
    properties: map[string]OXProperty,
    children: [dynamic]^OXNode,
    tags: [dynamic]OXTag,
}

OXProperty :: union {
    string,
    f64,
    bool,
    OXNull,
    OXArray,
}

OXArray :: struct {
    elements: [dynamic]OXProperty,
}

OXNull :: struct {}

OXFreeText :: struct {
    content: string,
    tags: [dynamic]OXTag,
}

OXTag :: struct {
    type: OXTagType,
    name: string,
    argument: Maybe(string),
}

OXTagType :: enum {
    Declaration,  // @tag
    Instance,     // #tag
}

OXLocation :: struct {
    file: string,
    line: int,
    column: int,
}

// ============================================================================
// Token Types
// ============================================================================

TokenType :: enum {
    // Structural
    LBRACKET,      // [
    RBRACKET,      // ]
    LPAREN,        // (
    RPAREN,        // )

    // Literals
    IDENTIFIER,
    STRING,
    NUMBER,
    BOOLEAN,
    NULL,

    // Operators
    COLON,         // :
    COMMA,         // ,
    DOT,           // .
    DOLLAR,        // $

    // Tags
    AT,            // @
    HASH,          // #

    // Templates (not processed, but recognized)
    LT,            // <
    GT,            // >
    SLASH,         // /

    // Free text
    FREE_TEXT_CONTENT,

    // Special
    EOF,
}

Token :: struct {
    type: TokenType,
    value: string,
    location: OXLocation,
}

// ============================================================================
// Lexer/Tokenizer
// ============================================================================

Tokenizer :: struct {
    source: string,
    pos: int,
    line: int,
    column: int,
    file: string,
    tokens: [dynamic]Token,
}

tokenizer_init :: proc(source: string, file: string) -> Tokenizer {
    return Tokenizer{
        source = source,
        pos = 0,
        line = 1,
        column = 1,
        file = file,
        tokens = make([dynamic]Token),
    }
}

tokenizer_destroy :: proc(t: ^Tokenizer) {
    delete(t.tokens)
}

tokenize :: proc(t: ^Tokenizer) -> (tokens: []Token, ok: bool) {
    for !is_at_end(t) {
        skip_whitespace_and_comments(t)
        if is_at_end(t) do break

        token := scan_token(t) or_return
        append(&t.tokens, token)
    }

    append(&t.tokens, Token{
        type = .EOF,
        value = "",
        location = get_location(t),
    })

    return t.tokens[:], true
}

is_at_end :: proc(t: ^Tokenizer) -> bool {
    return t.pos >= len(t.source)
}

current :: proc(t: ^Tokenizer) -> rune {
    if is_at_end(t) do return 0
    r, _ := utf8.decode_rune_in_string(t.source[t.pos:])
    return r
}

peek :: proc(t: ^Tokenizer, offset: int = 1) -> rune {
    pos := t.pos
    for i := 0; i < offset; i += 1 {
        if pos >= len(t.source) do return 0
        _, size := utf8.decode_rune_in_string(t.source[pos:])
        pos += size
    }
    if pos >= len(t.source) do return 0
    r, _ := utf8.decode_rune_in_string(t.source[pos:])
    return r
}

advance :: proc(t: ^Tokenizer) -> rune {
    r := current(t)
    if r == 0 do return 0

    _, size := utf8.decode_rune_in_string(t.source[t.pos:])
    t.pos += size

    if r == '\n' {
        t.line += 1
        t.column = 1
    } else {
        t.column += 1
    }

    return r
}

get_location :: proc(t: ^Tokenizer) -> OXLocation {
    return OXLocation{
        file = t.file,
        line = t.line,
        column = t.column,
    }
}

skip_whitespace_and_comments :: proc(t: ^Tokenizer) {
    for !is_at_end(t) {
        r := current(t)

        switch r {
        case ' ', '\t', '\r', '\n':
            advance(t)

        case '/':
            if peek(t) == '/' {
                // Line comment
                for !is_at_end(t) && current(t) != '\n' {
                    advance(t)
                }
            } else if peek(t) == '*' {
                // Block comment
                advance(t) // /
                advance(t) // *
                for !is_at_end(t) {
                    if current(t) == '*' && peek(t) == '/' {
                        advance(t) // *
                        advance(t) // /
                        break
                    }
                    advance(t)
                }
            } else {
                return
            }

        case:
            return
        }
    }
}

scan_token :: proc(t: ^Tokenizer) -> (token: Token, ok: bool) {
    location := get_location(t)
    r := current(t)

    switch r {
    case '[':
        advance(t)
        return Token{type = .LBRACKET, value = "[", location = location}, true

    case ']':
        advance(t)
        return Token{type = .RBRACKET, value = "]", location = location}, true

    case '(':
        advance(t)
        return Token{type = .LPAREN, value = "(", location = location}, true

    case ')':
        advance(t)
        return Token{type = .RPAREN, value = ")", location = location}, true

    case ':':
        advance(t)
        return Token{type = .COLON, value = ":", location = location}, true

    case ',':
        advance(t)
        return Token{type = .COMMA, value = ",", location = location}, true

    case '.':
        advance(t)
        return Token{type = .DOT, value = ".", location = location}, true

    case '$':
        advance(t)
        return Token{type = .DOLLAR, value = "$", location = location}, true

    case '@':
        advance(t)
        return Token{type = .AT, value = "@", location = location}, true

    case '#':
        advance(t)
        return Token{type = .HASH, value = "#", location = location}, true

    case '<':
        advance(t)
        return Token{type = .LT, value = "<", location = location}, true

    case '>':
        advance(t)
        return Token{type = .GT, value = ">", location = location}, true

    case '/':
        advance(t)
        return Token{type = .SLASH, value = "/", location = location}, true

    case '"':
        return scan_string(t, location)

    case '`':
        // Check for free text block (triple backticks)
        if peek(t, 1) == '`' && peek(t, 2) == '`' {
            return scan_free_text(t, location)
        }
        // Single backtick not supported
        fmt.eprintln("Error: Single backtick not supported")
        return {}, false

    case:
        if is_digit(r) || (r == '-' && is_digit(peek(t))) {
            return scan_number(t, location)
        }

        if is_alpha(r) || r == '_' {
            return scan_identifier(t, location)
        }

        fmt.eprintf("Unexpected character: %c\n", r)
        return {}, false
    }
}

scan_string :: proc(t: ^Tokenizer, location: OXLocation) -> (token: Token, ok: bool) {
    advance(t) // opening "

    start := t.pos
    for !is_at_end(t) && current(t) != '"' {
        if current(t) == '\\' {
            advance(t)
            if !is_at_end(t) {
                advance(t)
            }
        } else {
            advance(t)
        }
    }

    if is_at_end(t) {
        fmt.eprintln("Unterminated string")
        return {}, false
    }

    value := t.source[start:t.pos]
    advance(t) // closing "

    // Process escape sequences
    processed := process_escape_sequences(value)

    return Token{type = .STRING, value = processed, location = location}, true
}

process_escape_sequences :: proc(s: string) -> string {
    // Simple escape sequence processing
    result := strings.builder_make()
    defer strings.builder_destroy(&result)

    i := 0
    for i < len(s) {
        if s[i] == '\\' && i + 1 < len(s) {
            i += 1
            switch s[i] {
            case 'n':
                strings.write_rune(&result, '\n')
            case 't':
                strings.write_rune(&result, '\t')
            case 'r':
                strings.write_rune(&result, '\r')
            case '\\':
                strings.write_rune(&result, '\\')
            case '"':
                strings.write_rune(&result, '"')
            case:
                strings.write_rune(&result, rune(s[i]))
            }
            i += 1
        } else {
            strings.write_rune(&result, rune(s[i]))
            i += 1
        }
    }

    return strings.clone(strings.to_string(result))
}

scan_number :: proc(t: ^Tokenizer, location: OXLocation) -> (token: Token, ok: bool) {
    start := t.pos

    if current(t) == '-' {
        advance(t)
    }

    for is_digit(current(t)) {
        advance(t)
    }

    if current(t) == '.' && is_digit(peek(t)) {
        advance(t) // .
        for is_digit(current(t)) {
            advance(t)
        }
    }

    value := t.source[start:t.pos]
    return Token{type = .NUMBER, value = value, location = location}, true
}

scan_identifier :: proc(t: ^Tokenizer, location: OXLocation) -> (token: Token, ok: bool) {
    start := t.pos

    for is_alpha_numeric(current(t)) || current(t) == '_' || current(t) == '-' {
        advance(t)
    }

    value := t.source[start:t.pos]

    // Check for keywords
    type := TokenType.IDENTIFIER
    switch value {
    case "true", "false":
        type = .BOOLEAN
    case "null":
        type = .NULL
    }

    return Token{type = type, value = value, location = location}, true
}

scan_free_text :: proc(t: ^Tokenizer, location: OXLocation) -> (token: Token, ok: bool) {
    // Count opening backticks
    delimiter_count := 0
    for !is_at_end(t) && current(t) == '`' {
        delimiter_count += 1
        advance(t)
    }

    if delimiter_count < 3 {
        fmt.eprintln("Free text blocks require at least 3 backticks")
        return {}, false
    }

    // Read content until we find matching closing backticks
    start := t.pos

    for !is_at_end(t) {
        if current(t) == '`' {
            // Count consecutive backticks
            count := 0
            saved_pos := t.pos
            saved_line := t.line
            saved_column := t.column

            for !is_at_end(t) && current(t) == '`' {
                count += 1
                advance(t)
            }

            if count == delimiter_count {
                // Found matching closing delimiter
                content := t.source[start:saved_pos]
                return Token{type = .FREE_TEXT_CONTENT, value = content, location = location}, true
            }

            // Not enough backticks, continue
        } else {
            advance(t)
        }
    }

    fmt.eprintln("Unterminated free text block")
    return {}, false
}

is_digit :: proc(r: rune) -> bool {
    return r >= '0' && r <= '9'
}

is_alpha :: proc(r: rune) -> bool {
    return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
}

is_alpha_numeric :: proc(r: rune) -> bool {
    return is_alpha(r) || is_digit(r)
}

// ============================================================================
// Parser
// ============================================================================

Parser :: struct {
    tokens: []Token,
    pos: int,
}

parser_init :: proc(tokens: []Token) -> Parser {
    return Parser{
        tokens = tokens,
        pos = 0,
    }
}

parse :: proc(p: ^Parser) -> (doc: ^OXNode, ok: bool) {
    blocks := make([dynamic]^OXNode)

    for !parser_is_at_end(p) {
        if parser_check(p, .EOF) do break

        if parser_check(p, .LBRACKET) || parser_check(p, .AT) || parser_check(p, .HASH) {
            block := parse_block(p) or_return
            append(&blocks, block)
        } else {
            fmt.eprintln("Unexpected token at document level")
            return nil, false
        }
    }

    doc_node := new(OXNode)
    doc_node.type = .Document
    doc_node.variant = OXDocument{blocks = blocks}
    doc_node.location = OXLocation{file = "<input>", line = 1, column = 1}

    return doc_node, true
}

parse_block :: proc(p: ^Parser) -> (node: ^OXNode, ok: bool) {
    // Parse tags
    tags := make([dynamic]OXTag)
    for parser_check(p, .AT) || parser_check(p, .HASH) {
        tag := parse_tag(p) or_return
        append(&tags, tag)
    }

    location := parser_current(p).location

    parser_expect(p, .LBRACKET) or_return

    // Parse optional identifier
    id: Maybe(string) = nil
    if parser_check(p, .IDENTIFIER) {
        id_token := parser_advance(p)
        id = id_token.value
    }

    // Parse properties
    properties := make(map[string]OXProperty)
    if parser_check(p, .LPAREN) {
        properties = parse_properties(p) or_return
    }

    // Parse children
    children := make([dynamic]^OXNode)
    for !parser_check(p, .RBRACKET) && !parser_is_at_end(p) {
        if parser_check(p, .LBRACKET) || parser_check(p, .AT) || parser_check(p, .HASH) {
            child := parse_block(p) or_return
            append(&children, child)
        } else if parser_check(p, .FREE_TEXT_CONTENT) {
            free_text := parse_free_text(p, tags) or_return
            append(&children, free_text)
        } else {
            fmt.eprintln("Unexpected token in block body")
            return nil, false
        }
    }

    parser_expect(p, .RBRACKET) or_return

    block_node := new(OXNode)
    block_node.type = .Block
    block_node.variant = OXBlock{
        id = id,
        properties = properties,
        children = children,
        tags = tags,
    }
    block_node.location = location

    return block_node, true
}

parse_tag :: proc(p: ^Parser) -> (tag: OXTag, ok: bool) {
    tag_type := OXTagType.Declaration

    if parser_check(p, .AT) {
        parser_advance(p)
        tag_type = .Declaration
    } else if parser_check(p, .HASH) {
        parser_advance(p)
        tag_type = .Instance
    } else {
        fmt.eprintln("Expected @ or #")
        return {}, false
    }

    name_token := parser_expect(p, .IDENTIFIER) or_return

    // Parse optional argument
    argument: Maybe(string) = nil
    if parser_check(p, .LPAREN) {
        parser_advance(p)
        arg_token := parser_expect(p, .IDENTIFIER) or_return
        argument = arg_token.value
        parser_expect(p, .RPAREN) or_return
    }

    return OXTag{
        type = tag_type,
        name = name_token.value,
        argument = argument,
    }, true
}

parse_properties :: proc(p: ^Parser) -> (props: map[string]OXProperty, ok: bool) {
    parser_expect(p, .LPAREN) or_return

    props = make(map[string]OXProperty)

    for !parser_check(p, .RPAREN) && !parser_is_at_end(p) {
        // Parse key
        key_token := parser_expect(p, .IDENTIFIER) or_return
        parser_expect(p, .COLON) or_return

        // Parse value
        value := parse_value(p) or_return
        props[key_token.value] = value

        if parser_check(p, .COMMA) {
            parser_advance(p)
        }
    }

    parser_expect(p, .RPAREN) or_return

    return props, true
}

parse_value :: proc(p: ^Parser) -> (value: OXProperty, ok: bool) {
    token := parser_current(p)

    #partial switch token.type {
    case .STRING:
        parser_advance(p)
        return token.value, true

    case .NUMBER:
        parser_advance(p)
        num, parse_ok := strconv.parse_f64(token.value)
        if !parse_ok {
            fmt.eprintln("Invalid number")
            return nil, false
        }
        return num, true

    case .BOOLEAN:
        parser_advance(p)
        return token.value == "true", true

    case .NULL:
        parser_advance(p)
        return OXNull{}, true

    case .LBRACKET:
        // Array literal
        return parse_array(p)

    case:
        fmt.eprintf("Unexpected value token: %v\n", token.type)
        return nil, false
    }
}

parse_array :: proc(p: ^Parser) -> (arr: OXProperty, ok: bool) {
    parser_expect(p, .LBRACKET) or_return

    elements := make([dynamic]OXProperty)

    for !parser_check(p, .RBRACKET) && !parser_is_at_end(p) {
        value := parse_value(p) or_return
        append(&elements, value)

        if parser_check(p, .COMMA) {
            parser_advance(p)
        }
    }

    parser_expect(p, .RBRACKET) or_return

    return OXArray{elements = elements}, true
}

parse_free_text :: proc(p: ^Parser, tags: [dynamic]OXTag) -> (node: ^OXNode, ok: bool) {
    token := parser_expect(p, .FREE_TEXT_CONTENT) or_return

    free_text_node := new(OXNode)
    free_text_node.type = .FreeText
    free_text_node.variant = OXFreeText{
        content = dedent(token.value),
        tags = tags,
    }
    free_text_node.location = token.location

    return free_text_node, true
}

// Dedent implementation (similar to Python's textwrap.dedent)
dedent :: proc(text: string) -> string {
    // TODO: Implement proper dedent algorithm
    // For now, just trim leading/trailing whitespace
    return strings.trim_space(text)
}

parser_is_at_end :: proc(p: ^Parser) -> bool {
    return p.pos >= len(p.tokens)
}

parser_current :: proc(p: ^Parser) -> Token {
    if parser_is_at_end(p) {
        return p.tokens[len(p.tokens) - 1]
    }
    return p.tokens[p.pos]
}

parser_check :: proc(p: ^Parser, type: TokenType) -> bool {
    if parser_is_at_end(p) do return false
    return parser_current(p).type == type
}

parser_advance :: proc(p: ^Parser) -> Token {
    if !parser_is_at_end(p) {
        p.pos += 1
    }
    return p.tokens[p.pos - 1]
}

parser_expect :: proc(p: ^Parser, type: TokenType) -> (token: Token, ok: bool) {
    if !parser_check(p, type) {
        fmt.eprintf("Expected %v but got %v\n", type, parser_current(p).type)
        return {}, false
    }
    return parser_advance(p), true
}

// ============================================================================
// Public API - File Parsing
// ============================================================================

parse_file :: proc(path: string, allocator := context.allocator) -> (doc: ^OXNode, ok: bool) {
    context.allocator = allocator

    // Read file contents
    data, read_ok := os.read_entire_file(path, allocator)
    if !read_ok {
        fmt.eprintf("Failed to read file: %s\n", path)
        return nil, false
    }
    defer delete(data, allocator)

    source := string(data)

    // Tokenize
    tokenizer := tokenizer_init(source, path)
    defer tokenizer_destroy(&tokenizer)

    tokens := tokenize(&tokenizer) or_return

    // Parse
    parser := parser_init(tokens)
    doc = parse(&parser) or_return

    return doc, true
}

parse_string :: proc(source: string, filename := "<input>", allocator := context.allocator) -> (doc: ^OXNode, ok: bool) {
    context.allocator = allocator

    // Tokenize
    tokenizer := tokenizer_init(source, filename)
    defer tokenizer_destroy(&tokenizer)

    tokens := tokenize(&tokenizer) or_return

    // Parse
    parser := parser_init(tokens)
    doc = parse(&parser) or_return

    return doc, true
}

// ============================================================================
// Tree Walking
// ============================================================================

WalkFunc :: #type proc(node: ^OXNode, parent: ^OXNode, user_data: rawptr)

parse_walk :: proc(node: ^OXNode, walk_func: WalkFunc, user_data: rawptr = nil, parent: ^OXNode = nil) {
    walk_func(node, parent, user_data)

    switch &v in node.variant {
    case OXDocument:
        for child in v.blocks {
            parse_walk(child, walk_func, user_data, node)
        }

    case OXBlock:
        for child in v.children {
            parse_walk(child, walk_func, user_data, node)
        }

    case OXFreeText:
        // Leaf node, no children to walk

    case OXTag:
        // Leaf node (though tags are embedded in blocks/free text)
    }
}

// ============================================================================
// Tag Registry System
// ============================================================================

TagHandler :: #type proc(node: ^OXNode, tag: OXTag, user_data: rawptr) -> TagResult

TagResult :: union {
    string,
    ^OXNode,
    bool,
    f64,
    TagError,
}

TagError :: struct {
    message: string,
}

TagRegistry :: struct {
    handlers: map[string]TagHandler,
    user_data: rawptr,
}

tag_registry_init :: proc(allocator := context.allocator) -> TagRegistry {
    context.allocator = allocator
    return TagRegistry{
        handlers = make(map[string]TagHandler, allocator = allocator),
        user_data = nil,
    }
}

tag_registry_destroy :: proc(registry: ^TagRegistry) {
    delete(registry.handlers)
}

tag_registry_register :: proc(registry: ^TagRegistry, tag_name: string, handler: TagHandler) {
    registry.handlers[tag_name] = handler
}

tag_registry_handle :: proc(registry: ^TagRegistry, node: ^OXNode, tag: OXTag) -> (result: TagResult, ok: bool) {
    handler, found := registry.handlers[tag.name]
    if !found {
        return TagError{message = fmt.tprintf("No handler registered for tag: %s", tag.name)}, false
    }

    result = handler(node, tag, registry.user_data)

    // Check if result is an error
    if error, is_error := result.(TagError); is_error {
        return error, false
    }

    return result, true
}

// ============================================================================
// Type Mapping System
// ============================================================================

// Converts a block ID to snake_case field name
block_id_to_field_name :: proc(id: string, allocator := context.allocator) -> string {
    context.allocator = allocator

    builder := strings.builder_make(allocator)
    defer strings.builder_destroy(&builder)

    for r, i in id {
        if r >= 'A' && r <= 'Z' {
            // Insert underscore before uppercase (except at start)
            if i > 0 {
                strings.write_rune(&builder, '_')
            }
            strings.write_rune(&builder, r + ('a' - 'A'))
        } else if r == '-' {
            strings.write_rune(&builder, '_')
        } else {
            strings.write_rune(&builder, r)
        }
    }

    return strings.clone(strings.to_string(builder))
}

// Maps an OX document to a typed struct
parse_map :: proc(doc: ^OXNode, $T: typeid, allocator := context.allocator) -> (result: T, ok: bool)
    where intrinsics.type_is_struct(T) {

    context.allocator = allocator

    doc_variant, doc_ok := doc.variant.(OXDocument)
    if !doc_ok {
        fmt.eprintln("Expected document node")
        return {}, false
    }

    result = {}

    // Use reflection to map blocks to struct fields
    type_info := type_info_of(T)
    base_info := reflect.type_info_base(type_info)
    struct_info, is_struct := base_info.variant.(reflect.Type_Info_Struct)
    if !is_struct {
        fmt.eprintln("Target type must be a struct")
        return {}, false
    }

    // Map each block to corresponding struct field
    for block_node in doc_variant.blocks {
        block, block_ok := block_node.variant.(OXBlock)
        if !block_ok do continue

        // Get block ID (skip anonymous blocks at document level)
        block_id, has_id := block.id.?
        if !has_id do continue

        // Convert block ID to field name
        field_name := block_id_to_field_name(block_id, allocator)
        defer delete(field_name, allocator)

        // Find matching field in struct
        for i in 0..<struct_info.field_count {
            if struct_info.names[i] == field_name {
                // Map block to field
                field_type := struct_info.types[i]
                field_offset := struct_info.offsets[i]

                // Get pointer to field
                result_ptr := rawptr(&result)
                field_ptr := rawptr(uintptr(result_ptr) + field_offset)

                // Map based on field type
                map_block_to_field(block_node, field_ptr, field_type, allocator) or_return
                break
            }
        }
    }

    return result, true
}

// Maps a block to a struct field
map_block_to_field :: proc(block_node: ^OXNode, field_ptr: rawptr, field_type: ^reflect.Type_Info, allocator := context.allocator) -> bool {
    context.allocator = allocator

    block, block_ok := block_node.variant.(OXBlock)
    if !block_ok {
        fmt.eprintln("Expected block node")
        return false
    }

    // Handle different field types
    #partial switch &info in field_type.variant {
    case reflect.Type_Info_Named:
        // Unwrap named type
        return map_block_to_field(block_node, field_ptr, info.base, allocator)

    case reflect.Type_Info_Struct:
        // Map block properties and children to struct fields
        return map_block_to_struct(block, field_ptr, &info, allocator)

    case reflect.Type_Info_Dynamic_Array:
        // Handle children: [dynamic]T
        return map_children_to_array(block, field_ptr, &info, allocator)

    case reflect.Type_Info_String:
        // Handle free_text field
        if len(block.children) > 0 {
            if free_text_node, is_free_text := block.children[0].variant.(OXFreeText); is_free_text {
                str_ptr := cast(^string)field_ptr
                str_ptr^ = strings.clone(free_text_node.content, allocator)
                return true
            }
        }
        return true

    case:
        fmt.eprintf("Unsupported field type: %v\n", field_type)
        return false
    }
}

// Maps a block to a struct
map_block_to_struct :: proc(block: OXBlock, struct_ptr: rawptr, struct_info: ^reflect.Type_Info_Struct, allocator := context.allocator) -> bool {
    context.allocator = allocator

    // Map properties to primitive fields
    for i in 0..<struct_info.field_count {
        field_name := struct_info.names[i]
        field_type := struct_info.types[i]
        field_offset := struct_info.offsets[i]
        field_ptr := rawptr(uintptr(struct_ptr) + field_offset)

        // Check if this is a special field
        if field_name == "children" {
            // Map children array
            if len(block.children) > 0 {
                map_children_to_array_field(block, field_ptr, field_type, allocator) or_return
            }
            continue
        }

        if field_name == "free_text" {
            // Map free text content
            if len(block.children) > 0 {
                if free_text_node, is_free_text := block.children[0].variant.(OXFreeText); is_free_text {
                    if _, is_str := field_type.variant.(reflect.Type_Info_String); is_str {
                        str_ptr := cast(^string)field_ptr
                        str_ptr^ = strings.clone(free_text_node.content, allocator)
                    }
                }
            }
            continue
        }

        // Map from properties
        if field_name in block.properties {
            prop := block.properties[field_name]
            map_property_to_field(prop, field_ptr, field_type, allocator) or_return
            continue
        }

        // Map from child blocks
        for child_node in block.children {
            if child_block, is_block := child_node.variant.(OXBlock); is_block {
                if child_id, has_id := child_block.id.?; has_id {
                    child_field_name := block_id_to_field_name(child_id, allocator)
                    defer delete(child_field_name, allocator)

                    if child_field_name == field_name {
                        map_block_to_field(child_node, field_ptr, field_type, allocator) or_return
                        break
                    }
                }
            }
        }
    }

    return true
}

// Maps OX property to struct field
map_property_to_field :: proc(prop: OXProperty, field_ptr: rawptr, field_type: ^reflect.Type_Info, allocator := context.allocator) -> bool {
    context.allocator = allocator

    #partial switch &info in field_type.variant {
    case reflect.Type_Info_Named:
        return map_property_to_field(prop, field_ptr, info.base, allocator)

    case reflect.Type_Info_String:
        if str, is_str := prop.(string); is_str {
            str_ptr := cast(^string)field_ptr
            str_ptr^ = strings.clone(str, allocator)
            return true
        }

    case reflect.Type_Info_Float:
        if num, is_num := prop.(f64); is_num {
            float_ptr := cast(^f64)field_ptr
            float_ptr^ = num
            return true
        }

    case reflect.Type_Info_Boolean:
        if b, is_bool := prop.(bool); is_bool {
            bool_ptr := cast(^bool)field_ptr
            bool_ptr^ = b
            return true
        }

    case reflect.Type_Info_Dynamic_Array:
        if arr, is_arr := prop.(OXArray); is_arr {
            return map_ox_array_to_field(arr, field_ptr, &info, allocator)
        }

    case:
        fmt.eprintf("Unsupported property type mapping: %v\n", field_type)
        return false
    }

    return true
}

// Maps children to [dynamic]T field
map_children_to_array :: proc(block: OXBlock, field_ptr: rawptr, array_info: ^reflect.Type_Info_Dynamic_Array, allocator := context.allocator) -> bool {
    context.allocator = allocator

    elem_type := array_info.elem

    // Create dynamic array
    array_ptr := cast(^mem.Raw_Dynamic_Array)field_ptr
    array_ptr.allocator = allocator

    // Map each child to array element
    for child_node in block.children {
        if child_block, is_block := child_node.variant.(OXBlock); is_block {
            // Allocate element
            elem_ptr, alloc_err := mem.alloc(elem_type.size, elem_type.align, allocator)
            if alloc_err != nil {
                fmt.eprintln("Failed to allocate array element")
                return false
            }

            // Map block to element
            map_block_to_field(child_node, elem_ptr, elem_type, allocator) or_return

            // Append to array using runtime package
            runtime_append_raw_dynamic_array(array_ptr, elem_ptr, elem_type.size, elem_type.align, allocator)
        }
    }

    return true
}

// Helper for mapping children to a field
map_children_to_array_field :: proc(block: OXBlock, field_ptr: rawptr, field_type: ^reflect.Type_Info, allocator := context.allocator) -> bool {
    if array_info, is_array := field_type.variant.(reflect.Type_Info_Dynamic_Array); is_array {
        return map_children_to_array(block, field_ptr, &array_info, allocator)
    }
    return false
}

// Maps OXArray to [dynamic]T
map_ox_array_to_field :: proc(ox_arr: OXArray, field_ptr: rawptr, array_info: ^reflect.Type_Info_Dynamic_Array, allocator := context.allocator) -> bool {
    context.allocator = allocator

    elem_type := array_info.elem

    // Create dynamic array
    array_ptr := cast(^mem.Raw_Dynamic_Array)field_ptr
    array_ptr.allocator = allocator

    for elem in ox_arr.elements {
        // Allocate element
        elem_ptr, alloc_err := mem.alloc(elem_type.size, elem_type.align, allocator)
        if alloc_err != nil {
            fmt.eprintln("Failed to allocate array element")
            return false
        }

        // Map property to element
        map_property_to_field(elem, elem_ptr, elem_type, allocator) or_return

        // Append to array using runtime package
        runtime_append_raw_dynamic_array(array_ptr, elem_ptr, elem_type.size, elem_type.align, allocator)
    }

    return true
}

// Helper to append to raw dynamic array (since mem.raw_dynamic_array_append doesn't exist)
runtime_append_raw_dynamic_array :: proc(array: ^mem.Raw_Dynamic_Array, item: rawptr, item_size: int, item_align: int, allocator: mem.Allocator) {
    if array.len >= array.cap {
        new_cap := max(8, array.cap * 2)
        new_data := mem.alloc(new_cap * item_size, item_align, allocator) or_else nil
        if new_data != nil {
            if array.data != nil {
                mem.copy(new_data, array.data, array.len * item_size)
                mem.free(array.data, allocator)
            }
            array.data = new_data
            array.cap = new_cap
        }
    }

    if array.len < array.cap {
        dest := rawptr(uintptr(array.data) + uintptr(array.len * item_size))
        mem.copy(dest, item, item_size)
        array.len += 1
    }
}

// ============================================================================
// Interpreter Integration
// ============================================================================

Interpreter :: struct {
    tag_registry: TagRegistry,
}

interp_init :: proc(allocator := context.allocator) -> Interpreter {
    return Interpreter{
        tag_registry = tag_registry_init(allocator),
    }
}

interp_destroy :: proc(interp: ^Interpreter) {
    tag_registry_destroy(&interp.tag_registry)
}

interp_register_tag :: proc(interp: ^Interpreter, tag_name: string, handler: TagHandler) {
    tag_registry_register(&interp.tag_registry, tag_name, handler)
}

// Parse and map with tag processing
parse_map_with_interp :: proc(
    doc: ^OXNode,
    $T: typeid,
    interp: ^Interpreter,
    allocator := context.allocator,
) -> (result: T, ok: bool)
    where intrinsics.type_is_struct(T) {

    context.allocator = allocator

    // First, process all tag instances
    process_tags_in_tree(doc, &interp.tag_registry) or_return

    // Then perform type mapping
    return parse_map(doc, T, allocator)
}

// Process all tag instances in the tree
process_tags_in_tree :: proc(node: ^OXNode, registry: ^TagRegistry) -> bool {
    switch &v in node.variant {
    case OXDocument:
        for child in v.blocks {
            process_tags_in_tree(child, registry) or_return
        }

    case OXBlock:
        // Process instance tags (#tag)
        for tag in v.tags {
            if tag.type == .Instance {
                tag_registry_handle(registry, node, tag) or_return
            }
        }

        // Process children
        for child in v.children {
            process_tags_in_tree(child, registry) or_return
        }

    case OXFreeText:
        // Process instance tags on free text
        for tag in v.tags {
            if tag.type == .Instance {
                tag_registry_handle(registry, node, tag) or_return
            }
        }

    case OXTag:
        // Tags are embedded, not standalone
    }

    return true
}

// ============================================================================
// Utility Functions
// ============================================================================

// Debug print OX tree
print_tree :: proc(node: ^OXNode, indent := 0) {
    for i in 0..<indent {
        fmt.print("  ")
    }

    switch v in node.variant {
    case OXDocument:
        fmt.println("Document:")
        for child in v.blocks {
            print_tree(child, indent + 1)
        }

    case OXBlock:
        if id, has_id := v.id.?; has_id {
            fmt.printf("Block[%s]:\n", id)
        } else {
            fmt.println("Block[anonymous]:")
        }

        if len(v.tags) > 0 {
            for i in 0..<indent+1 {
                fmt.print("  ")
            }
            fmt.print("Tags: ")
            for tag, i in v.tags {
                if i > 0 do fmt.print(", ")
                fmt.printf("%s%s", tag.type == .Declaration ? "@" : "#", tag.name)
            }
            fmt.println()
        }

        if len(v.properties) > 0 {
            for i in 0..<indent+1 {
                fmt.print("  ")
            }
            fmt.println("Properties:")
            for key, value in v.properties {
                for i in 0..<indent+2 {
                    fmt.print("  ")
                }
                fmt.printf("%s: %v\n", key, value)
            }
        }

        for child in v.children {
            print_tree(child, indent + 1)
        }

    case OXFreeText:
        fmt.printf("FreeText: %q\n", v.content[:min(50, len(v.content))])

    case OXTag:
        fmt.printf("Tag: %s%s\n", v.type == .Declaration ? "@" : "#", v.name)
    }
}
