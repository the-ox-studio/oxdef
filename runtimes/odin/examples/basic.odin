package main

import "core:fmt"
import ox ".."

// Example struct that matches OX document structure
GameConfig :: struct {
    player: Player,
    world: World,
    settings: Settings,
}

Player :: struct {
    name: string,
    health: f64,
    max_health: f64,
    position: Position,
}

Position :: struct {
    x: f64,
    y: f64,
    z: f64,
}

World :: struct {
    name: string,
    seed: f64,
    difficulty: string,
    spawn_point: Position,
}

Settings :: struct {
    volume: f64,
    fullscreen: bool,
    resolution: string,
}

// Example with free text - note: needs wrapper struct at document level
DocConfig :: struct {
    documentation: Documentation,
}

Documentation :: struct {
    title: string,
    version: string,
    free_text: string,
}

// Example with anonymous blocks - note: needs wrapper struct at document level
ContainerConfig :: struct {
    container: Container,
}

Container :: struct {
    name: string,
    children: [dynamic]Item,
}

Item :: struct {
    value: f64,
    label: string,
}

main :: proc() {
    fmt.println("=== OX Runtime Example ===\n")

    // Example 1: Parse OX string with type mapping
    example_parse_map()

    // Example 2: Tree walking
    example_tree_walk()

    // Example 3: Tag handlers
    example_tag_handlers()

    // Example 4: Free text blocks
    example_free_text()

    // Example 5: Anonymous blocks
    example_anonymous_blocks()
}

example_parse_map :: proc() {
    fmt.println("--- Example 1: Type Mapping ---")

    ox_source := `
[Player (name: "Hero", health: 100, max_health: 100)
    [Position (x: 10.5, y: 20.3, z: 0)]
]

[World (name: "Overworld", seed: 12345, difficulty: "Normal")
    [SpawnPoint (x: 0, y: 64, z: 0)]
]

[Settings (volume: 0.8, fullscreen: true, resolution: "1920x1080")]
`

    doc, ok := ox.parse_string(ox_source)
    if !ok {
        fmt.eprintln("Failed to parse OX source")
        return
    }

    // Map to typed struct
    config, map_ok := ox.parse_map(doc, GameConfig)
    if !map_ok {
        fmt.eprintln("Failed to map to GameConfig")
        return
    }

    // Print results
    fmt.printf("Player: %s (HP: %.0f/%.0f)\n", config.player.name, config.player.health, config.player.max_health)
    fmt.printf("Position: (%.1f, %.1f, %.1f)\n", config.player.position.x, config.player.position.y, config.player.position.z)
    fmt.printf("World: %s (Seed: %.0f, Difficulty: %s)\n", config.world.name, config.world.seed, config.world.difficulty)
    fmt.printf("Spawn: (%.1f, %.1f, %.1f)\n", config.world.spawn_point.x, config.world.spawn_point.y, config.world.spawn_point.z)
    fmt.printf("Settings: Volume=%.1f, Fullscreen=%v, Resolution=%s\n", config.settings.volume, config.settings.fullscreen, config.settings.resolution)
    fmt.println()
}

example_tree_walk :: proc() {
    fmt.println("--- Example 2: Tree Walking ---")

    ox_source := `
[Root
    [Child1 (value: 10)]
    [Child2 (value: 20)
        [GrandChild (value: 30)]
    ]
]
`

    doc, ok := ox.parse_string(ox_source)
    if !ok {
        fmt.eprintln("Failed to parse OX source")
        return
    }

    // Walk the tree
    walk_visitor :: proc(node: ^ox.OXNode, parent: ^ox.OXNode, user_data: rawptr) {
        #partial switch v in node.variant {
        case ox.OXBlock:
            if id, has_id := v.id.?; has_id {
                fmt.printf("Block: %s\n", id)
                if "value" in v.properties {
                    val := v.properties["value"]
                    fmt.printf("  value = %v\n", val)
                }
            }
        }
    }

    ox.parse_walk(doc, walk_visitor)
    fmt.println()
}

example_tag_handlers :: proc() {
    fmt.println("--- Example 3: Tag Handlers ---")

    ox_source := `
@uppercase
[Message (text: "hello world")]
`

    doc, ok := ox.parse_string(ox_source)
    if !ok {
        fmt.eprintln("Failed to parse OX source")
        return
    }

    // Create interpreter with tag handler
    interp := ox.interp_init()
    defer ox.interp_destroy(&interp)

    // Register uppercase tag handler
    uppercase_handler :: proc(node: ^ox.OXNode, tag: ox.OXTag, user_data: rawptr) -> ox.TagResult {
        if block, is_block := node.variant.(ox.OXBlock); is_block {
            // Transform text property to uppercase
            if "text" in block.properties {
                text_prop := block.properties["text"]
                if text, is_str := text_prop.(string); is_str {
                    // In real implementation, would modify the node
                    fmt.printf("Uppercase handler called on: %s\n", text)
                    return true
                }
            }
        }
        return true
    }

    ox.interp_register_tag(&interp, "uppercase", uppercase_handler)

    // Process tags
    // Note: In full implementation, would use parse_map_with_interp
    fmt.println("Tag processing complete")
    fmt.println()
}

example_free_text :: proc() {
    fmt.println("--- Example 4: Free Text Blocks ---")

    ox_source := `
[Documentation (title: "User Guide", version: "1.0")
` + "```" + `
This is a comprehensive user guide for the application.

It supports multiple paragraphs and formatting.
` + "```" + `
]
`

    doc, ok := ox.parse_string(ox_source)
    if !ok {
        fmt.eprintln("Failed to parse OX source")
        return
    }

    // Map to struct with free_text field
    doc_config, map_ok := ox.parse_map(doc, DocConfig)
    if !map_ok {
        fmt.eprintln("Failed to map to DocConfig")
        return
    }

    fmt.printf("Title: %s\n", doc_config.documentation.title)
    fmt.printf("Version: %s\n", doc_config.documentation.version)
    fmt.printf("Content:\n%s\n", doc_config.documentation.free_text)
    fmt.println()
}

example_anonymous_blocks :: proc() {
    fmt.println("--- Example 5: Anonymous Blocks ---")

    ox_source := `
[Container (name: "ItemList")
    [ (value: 100, label: "Gold")]
    [ (value: 50, label: "Silver")]
    [ (value: 25, label: "Bronze")]
]
`

    doc, ok := ox.parse_string(ox_source)
    if !ok {
        fmt.eprintln("Failed to parse OX source")
        return
    }

    // Map to struct with children field
    container_config, map_ok := ox.parse_map(doc, ContainerConfig)
    if !map_ok {
        fmt.eprintln("Failed to map to ContainerConfig")
        return
    }

    fmt.printf("Container: %s\n", container_config.container.name)
    fmt.printf("Items: %d\n", len(container_config.container.children))
    for item, i in container_config.container.children {
        fmt.printf("  [%d] %s: %.0f\n", i, item.label, item.value)
    }
    fmt.println()
}
