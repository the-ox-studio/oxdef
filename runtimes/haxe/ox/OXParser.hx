package ox;

import ox.OXNode;

using StringTools;

/**
 * Exception thrown during parsing.
 */
class OXParseException {
	public var message:String;
	public var location:OXLocation;

	public function new(message:String, location:OXLocation) {
		this.message = message;
		this.location = location;
	}

	public function toString():String {
		return '$message at ${location.toString()}';
	}
}

/**
 * Token types for the lexer.
 */
enum TokenType {
	LBRACKET;
	RBRACKET;
	LPAREN;
	RPAREN;
	IDENTIFIER;
	STRING;
	NUMBER;
	BOOLEAN;
	NULL;
	COLON;
	COMMA;
	AT;
	HASH;
	FREE_TEXT_CONTENT;
	EOF;
}

/**
 * Token produced by the lexer.
 */
class Token {
	public var type:TokenType;
	public var value:Null<String>;
	public var location:OXLocation;

	public function new(type:TokenType, ?value:String, location:OXLocation) {
		this.type = type;
		this.value = value;
		this.location = location;
	}
}

/**
 * Tokenizes and parses OX source code into an AST.
 */
class OXParser {
	private var source:String;
	private var filename:String;
	private var pos:Int;
	private var line:Int;
	private var column:Int;
	private var tokens:Array<Token>;
	private var tokenPos:Int;

	public function new(source:String, filename:String = "<input>") {
		this.source = source;
		this.filename = filename;
		this.pos = 0;
		this.line = 1;
		this.column = 1;
		this.tokens = [];
		this.tokenPos = 0;
	}

	public function parse():OXDocument {
		tokenize();
		return parseDocument();
	}

	// ============================================================================
	// Tokenizer
	// ============================================================================

	private function tokenize():Void {
		while (!isAtEnd()) {
			skipWhitespaceAndComments();
			if (isAtEnd())
				break;

			var token = scanToken();
			if (token != null) {
				tokens.push(token);
			}
		}

		tokens.push(new Token(EOF, null, getLocation()));
	}

	private function scanToken():Null<Token> {
		var location = getLocation();
		var c = current();

		return switch (c) {
			case '['.code: advance('['.code, LBRACKET, location);
			case ']'.code: advance(']'.code, RBRACKET, location);
			case '('.code: advance('('.code, LPAREN, location);
			case ')'.code: advance(')'.code, RPAREN, location);
			case ':'.code: advance(':'.code, COLON, location);
			case ','.code: advance(','.code, COMMA, location);
			case '@'.code: advance('@'.code, AT, location);
			case '#'.code: advance('#'.code, HASH, location);
			case '"'.code: scanString(location);
			case '`'.code: scanFreeTextOrError(location);
			case _ if (isDigit(c) || (c == '-'.code && isDigit(peek()))): scanNumber(location);
			case _ if (isLetter(c) || c == '_'.code): scanIdentifier(location);
			case _: throw new OXParseException('Unexpected character: ${String.fromCharCode(c)}', location);
		};
	}

	private function advance(expected:Int, type:TokenType, location:OXLocation):Token {
		advanceChar();
		return new Token(type, String.fromCharCode(expected), location);
	}

	private function scanString(location:OXLocation):Token {
		advanceChar(); // opening "
		var sb = new StringBuf();

		while (!isAtEnd() && current() != '"'.code) {
			if (current() == '\\'.code) {
				advanceChar();
				if (!isAtEnd()) {
					var escaped = switch (current()) {
						case 'n'.code: '\n'.code;
						case 't'.code: '\t'.code;
						case 'r'.code: '\r'.code;
						case '\\'.code: '\\'.code;
						case '"'.code: '"'.code;
						case _: current();
					};
					sb.addChar(escaped);
					advanceChar();
				}
			} else {
				sb.addChar(current());
				advanceChar();
			}
		}

		if (isAtEnd())
			throw new OXParseException("Unterminated string", location);

		advanceChar(); // closing "
		return new Token(STRING, sb.toString(), location);
	}

	private function scanNumber(location:OXLocation):Token {
		var start = pos;
		if (current() == '-'.code)
			advanceChar();

		while (!isAtEnd() && isDigit(current()))
			advanceChar();

		if (!isAtEnd() && current() == '.'.code && isDigit(peek())) {
			advanceChar(); // .
			while (!isAtEnd() && isDigit(current()))
				advanceChar();
		}

		var value = source.substring(start, pos);
		return new Token(NUMBER, value, location);
	}

	private function scanIdentifier(location:OXLocation):Token {
		var start = pos;
		while (!isAtEnd() && (isLetterOrDigit(current()) || current() == '_'.code || current() == '-'.code))
			advanceChar();

		var value = source.substring(start, pos);
		var type = switch (value) {
			case "true" | "false": BOOLEAN;
			case "null": NULL;
			case _: IDENTIFIER;
		};

		return new Token(type, value, location);
	}

	private function scanFreeTextOrError(location:OXLocation):Token {
		if (peek() == '`'.code && peek(2) == '`'.code) {
			return scanFreeText(location);
		}
		throw new OXParseException("Single backtick not supported", location);
	}

	private function scanFreeText(location:OXLocation):Token {
		// Count opening backticks
		var count = 0;
		while (!isAtEnd() && current() == '`'.code) {
			count++;
			advanceChar();
		}

		var start = pos;

		// Find matching closing backticks
		while (!isAtEnd()) {
			if (current() == '`'.code) {
				var savedPos = pos;
				var savedLine = line;
				var savedColumn = column;
				var closeCount = 0;

				while (!isAtEnd() && current() == '`'.code) {
					closeCount++;
					advanceChar();
				}

				if (closeCount == count) {
					var content = source.substring(start, savedPos);
					return new Token(FREE_TEXT_CONTENT, dedent(content), location);
				}
			} else {
				advanceChar();
			}
		}

		throw new OXParseException("Unterminated free text block", location);
	}

	private function dedent(text:String):String {
		return text.trim();
	}

	private function skipWhitespaceAndComments():Void {
		while (!isAtEnd()) {
			var c = current();

			if (isWhitespace(c)) {
				advanceChar();
			} else if (c == '/'.code && peek() == '/'.code) {
				// Line comment
				while (!isAtEnd() && current() != '\n'.code)
					advanceChar();
			} else if (c == '/'.code && peek() == '*'.code) {
				// Block comment
				advanceChar(); // /
				advanceChar(); // *
				while (!isAtEnd()) {
					if (current() == '*'.code && peek() == '/'.code) {
						advanceChar(); // *
						advanceChar(); // /
						break;
					}
					advanceChar();
				}
			} else {
				break;
			}
		}
	}

	private inline function isAtEnd():Bool {
		return pos >= source.length;
	}

	private inline function current():Int {
		return isAtEnd() ? 0 : source.charCodeAt(pos);
	}

	private inline function peek(offset:Int = 1):Int {
		var p = pos + offset;
		return p >= source.length ? 0 : source.charCodeAt(p);
	}

	private function advanceChar():Void {
		if (isAtEnd())
			return;

		if (current() == '\n'.code) {
			line++;
			column = 1;
		} else {
			column++;
		}

		pos++;
	}

	private function getLocation():OXLocation {
		return new OXLocation(filename, line, column);
	}

	private inline function isWhitespace(c:Int):Bool {
		return c == ' '.code || c == '\t'.code || c == '\n'.code || c == '\r'.code;
	}

	private inline function isDigit(c:Int):Bool {
		return c >= '0'.code && c <= '9'.code;
	}

	private inline function isLetter(c:Int):Bool {
		return (c >= 'a'.code && c <= 'z'.code) || (c >= 'A'.code && c <= 'Z'.code);
	}

	private inline function isLetterOrDigit(c:Int):Bool {
		return isLetter(c) || isDigit(c);
	}

	// ============================================================================
	// Parser
	// ============================================================================

	private function parseDocument():OXDocument {
		var doc = new OXDocument();

		while (!checkToken(EOF)) {
			if (checkToken(LBRACKET) || checkToken(AT) || checkToken(HASH)) {
				doc.blocks.push(parseBlock());
			} else {
				throw new OXParseException("Unexpected token at document level", currentToken().location);
			}
		}

		return doc;
	}

	private function parseBlock():OXBlock {
		var tags = [];

		// Parse tags
		while (checkToken(AT) || checkToken(HASH)) {
			tags.push(parseTag());
		}

		var location = currentToken().location;
		expectToken(LBRACKET);

		// Parse optional identifier
		var id:Null<String> = null;
		if (checkToken(IDENTIFIER)) {
			id = advanceToken().value;
		}

		// Parse properties
		var properties = new Map<String, Dynamic>();
		if (checkToken(LPAREN)) {
			properties = parseProperties();
		}

		// Parse children
		var children:Array<OXNode> = [];
		while (!checkToken(RBRACKET) && !checkToken(EOF)) {
			if (checkToken(LBRACKET) || checkToken(AT) || checkToken(HASH)) {
				children.push(parseBlock());
			} else if (checkToken(FREE_TEXT_CONTENT)) {
				children.push(parseFreeText(tags));
			} else {
				throw new OXParseException("Unexpected token in block body", currentToken().location);
			}
		}

		expectToken(RBRACKET);

		var block = new OXBlock();
		block.id = id;
		block.properties = properties;
		block.children = children;
		block.tags = tags;
		block.location = location;

		return block;
	}

	private function parseTag():OXTag {
		var type = checkToken(AT) ? Declaration : Instance;
		advanceToken(); // @ or #

		var name = expectToken(IDENTIFIER).value;

		var argument:Null<String> = null;
		if (checkToken(LPAREN)) {
			advanceToken(); // (
			argument = expectToken(IDENTIFIER).value;
			expectToken(RPAREN);
		}

		return new OXTag(type, name, argument);
	}

	private function parseProperties():Map<String, Dynamic> {
		expectToken(LPAREN);
		var props = new Map<String, Dynamic>();

		while (!checkToken(RPAREN) && !checkToken(EOF)) {
			var key = expectToken(IDENTIFIER).value;
			expectToken(COLON);
			var value = parseValue();
			props.set(key, value);

			if (checkToken(COMMA))
				advanceToken();
		}

		expectToken(RPAREN);
		return props;
	}

	private function parseValue():Dynamic {
		var token = currentToken();

		return switch (token.type) {
			case STRING: advanceToken().value;
			case NUMBER: parseNumber(advanceToken().value);
			case BOOLEAN: advanceToken().value == "true";
			case NULL: {advanceToken(); null;};
			case LBRACKET: parseArray();
			case _: throw new OXParseException('Unexpected value token: ${token.type}', token.location);
		};
	}

	private function parseNumber(value:String):Dynamic {
		if (value.indexOf('.') != -1)
			return Std.parseFloat(value);
		return Std.parseInt(value);
	}

	private function parseArray():Array<Dynamic> {
		expectToken(LBRACKET);
		var elements = [];

		while (!checkToken(RBRACKET) && !checkToken(EOF)) {
			elements.push(parseValue());

			if (checkToken(COMMA))
				advanceToken();
		}

		expectToken(RBRACKET);
		return elements;
	}

	private function parseFreeText(tags:Array<OXTag>):OXFreeText {
		var token = expectToken(FREE_TEXT_CONTENT);
		var freeText = new OXFreeText();
		freeText.content = token.value;
		freeText.tags = tags;
		freeText.location = token.location;
		return freeText;
	}

	private function checkToken(type:TokenType):Bool {
		return tokenPos < tokens.length && tokens[tokenPos].type == type;
	}

	private function currentToken():Token {
		return tokenPos < tokens.length ? tokens[tokenPos] : tokens[tokens.length - 1];
	}

	private function advanceToken():Token {
		return tokens[tokenPos++];
	}

	private function expectToken(type:TokenType):Token {
		if (!checkToken(type))
			throw new OXParseException('Expected $type but got ${currentToken().type}', currentToken().location);
		return advanceToken();
	}
}
