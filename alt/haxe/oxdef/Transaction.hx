package oxdef;

/**
 * Transaction system for tracking changes to AST
 */
@:jsRequire("../../../src/transaction/transaction", "Transaction")
extern class Transaction {
	function new():Void;
	function begin():Void;
	function commit():Void;
	function rollback():Void;
	function isActive():Bool;
	function recordChange(node:AST.ASTNode, property:String, oldValue:Dynamic, newValue:Dynamic):Void;
	function getChanges():Array<Change>;
}

typedef Change = {
	var node:AST.ASTNode;
	var property:String;
	var oldValue:Dynamic;
	var newValue:Dynamic;
}
