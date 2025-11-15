package ox;

/**
 * Location information for error reporting.
 */
class OXLocation {
	public var file:String;
	public var line:Int;
	public var column:Int;

	public function new(file:String = "<input>", line:Int = 1, column:Int = 1) {
		this.file = file;
		this.line = line;
		this.column = column;
	}

	public function toString():String {
		return '$file:$line:$column';
	}
}

/**
 * Base class for all OX AST nodes.
 */
class OXNode {
	public var location:OXLocation;

	public function new() {
		this.location = new OXLocation();
	}
}

/**
 * Represents the root document node.
 */
class OXDocument extends OXNode {
	public var blocks:Array<OXNode>;

	public function new() {
		super();
		this.blocks = [];
	}
}

/**
 * Represents a block with optional ID, properties, children, and tags.
 */
class OXBlock extends OXNode {
	public var id:Null<String>;
	public var properties:Map<String, Dynamic>;
	public var children:Array<OXNode>;
	public var tags:Array<OXTag>;

	public function new() {
		super();
		this.id = null;
		this.properties = new Map<String, Dynamic>();
		this.children = [];
		this.tags = [];
	}
}

/**
 * Represents free text content.
 */
class OXFreeText extends OXNode {
	public var content:String;
	public var tags:Array<OXTag>;

	public function new() {
		super();
		this.content = "";
		this.tags = [];
	}
}

/**
 * Tag type: Declaration (@) or Instance (#).
 */
enum OXTagType {
	Declaration;
	Instance;
}

/**
 * Represents a tag (declaration or instance).
 */
class OXTag {
	public var type:OXTagType;
	public var name:String;
	public var argument:Null<String>;

	public function new(type:OXTagType, name:String, ?argument:String) {
		this.type = type;
		this.name = name;
		this.argument = argument;
	}
}
