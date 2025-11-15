package oxdef;

/**
 * Token types in the OX language
 */
@:jsRequire("oxdef", "TokenType")
extern class TokenType {
	public static var LBRACKET:String;
	public static var RBRACKET:String;
	public static var LPAREN:String;
	public static var RPAREN:String;
	public static var LBRACE:String;
	public static var RBRACE:String;
	public static var COLON:String;
	public static var COMMA:String;
	public static var DOLLAR:String;
	public static var AT:String;
	public static var HASH:String;
	public static var PIPE:String;
	public static var EQUALS:String;
	public static var ASTERISK:String;
	public static var IDENTIFIER:String;
	public static var STRING:String;
	public static var NUMBER:String;
	public static var BOOLEAN:String;
	public static var NULL:String;
	public static var DIRECTIVE:String;
	public static var FREE_TEXT:String;
	public static var NEWLINE:String;
	public static var EOF:String;
}

/**
 * Token class representing a lexical token
 */
@:jsRequire("oxdef", "Token")
extern class Token {
	var type:String;
	var value:Dynamic;
	var location:oxdef.AST.Location;

	function new(type:String, value:Dynamic, location:oxdef.AST.Location);
}

/**
 * Tokenizer class for lexical analysis
 */
@:jsRequire("oxdef", "Tokenizer")
extern class Tokenizer {
	function new(input:String, ?filename:String);
	function tokenize():Array<Token>;
}

/**
 * Module-level tokenizer functions
 */
@:jsRequire("oxdef")
extern class TokenizerModule {
	/**
	 * Tokenize OX source code into tokens
	 * @param input The OX source code to tokenize
	 * @param filename Optional filename for error reporting
	 * @return Array of tokens
	 */
	@:native("tokenize")
	public static function tokenize(input:String, ?filename:String):Array<Token>;
}
