package oxdef;

/**
 * OX Project Configuration
 */
typedef OXConfig = {
	var projectDir:String;
	var entryPoint:String;
	var outputDir:String;
	var moduleDirectories:Array<String>;
	var extensions:Array<String>;
	var includes:Array<String>;
	var excludes:Array<String>;
	var ?watch:Bool;
	var ?verbose:Bool;
}

/**
 * Default configuration
 */
@:jsRequire("../../../src/project/config", "DEFAULT_CONFIG")
extern var DEFAULT_CONFIG:OXConfig;

/**
 * Find config file
 */
@:jsRequire("../../../src/project/config", "findConfigFile")
extern function findConfigFile(projectDir:String):Null<String>;

/**
 * Parse JSON config
 */
@:jsRequire("../../../src/project/config", "parseJSONConfig")
extern function parseJSONConfig(configPath:String):Dynamic;

/**
 * Merge configurations
 */
@:jsRequire("../../../src/project/config", "mergeConfig")
extern function mergeConfig(defaults:OXConfig, userConfig:Dynamic, projectDir:String):OXConfig;

/**
 * Validate configuration
 */
@:jsRequire("../../../src/project/config", "validateConfig")
extern function validateConfig(config:OXConfig):Bool;

/**
 * Detect entry point
 */
@:jsRequire("../../../src/project/config", "detectEntryPoint")
extern function detectEntryPoint(config:OXConfig):String;

/**
 * File Loader
 */
@:jsRequire("../../../src/project/loader", "FileLoader")
extern class FileLoader {
	function new(config:OXConfig):Void;
	function load(filePath:String):js.lib.Promise<String>;
	function loadSync(filePath:String):String;
	function exists(filePath:String):Bool;
}

/**
 * Import Processor
 */
@:jsRequire("../../../src/project/import-processor", "ImportProcessor")
extern class ImportProcessor {
	function new(config:OXConfig, loader:FileLoader):Void;
	function process(tree:AST.ASTNode, currentFile:String):js.lib.Promise<AST.ASTNode>;
}

/**
 * Inject Processor
 */
@:jsRequire("../../../src/project/inject-processor", "InjectProcessor")
extern class InjectProcessor {
	function new(config:OXConfig, loader:FileLoader):Void;
	function process(tree:AST.ASTNode, currentFile:String):js.lib.Promise<AST.ASTNode>;
}

/**
 * Import Graph for dependency tracking
 */
@:jsRequire("../../../src/project/import-graph", "ImportGraph")
extern class ImportGraph {
	function new():Void;
	function addFile(filePath:String):Void;
	function addDependency(from:String, to:String):Void;
	function hasCycle():Bool;
	function getCycle():Null<Array<String>>;
	function getTopologicalOrder():Array<String>;
	function getDependencies(filePath:String):Array<String>;
	function getDependents(filePath:String):Array<String>;
}

/**
 * Path resolver functions
 */
@:jsRequire("../../../src/project/resolver", "resolveImportPath")
extern function resolveImportPath(importPath:String, currentFile:String, config:OXConfig):String;

@:jsRequire("../../../src/project/resolver", "resolveRelativePath")
extern function resolveRelativePath(importPath:String, currentFile:String, ?config:OXConfig):String;

@:jsRequire("../../../src/project/resolver", "resolvePackagePath")
extern function resolvePackagePath(importPath:String, config:OXConfig):String;

@:jsRequire("../../../src/project/resolver", "normalizePath")
extern function normalizePath(filePath:String):String;

/**
 * Main OX Project class
 */
@:jsRequire("../../../src/project/project", "OXProject")
extern class OXProject {
	var config:OXConfig;
	var loader:FileLoader;
	var importGraph:ImportGraph;

	function new(config:OXConfig):Void;
	function build():js.lib.Promise<AST.DocumentNode>;
	function buildSync():AST.DocumentNode;
	function watch(callback:String->Void):Void;
	function getFiles():Array<String>;
}
