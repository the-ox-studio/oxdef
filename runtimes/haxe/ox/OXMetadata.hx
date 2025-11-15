package ox;

/**
 * Metadata for marking a class as mappable to an OX tag type.
 * Usage: @:oxTag("button")
 */
@:autoBuild(ox.OXMetadata.buildTag())
@:remove
@:noCompletion
extern class OXTag_ {}

/**
 * Metadata for mapping a field to an OX property.
 * Usage: @:oxProperty("name")
 */
@:remove
@:noCompletion
extern class OXProperty_ {}

/**
 * Metadata for mapping a field to a child block by ID.
 * Usage: @:oxChild("Position") or @:oxChild
 */
@:remove
@:noCompletion
extern class OXChild_ {}

/**
 * Metadata for mapping a field to all child blocks (for collections).
 * Usage: @:oxChildren or @:oxChildren("button")
 */
@:remove
@:noCompletion
extern class OXChildren_ {}

/**
 * Metadata for mapping a field to free text content.
 * Usage: @:oxFreeText
 */
@:remove
@:noCompletion
extern class OXFreeText_ {}

/**
 * Metadata for mapping a field to the block's ID.
 * Usage: @:oxBlockId
 */
@:remove
@:noCompletion
extern class OXBlockId_ {}

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;

class OXMetadata {
	public static function buildTag():Array<Field> {
		var fields = Context.getBuildFields();
		// This is a placeholder for potential macro processing
		// For now, we'll handle metadata through reflection at runtime
		return fields;
	}
}
#end
