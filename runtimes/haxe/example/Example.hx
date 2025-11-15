import ox.*;

// ============================================================================
// Example usage of OX Haxe Runtime
// ============================================================================

class Example {
	static function main() {
		trace("=== OX Haxe Runtime Example ===\n");

		example1_BasicMapping();
		example2_Collections();
		example3_FreeText();
		example4_AutoMapping();
	}

	static function example1_BasicMapping() {
		trace("--- Example 1: Basic Property Mapping ---");

		var oxSource = '
[Player (name: "Hero", health: 100, maxHealth: 100)
    [Position (x: 10.5, y: 20.3, z: 0)]
]
';

		var mapper = new OXMapper();
		var config:GameConfig = mapper.parse(oxSource);

		trace('Player: ${config.player.name} (HP: ${config.player.health}/${config.player.maxHealth})');
		trace('Position: (${config.player.position.x}, ${config.player.position.y}, ${config.player.position.z})');
		trace("");
	}

	static function example2_Collections() {
		trace("--- Example 2: Collections with Anonymous Blocks ---");

		var oxSource = '
[Container (name: "ItemList")
    [ (value: 100, label: "Gold")]
    [ (value: 50, label: "Silver")]
    [ (value: 25, label: "Bronze")]
]
';

		var mapper = new OXMapper();
		var config:ContainerConfig = mapper.parse(oxSource);

		trace('Container: ${config.container.name}');
		trace('Items: ${config.container.items.length}');
		for (item in config.container.items) {
			trace('  - ${item.label}: ${item.value}');
		}
		trace("");
	}

	static function example3_FreeText() {
		trace("--- Example 3: Free Text Blocks ---");

		var oxSource = '
[Documentation (title: "User Guide", version: "1.0")
```
This is a comprehensive user guide for the application.

It supports multiple paragraphs and formatting.
```
]
';

		var mapper = new OXMapper();
		var config:DocConfig = mapper.parse(oxSource);

		trace('Title: ${config.documentation.title}');
		trace('Version: ${config.documentation.version}');
		trace('Content:\n${config.documentation.content}');
		trace("");
	}

	static function example4_AutoMapping() {
		trace("--- Example 4: Auto-Mapping (Convention Over Configuration) ---");

		var oxSource = '
[Settings (volume: 0.8, fullscreen: true, resolution: "1920x1080")]
';

		var mapper = new OXMapper();
		var config:SettingsConfig = mapper.parse(oxSource);

		trace('Settings: Volume=${config.settings.volume}, Fullscreen=${config.settings.fullscreen}, Resolution=${config.settings.resolution}');
		trace("");
	}
}

// ============================================================================
// Model Classes
// ============================================================================

typedef GameConfig = {
	var player:Player;
}

typedef Player = {
	var name:String;
	var health:Int;
	var maxHealth:Int;
	var position:Position;
}

typedef Position = {
	var x:Float;
	var y:Float;
	var z:Float;
}

// Collections
typedef ContainerConfig = {
	var container:Container;
}

typedef Container = {
	var name:String;
	var items:Array<Item>;
}

typedef Item = {
	var value:Int;
	var label:String;
}

// Free text
typedef DocConfig = {
	var documentation:Documentation;
}

typedef Documentation = {
	var title:String;
	var version:String;
	var content:String;
}

// Auto-mapping
typedef SettingsConfig = {
	var settings:Settings;
}

typedef Settings = {
	var volume:Float;
	var fullscreen:Bool;
	var resolution:String;
}
