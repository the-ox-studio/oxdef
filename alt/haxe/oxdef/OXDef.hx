package oxdef;

/**
 * Main OXDef API - Unified interface to the OX specification library
 *
 * This provides Haxe externs for the JavaScript oxdef implementation.
 * All functionality from the JavaScript library is accessible through these externs.
 *
 * Usage:
 * ```haxe
 * import oxdef.OXDef;
 *
 * // Parse OX source
 * var ast = OXDef.parse('
 *   [Player (name: "Hero", health: 100)]
 * ');
 *
 * // Work with the AST
 * var blocks = OXDef.findByTag(ast, "player");
 * ```
 */
class OXDef {
	// ============================================================================
	// Quick API - Common operations
	// ============================================================================

	/**
	 * Parse OX source code into an AST
	 */
	public static function parse(source:String, ?filename:String):AST.DocumentNode {
		return Parser.parse(source, filename);
	}

	/**
	 * Tokenize OX source code
	 */
	public static function tokenize(source:String, ?filename:String):Array<Tokenizer.Token> {
		return Tokenizer.tokenize(source, filename);
	}

	/**
	 * Walk the AST tree
	 */
	public static function walk(tree:AST.ASTNode, callback:Walker.WalkCallback, ?options:Walker.WalkerOptions):Void {
		Walker.walk(tree, callback, options);
	}

	/**
	 * Find nodes by tag name
	 */
	public static function findByTag(tree:AST.ASTNode, tagName:String):Array<AST.ASTNode> {
		return Walker.findByTag(tree, tagName);
	}

	/**
	 * Find nodes by property
	 */
	public static function findByProperty(tree:AST.ASTNode, propertyName:String, ?propertyValue:Dynamic):Array<AST.ASTNode> {
		return Walker.findByProperty(tree, propertyName, propertyValue);
	}

	/**
	 * Find a single node matching predicate
	 */
	public static function findNode(tree:AST.ASTNode, predicate:AST.ASTNode->Bool):Null<AST.ASTNode> {
		return Walker.findNode(tree, predicate);
	}

	/**
	 * Find all nodes matching predicate
	 */
	public static function findAllNodes(tree:AST.ASTNode, predicate:AST.ASTNode->Bool):Array<AST.ASTNode> {
		return Walker.findAllNodes(tree, predicate);
	}

	// ============================================================================
	// Factory Functions - Create AST nodes
	// ============================================================================

	public static function createBlock(id:Null<String>, ?properties:haxe.DynamicAccess<Dynamic>, ?children:Array<AST.ASTNode>, ?tags:Array<AST.TagNode>, ?location:AST.Location):AST.BlockNode {
		return AST.createBlock(id, properties, children, tags, location);
	}

	public static function createTag(type:String, name:String, ?argument:String, ?location:AST.Location):AST.TagNode {
		return AST.createTag(type, name, argument, location);
	}

	public static function createProperty(key:String, value:Dynamic, ?location:AST.Location):AST.PropertyNode {
		return AST.createProperty(key, value, location);
	}

	public static function createLiteral(valueType:String, value:Dynamic, ?location:AST.Location):AST.LiteralNode {
		return AST.createLiteral(valueType, value, location);
	}

	public static function createDocument(?blocks:Array<AST.ASTNode>, ?location:AST.Location):AST.DocumentNode {
		return AST.createDocument(blocks, location);
	}

	// ============================================================================
	// Preprocessing
	// ============================================================================

	/**
	 * Create expression evaluator with context
	 */
	public static function createExpressionEvaluator(context:haxe.DynamicAccess<Dynamic>):Preprocessor.ExpressionEvaluator {
		return new Preprocessor.ExpressionEvaluator(context);
	}

	/**
	 * Create block registry for reference resolution
	 */
	public static function createBlockRegistry(document:AST.DocumentNode):Preprocessor.BlockRegistry {
		var builder = new Preprocessor.BlockRegistryBuilder();
		return builder.build(document);
	}

	/**
	 * Create tag registry
	 */
	public static function createTagRegistry():Preprocessor.TagRegistry {
		return new Preprocessor.TagRegistry();
	}

	/**
	 * Create template expander
	 */
	public static function createTemplateExpander(context:haxe.DynamicAccess<Dynamic>):Preprocessor.TemplateExpander {
		return new Preprocessor.TemplateExpander(context);
	}

	// ============================================================================
	// Project Management
	// ============================================================================

	/**
	 * Create an OX project
	 */
	public static function createProject(config:Project.OXConfig):Project.OXProject {
		return new Project.OXProject(config);
	}

	/**
	 * Get default configuration
	 */
	public static function getDefaultConfig():Project.OXConfig {
		return Project.DEFAULT_CONFIG;
	}

	// ============================================================================
	// Utility Functions
	// ============================================================================

	/**
	 * Create location object
	 */
	public static function createLocation(file:String, line:Int, column:Int):AST.Location {
		return Errors.createLocation(file, line, column);
	}

	/**
	 * Dedent text (remove common leading whitespace)
	 */
	public static function dedent(text:String):String {
		return Preprocessor.dedent(text);
	}
}
