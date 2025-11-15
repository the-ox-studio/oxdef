package oxdef;

/**
 * Traversal order for tree walking
 */
@:jsRequire("../../../src/walker/walker", "TraversalOrder")
extern enum abstract TraversalOrder(String) {
	var PRE_ORDER = "PRE_ORDER";
	var POST_ORDER = "POST_ORDER";
}

/**
 * Walker control signals
 */
@:jsRequire("../../../src/walker/walker", "WalkerControl")
extern enum abstract WalkerControl(String) {
	var CONTINUE = "CONTINUE";
	var SKIP = "SKIP";
	var STOP = "STOP";
}

/**
 * Tree Walker for traversing AST
 */
@:jsRequire("../../../src/walker/walker", "TreeWalker")
extern class TreeWalker {
	function new(?options:WalkerOptions):Void;
	function walk(tree:AST.ASTNode, callback:WalkCallback):Void;
	function getContext():WalkContext;
}

typedef WalkerOptions = {
	?order:TraversalOrder,
	?trackAncestors:Bool,
	?trackDepth:Bool,
}

typedef WalkCallback = AST.ASTNode -> WalkContext -> WalkerControl;

typedef WalkContext = {
	var node:AST.ASTNode;
	var parent:Null<AST.ASTNode>;
	var depth:Int;
	var ancestors:Array<AST.ASTNode>;
	var path:Array<Dynamic>;
}

/**
 * Macro Walker - specialized for macro expansion
 */
@:jsRequire("../../../src/walker/walker", "MacroWalker")
extern class MacroWalker {
	function new(macroContext:Dynamic):Void;
	function walk(tree:AST.ASTNode):AST.ASTNode;
}

/**
 * Walk helper function
 */
@:jsRequire("../../../src/walker/walker", "walk")
extern function walk(tree:AST.ASTNode, callback:WalkCallback, ?options:WalkerOptions):Void;

/**
 * Find a single node matching predicate
 */
@:jsRequire("../../../src/walker/walker", "findNode")
extern function findNode(tree:AST.ASTNode, predicate:AST.ASTNode->Bool):Null<AST.ASTNode>;

/**
 * Find all nodes matching predicate
 */
@:jsRequire("../../../src/walker/walker", "findAllNodes")
extern function findAllNodes(tree:AST.ASTNode, predicate:AST.ASTNode->Bool):Array<AST.ASTNode>;

/**
 * Find nodes by tag name
 */
@:jsRequire("../../../src/walker/walker", "findByTag")
extern function findByTag(tree:AST.ASTNode, tagName:String):Array<AST.ASTNode>;

/**
 * Find nodes by property
 */
@:jsRequire("../../../src/walker/walker", "findByProperty")
extern function findByProperty(tree:AST.ASTNode, propertyName:String, ?propertyValue:Dynamic):Array<AST.ASTNode>;

/**
 * Get ancestors of a node
 */
@:jsRequire("../../../src/walker/walker", "getAncestors")
extern function getAncestors(tree:AST.ASTNode, targetNode:AST.ASTNode):Array<AST.ASTNode>;
