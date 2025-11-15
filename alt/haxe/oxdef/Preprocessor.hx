package oxdef;

/**
 * Expression Evaluator
 */
@:jsRequire("../../../src/preprocessor/expressions", "ExpressionEvaluator")
extern class ExpressionEvaluator {
	function new(context:haxe.DynamicAccess<Dynamic>):Void;
	function evaluate(expr:AST.ExpressionNode):Dynamic;
	function setVariable(name:String, value:Dynamic):Void;
	function getVariable(name:String):Dynamic;
	function hasVariable(name:String):Bool;
}

/**
 * Block Registry for reference resolution
 */
@:jsRequire("../../../src/preprocessor/references", "BlockRegistry")
extern class BlockRegistry {
	function new():Void;
	function register(block:AST.BlockNode, ?parent:AST.BlockNode, ?index:Int):Void;
	function getContext(block:AST.BlockNode):Null<BlockContext>;
	function findById(id:String):Null<AST.BlockNode>;
	function findSibling(block:AST.BlockNode, idOrIndex:Dynamic):Null<AST.BlockNode>;
	function getChildren(block:AST.BlockNode):Array<AST.BlockNode>;
}

typedef BlockContext = {
	var node:AST.BlockNode;
	var parent:Null<AST.BlockNode>;
	var index:Null<Int>;
	var siblings:Array<AST.BlockNode>;
	var properties:haxe.DynamicAccess<Dynamic>;
}

/**
 * Block Registry Builder
 */
@:jsRequire("../../../src/preprocessor/references", "BlockRegistryBuilder")
extern class BlockRegistryBuilder {
	function new():Void;
	function build(document:AST.DocumentNode):BlockRegistry;
}

/**
 * Reference Resolver
 */
@:jsRequire("../../../src/preprocessor/references", "ReferenceResolver")
extern class ReferenceResolver {
	function new(registry:BlockRegistry):Void;
	function resolve(tree:AST.ASTNode):AST.ASTNode;
}

/**
 * Tag Registry
 */
@:jsRequire("../../../src/preprocessor/tags", "TagRegistry")
extern class TagRegistry {
	function new():Void;
	function register(tagName:String, handler:TagHandler):Void;
	function hasTag(tagName:String):Bool;
	function getHandler(tagName:String):Null<TagHandler>;
	function process(node:AST.ASTNode, tag:AST.TagNode):Dynamic;
}

typedef TagHandler = AST.ASTNode -> AST.TagNode -> Dynamic;

/**
 * Tag Processor
 */
@:jsRequire("../../../src/preprocessor/tags", "TagProcessor")
extern class TagProcessor {
	function new(tagRegistry:TagRegistry):Void;
	function process(tree:AST.ASTNode):AST.ASTNode;
}

/**
 * Template Expander
 */
@:jsRequire("../../../src/preprocessor/templates", "TemplateExpander")
extern class TemplateExpander {
	function new(context:haxe.DynamicAccess<Dynamic>):Void;
	function expand(tree:AST.ASTNode):AST.ASTNode;
	function setVariable(name:String, value:Dynamic):Void;
	function getVariable(name:String):Dynamic;
}

/**
 * Data Source Processor
 */
@:jsRequire("../../../src/preprocessor/datasources", "DataSourceProcessor")
extern class DataSourceProcessor {
	function new():Void;
	function registerSource(name:String, provider:DataSourceProvider):Void;
	function process(tree:AST.ASTNode):js.lib.Promise<AST.ASTNode>;
}

typedef DataSourceProvider = Void -> js.lib.Promise<Dynamic>;

/**
 * Macro System
 */
@:jsRequire("../../../src/preprocessor/macros", "MacroSystem")
extern class MacroSystem {
	function new():Void;
	function define(name:String, params:Array<String>, body:MacroBody):Void;
	function expand(name:String, args:Array<Dynamic>):Dynamic;
	function hasMacro(name:String):Bool;
}

typedef MacroBody = Array<Dynamic> -> Dynamic;

/**
 * Macro instance
 */
@:jsRequire("../../../src/preprocessor/macros", "macros")
extern var macros:MacroSystem;

/**
 * Initialize macros
 */
@:jsRequire("../../../src/preprocessor/macros", "initMacros")
extern function initMacros(parser:Parser):Void;

/**
 * Create macro context
 */
@:jsRequire("../../../src/preprocessor/macros", "createMacroContext")
extern function createMacroContext():Dynamic;

/**
 * Create enhanced macro context
 */
@:jsRequire("../../../src/preprocessor/macros", "createEnhancedMacroContext")
extern function createEnhancedMacroContext():Dynamic;

/**
 * Whitespace processing
 */
@:jsRequire("../../../src/preprocessor/whitespace", "dedent")
extern function dedent(text:String):String;

@:jsRequire("../../../src/preprocessor/whitespace", "processFreeText")
extern function processFreeText(rawText:String, ?tags:Array<AST.TagNode>):String;
