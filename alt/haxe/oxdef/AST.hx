package oxdef;

/**
 * Location information for AST nodes
 */
typedef Location = {
	var line:Int;
	var column:Int;
	var offset:Int;
}

/**
 * Base class for all AST nodes
 */
@:jsRequire("oxdef", "ASTNode")
extern class ASTNode {
	var type:String;
	var location:Location;
}

/**
 * Document node - root of the AST
 */
@:jsRequire("oxdef", "DocumentNode")
extern class DocumentNode extends ASTNode {
	var blocks:Array<ASTNode>;
}

/**
 * Block node - represents a data structure
 */
@:jsRequire("oxdef", "BlockNode")
extern class BlockNode extends ASTNode {
	var name:Null<String>;
	var children:Array<ASTNode>;
	var tags:Array<String>;
}

/**
 * Tag node - metadata annotation
 */
@:jsRequire("oxdef", "TagNode")
extern class TagNode extends ASTNode {
	var tagType:String;
	var name:String;
	var argument:Null<Dynamic>;
}

/**
 * Property node - key-value pair
 */
@:jsRequire("oxdef", "PropertyNode")
extern class PropertyNode extends ASTNode {
	var key:String;
	var value:ASTNode;
}

/**
 * Literal node - primitive value
 */
@:jsRequire("oxdef", "LiteralNode")
extern class LiteralNode extends ASTNode {
	var valueType:String;
	var value:Dynamic;
}

/**
 * Array node - list of values
 */
@:jsRequire("oxdef", "ArrayNode")
extern class ArrayNode extends ASTNode {
	var elements:Array<ASTNode>;
}

/**
 * Expression node - computed value
 */
@:jsRequire("oxdef", "ExpressionNode")
extern class ExpressionNode extends ASTNode {
	var tokens:Array<Dynamic>;
}

/**
 * Free text node - unstructured text content
 */
@:jsRequire("oxdef", "FreeTextNode")
extern class FreeTextNode extends ASTNode {
	var value:String;
	var tags:Array<String>;
}

/**
 * Set directive node - variable assignment
 */
@:jsRequire("oxdef", "SetNode")
extern class SetNode extends ASTNode {
	var name:String;
	var value:ASTNode;
}

/**
 * If directive node - conditional content
 */
@:jsRequire("oxdef", "IfNode")
extern class IfNode extends ASTNode {
	var condition:Array<Dynamic>;
	var thenBody:Array<ASTNode>;
	var elseBody:Null<Array<ASTNode>>;
}

/**
 * Foreach directive node - iteration
 */
@:jsRequire("oxdef", "ForeachNode")
extern class ForeachNode extends ASTNode {
	var itemName:String;
	var indexName:Null<String>;
	var collection:Array<Dynamic>;
	var body:Array<ASTNode>;
}

/**
 * While directive node - conditional iteration
 */
@:jsRequire("oxdef", "WhileNode")
extern class WhileNode extends ASTNode {
	var condition:Array<Dynamic>;
	var body:Array<ASTNode>;
}

/**
 * OnData directive node - data source processing
 */
@:jsRequire("oxdef", "OnDataNode")
extern class OnDataNode extends ASTNode {
	var source:String;
	var itemName:Null<String>;
	var body:Array<ASTNode>;
}

/**
 * Import directive node - file inclusion
 */
@:jsRequire("oxdef", "ImportNode")
extern class ImportNode extends ASTNode {
	var path:String;
	var alias:Null<String>;
}

/**
 * Inject directive node - raw content injection
 */
@:jsRequire("oxdef", "InjectNode")
extern class InjectNode extends ASTNode {
	var path:String;
}

/**
 * AST factory functions
 */
@:jsRequire("oxdef")
extern class ASTFactory {
	/**
	 * Create a document node
	 */
	@:native("createDocument")
	public static function createDocument(?blocks:Array<ASTNode>, ?location:Location):DocumentNode;

	/**
	 * Create a block node
	 */
	@:native("createBlock")
	public static function createBlock(name:Null<String>, children:Array<ASTNode>, ?tags:Array<String>, ?location:Location):BlockNode;

	/**
	 * Create a tag node
	 */
	@:native("createTag")
	public static function createTag(tagType:String, name:String, ?argument:Dynamic, ?location:Location):TagNode;

	/**
	 * Create a property node
	 */
	@:native("createProperty")
	public static function createProperty(key:String, value:ASTNode, ?location:Location):PropertyNode;

	/**
	 * Create a literal node
	 */
	@:native("createLiteral")
	public static function createLiteral(valueType:String, value:Dynamic, ?location:Location):LiteralNode;

	/**
	 * Create an array node
	 */
	@:native("createArray")
	public static function createArray(elements:Array<ASTNode>, ?location:Location):ArrayNode;

	/**
	 * Create an expression node
	 */
	@:native("createExpression")
	public static function createExpression(tokens:Array<Dynamic>, ?location:Location):ExpressionNode;

	/**
	 * Create a free text node
	 */
	@:native("createFreeText")
	public static function createFreeText(value:String, ?tags:Array<String>, ?location:Location):FreeTextNode;

	/**
	 * Create a set directive node
	 */
	@:native("createSet")
	public static function createSet(name:String, value:ASTNode, ?location:Location):SetNode;

	/**
	 * Create an if directive node
	 */
	@:native("createIf")
	public static function createIf(condition:Array<Dynamic>, thenBody:Array<ASTNode>, ?elseBody:Array<ASTNode>, ?location:Location):IfNode;

	/**
	 * Create a foreach directive node
	 */
	@:native("createForeach")
	public static function createForeach(itemName:String, collection:Array<Dynamic>, body:Array<ASTNode>, ?indexName:String, ?location:Location):ForeachNode;

	/**
	 * Create a while directive node
	 */
	@:native("createWhile")
	public static function createWhile(condition:Array<Dynamic>, body:Array<ASTNode>, ?location:Location):WhileNode;

	/**
	 * Create an ondata directive node
	 */
	@:native("createOnData")
	public static function createOnData(source:String, body:Array<ASTNode>, ?itemName:String, ?location:Location):OnDataNode;

	/**
	 * Create an import directive node
	 */
	@:native("createImport")
	public static function createImport(path:String, ?alias:String, ?location:Location):ImportNode;

	/**
	 * Create an inject directive node
	 */
	@:native("createInject")
	public static function createInject(path:String, ?location:Location):InjectNode;
}
