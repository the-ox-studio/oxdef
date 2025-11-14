# Odin Runtime Library for OX Data
The Odin Runtime library for OX will allow reading OX data files without the following features:

 * Template expressions: `<if>`, `<else>`, `<foreach>`, `<on-data>`, `<inject>`, etc.
 * Referencing using `$` - all these will be evaluated before it reaches Odin.
 * Property values also evaluated before reaching Odin.

## Idiomatic Odin
In addition to basic parsing, the Odin runtime library should have functions for type mapping and real-time object evaluation.

See `../.ai/Interpreter.md` for information on runtime interpretation. Consider translating the ideas to idiomatic Odin.

## Expected Public API

```odin
parse_file :: proc(path : string) -> (bool, []OXNode)
parse_map :: proc(path : string, obj : ^$T) -> bool
parse_file_with_interp :: proc(path : string, interp : ^OXInterpreter) -> (bool, []OXNode)
parse_map_with_interp :: proc(path : string, obj : ^$T, interp : ^OXInterpreter) -> bool
parse_walk :: proc(data : ^[]OXNode, location : ^OXLocation, visit : proc(node : ^OXNode, parent : ^OXNode) -> /)

create_interp :: proc() -> OXInterpreter
interp_on :: proc(interp : ^OXInterpreter, tag_name : string, callback : proc(tag_args : []string, block : ^OXNode, context : ^OXTree))
interp_execute :: proc(data : ^OXDataWrapper) -> OXTree
interp_execute_map :: proc(data : ^OXDataWrapper, obj : ^$T) -> bool
interp_execute_block :: proc(block : ^OXBlock, ctx : ^OXContext, obj : ^$T) -> bool
interp_on_unhandled :: proc(handler : proc(tag_args : []string, block : ^OXNode, context : ^OXTree))
```
