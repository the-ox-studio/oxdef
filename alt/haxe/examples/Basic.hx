import oxdef.Parser;
import oxdef.AST;
import oxdef.Tokenizer;

class Basic {
	static function main() {
		trace("=== OXDef Haxe Example ===\n");

		// Example 1: Parse simple OX code
		var source = '[Player (name: "Hero", health: 100)]';
		trace('Parsing: $source');

		try {
			var ast = ParserModule.parse(source, "example.ox");
			trace('Parsed successfully!');
			trace('AST type: ${ast.type}');
			trace('Number of blocks: ${ast.blocks.length}');

			if (ast.blocks.length > 0) {
				var firstBlock:BlockNode = cast ast.blocks[0];
				trace('First block name: ${firstBlock.name}');
				trace('First block children: ${firstBlock.children.length}');
			}
		} catch (e:Dynamic) {
			trace('Error parsing: $e');
		}

		trace("\n=== Example Complete ===");
	}
}
