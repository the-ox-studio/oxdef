package oxdef;

/**
 * Base OX Error
 */
@:jsRequire("../../../src/errors/errors", "OXError")
extern class OXError extends js.lib.Error {
	var location:AST.Location;
	var filename:String;
	var line:Int;
	var column:Int;
	function new(message:String, ?location:AST.Location):Void;
}

/**
 * Parse Error
 */
@:jsRequire("../../../src/errors/errors", "ParseError")
extern class ParseError extends OXError {
	var token:Dynamic;
	function new(message:String, ?location:AST.Location, ?token:Dynamic):Void;
}

/**
 * Preprocess Error
 */
@:jsRequire("../../../src/errors/errors", "PreprocessError")
extern class PreprocessError extends OXError {
	var phase:String;
	function new(message:String, ?phase:String, ?location:AST.Location):Void;
}

/**
 * OX Warning
 */
@:jsRequire("../../../src/errors/errors", "OXWarning")
extern class OXWarning {
	var message:String;
	var location:AST.Location;
	var severity:String;
	function new(message:String, ?location:AST.Location, ?severity:String):Void;
	function toString():String;
}

/**
 * Create location helper
 */
@:jsRequire("../../../src/errors/errors", "createLocation")
extern function createLocation(file:String, line:Int, column:Int):AST.Location;

/**
 * Error Collector
 */
@:jsRequire("../../../src/errors/errors", "ErrorCollector")
extern class ErrorCollector {
	var errors:Array<OXError>;
	var warnings:Array<OXWarning>;
	function new():Void;
	function addError(error:OXError):Void;
	function addWarning(warning:OXWarning):Void;
	function hasErrors():Bool;
	function hasWarnings():Bool;
	function clear():Void;
	function getReport():String;
}
