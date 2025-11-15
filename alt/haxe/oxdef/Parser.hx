package oxdef;

import oxdef.AST;
import oxdef.Tokenizer;

/**
 * Parser class - recursive descent parser for OX language
 */
@:jsRequire("oxdef", "Parser")
extern class Parser {
	function new(tokens:Array<Token>, ?filename:String, ?options:ParserOptions);
	function parse():DocumentNode;
}

/**
 * Parser options
 */
typedef ParserOptions = {
	?mergeFreeText:Bool
}

/**
 * Module-level parser functions
 */
@:jsRequire("oxdef")
extern class ParserModule {
	/**
	 * Parse OX source code into an AST
	 * @param source The OX source code to parse
	 * @param filename Optional filename for error reporting
	 * @return The parsed document AST node
	 */
	@:native("parse")
	public static function parse(source:String, ?filename:String):DocumentNode;

	/**
	 * Parse with macro expansion enabled
	 * @param source The OX source code to parse
	 * @param filename Optional filename for error reporting
	 * @return The parsed document with macros expanded
	 */
	@:native("parseWithMacros")
	public static function parseWithMacros(source:String, ?filename:String):DocumentNode;
}
