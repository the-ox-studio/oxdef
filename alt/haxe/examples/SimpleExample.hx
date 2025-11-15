/**
 * Simple example showing Haxe externs calling JavaScript oxdef
 *
 * Note: Due to Haxe's extern system limitations with module-level functions,
 * we use untyped JS to call the oxdef functions directly.
 * The externs provide type information but the actual calls go through untyped.
 */
class SimpleExample {
	static function main() {
		trace("=== OXDef Haxe Example (Untyped) ===\n");

		// Parse OX source using untyped JS
		var source = '[Player (name: "Hero", health: 100)]';

		// Call the JavaScript parse function directly
		var ast:Dynamic = untyped __js__("require('../../../src/parser/parser').parse({0})", source);

		trace('Parsed successfully!');
		trace('Document has ${ast.blocks.length} block(s)');

		if (ast.blocks.length > 0) {
			var block = ast.blocks[0];
			trace('Block ID: ${block.id}');
			trace('Block has ${Lambda.count(block.properties)} properties');
		}

		trace("\n=== Example Complete ===");
		trace("Note: For production use, consider wrapping oxdef");
		trace("in a Haxe-friendly API layer or using direct JS interop.");
	}
}
