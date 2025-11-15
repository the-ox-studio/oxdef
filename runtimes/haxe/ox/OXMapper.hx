package ox;

import ox.OXNode;
import ox.OXParser;
#if sys
import sys.io.File;
#end

using StringTools;

/**
 * Maps OX nodes to Haxe objects using metadata and Dynamic typing.
 *
 * Due to Haxe's type system limitations compared to C#, this mapper uses
 * Dynamic for flexible property mapping while maintaining type safety where possible.
 */
class OXMapper {
	private var tagRegistry:Map<String, Class<Dynamic>>;

	public function new() {
		this.tagRegistry = new Map<String, Class<Dynamic>>();
	}

	/**
	 * Register a class for a specific tag name.
	 * The class should have @:oxTag metadata.
	 */
	public function registerTag<T>(cls:Class<T>):Void {
		var tagName = getTagName(cls);
		if (tagName == null)
			throw 'Class ${Type.getClassName(cls)} does not have @:oxTag metadata';

		tagRegistry.set(tagName, cast cls);
	}

	/**
	 * Parse OX source and map to typed object.
	 */
	public function parse<T>(source:String, filename:String = "<input>"):T {
		var parser = new OXParser(source, filename);
		var document = parser.parse();
		return mapDocument(document);
	}

	/**
	 * Parse OX file and map to typed object.
	 */
	#if sys
	public function parseFile<T>(path:String):T {
		var source = File.getContent(path);
		return parse(source, path);
	}
	#end

	/**
	 * Map an OX document to a typed object.
	 */
	public function mapDocument<T>(document:OXDocument):T {
		var result:Dynamic = {};
		mapDocumentToObject(document, result);
		return cast result;
	}

	/**
	 * Map an OX tree (block) to a typed object.
	 */
	public function mapTree<T>(node:OXNode):T {
		if (Std.isOfType(node, OXBlock)) {
			return cast mapBlockToObject(cast node);
		}

		throw 'Cannot map ${Type.getClassName(Type.getClass(node))} to object';
	}

	// ============================================================================
	// Mapping Implementation
	// ============================================================================

	private function mapDocumentToObject(document:OXDocument, target:Dynamic):Void {
		for (node in document.blocks) {
			if (!Std.isOfType(node, OXBlock))
				continue;
			var block:OXBlock = cast node;

			// Map by block ID to field name (use camelCase for JavaScript convention)
			if (block.id != null) {
				var fieldName = toCamelCase(block.id);
				var value = mapBlockToObject(block);
				Reflect.setField(target, fieldName, value);
				continue;
			}

			// Try to match by tag
			for (tag in block.tags) {
				if (tag.type == Declaration) {
					if (tagRegistry.exists(tag.name)) {
						var tagType = tagRegistry.get(tag.name);
						var fieldName = toCamelCase(tag.name);
						var value = mapBlockToObject(block, null);
						Reflect.setField(target, fieldName, value);
						break;
					}
				}
			}
		}
	}

	private function mapBlockToValue(block:OXBlock, ?targetType:Class<Dynamic>):Dynamic {
		if (targetType == null) {
			targetType = cast {};
		}

		var instance:Dynamic = Type.createInstance(targetType, []);
		mapBlockToObject(block, instance);
		return instance;
	}

	private function mapBlockToObject(block:OXBlock, ?target:Dynamic):Dynamic {
		if (target == null) {
			target = {};
		}

		// First, map all properties from the block directly
		for (key in block.properties.keys()) {
			var fieldName = toCamelCase(key);
			var value = convertValue(block.properties.get(key), null);
			Reflect.setField(target, fieldName, value);
		}

		// Then map child blocks
		for (child in block.children) {
			if (Std.isOfType(child, OXBlock)) {
				var childBlock:OXBlock = cast child;
				if (childBlock.id != null) {
					var fieldName = toCamelCase(childBlock.id);
					var childValue = mapBlockToObject(childBlock);
					Reflect.setField(target, fieldName, childValue);
				} else {
					// Anonymous blocks - collect into "items" array
					if (!Reflect.hasField(target, "items")) {
						Reflect.setField(target, "items", []);
					}
					var items:Array<Dynamic> = Reflect.field(target, "items");
					items.push(mapBlockToObject(childBlock));
				}
			} else if (Std.isOfType(child, OXFreeText)) {
				var freeText:OXFreeText = cast child;
				Reflect.setField(target, "content", freeText.content);
			}
		}

		var fields = Reflect.fields(target);

		// Process metadata-driven mapping (if any fields already exist)
		for (fieldName in fields) {
			var metadata = getFieldMetadata(target, fieldName);

			// Check for @:oxBlockId
			if (metadata.exists("oxBlockId")) {
				Reflect.setField(target, fieldName, block.id);
				continue;
			}

			// Check for @:oxProperty
			if (metadata.exists("oxProperty")) {
				var propertyName = metadata.get("oxProperty");
				if (propertyName == null || propertyName == "") {
					propertyName = fieldName;
				}

				if (block.properties.exists(propertyName)) {
					var value = convertValue(block.properties.get(propertyName), null);
					Reflect.setField(target, fieldName, value);
				}
				continue;
			}

			// Check for @:oxChild
			if (metadata.exists("oxChild")) {
				var blockId = metadata.get("oxChild");
				if (blockId == null || blockId == "") {
					blockId = toCamelCase(fieldName);
				}

				for (child in block.children) {
					if (Std.isOfType(child, OXBlock)) {
						var childBlock:OXBlock = cast child;
						if (childBlock.id != null && childBlock.id.toLowerCase() == blockId.toLowerCase()) {
							var childValue = mapBlockToObject(childBlock);
							Reflect.setField(target, fieldName, childValue);
							break;
						}
					}
				}
				continue;
			}

			// Check for @:oxChildren
			if (metadata.exists("oxChildren")) {
				var tagFilter = metadata.get("oxChildren");
				var children = [];

				for (child in block.children) {
					if (Std.isOfType(child, OXBlock)) {
						var childBlock:OXBlock = cast child;

						// Filter by tag if specified
						if (tagFilter != null && tagFilter != "") {
							var hasTag = false;
							for (tag in childBlock.tags) {
								if (tag.name == tagFilter) {
									hasTag = true;
									break;
								}
							}
							if (!hasTag)
								continue;
						}

						children.push(mapBlockToObject(childBlock));
					}
				}

				Reflect.setField(target, fieldName, children);
				continue;
			}

			// Check for @:oxFreeText
			if (metadata.exists("oxFreeText")) {
				for (child in block.children) {
					if (Std.isOfType(child, OXFreeText)) {
						var freeText:OXFreeText = cast child;
						Reflect.setField(target, fieldName, freeText.content);
						break;
					}
				}
				continue;
			}
		}

		return target;
	}

	private function convertValue(value:Dynamic, targetType:Null<Class<Dynamic>>):Dynamic {
		if (value == null)
			return null;

		// Handle arrays
		if (Std.isOfType(value, Array)) {
			return value;
		}

		// Direct assignment for matching types
		return value;
	}

	// ============================================================================
	// Reflection Helpers
	// ============================================================================

	private function getFieldMetadata(target:Dynamic, fieldName:String):Map<String, String> {
		var result = new Map<String, String>();

		#if js
		// In JS, check for runtime metadata
		var meta = untyped target.__meta__;
		if (meta != null && Reflect.hasField(meta, fieldName)) {
			var fieldMeta = Reflect.field(meta, fieldName);
			if (fieldMeta != null) {
				for (key in Reflect.fields(fieldMeta)) {
					var val = Reflect.field(fieldMeta, key);
					result.set(key, val != null ? Std.string(val) : "");
				}
			}
		}
		#end

		// For compile-time metadata, we'd need macro support
		// This is a simplified runtime implementation

		return result;
	}

	private function hasMetadata(target:Dynamic, fieldName:String):Bool {
		var metadata = getFieldMetadata(target, fieldName);
		return metadata.keys().hasNext();
	}

	private function getTagName(cls:Class<Dynamic>):Null<String> {
		#if js
		var meta = untyped cls.__meta__;
		if (meta != null && Reflect.hasField(meta, "oxTag")) {
			return Reflect.field(meta, "oxTag");
		}
		#end

		// Fallback: use class name
		var className = Type.getClassName(cls);
		var parts = className.split(".");
		return parts[parts.length - 1].toLowerCase();
	}

	private function findCaseInsensitiveField(target:Dynamic, name:String):Null<String> {
		var fields = Reflect.fields(target);
		var lowerName = name.toLowerCase();

		for (field in fields) {
			if (field.toLowerCase() == lowerName) {
				return field;
			}
		}

		// Try Pascal case conversion
		var pascalName = toPascalCase(name);
		for (field in fields) {
			if (field == pascalName) {
				return field;
			}
		}

		// Try camel case conversion
		var camelName = toCamelCase(name);
		for (field in fields) {
			if (field == camelName) {
				return field;
			}
		}

		return null;
	}

	private function findFieldByType(target:Dynamic, type:Class<Dynamic>):Null<String> {
		// Since Haxe's reflection doesn't provide type info at runtime easily,
		// we'll use a naming convention fallback
		var typeName = Type.getClassName(type);
		var parts = typeName.split(".");
		var shortName = parts[parts.length - 1];

		return findCaseInsensitiveField(target, shortName);
	}

	private function toPascalCase(input:String):String {
		if (input == null || input == "")
			return input;

		var parts = input.split("-");
		if (parts.length == 1)
			parts = input.split("_");

		var result = "";
		for (part in parts) {
			if (part.length > 0) {
				result += part.charAt(0).toUpperCase() + part.substr(1);
			}
		}

		return result;
	}

	private function toCamelCase(input:String):String {
		var pascal = toPascalCase(input);
		if (pascal == null || pascal == "")
			return pascal;

		return pascal.charAt(0).toLowerCase() + pascal.substr(1);
	}
}
