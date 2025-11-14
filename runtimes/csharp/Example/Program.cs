using OX;

// ============================================================================
// Example 1: Basic Type Mapping with Attributes
// ============================================================================

Console.WriteLine("=== OX C# Runtime Example ===\n");

Example1_BasicMapping();
Example2_TagMapping();
Example3_Collections();
Example4_FreeText();
Example5_AutoMapping();

static void Example1_BasicMapping()
{
    Console.WriteLine("--- Example 1: Basic Property Mapping ---");

    var oxSource = """
    [Player (name: "Hero", health: 100, maxHealth: 100)
        [Position (x: 10.5, y: 20.3, z: 0)]
    ]
    """;

    var mapper = new OXMapper();
    var config = mapper.Parse<GameConfig>(oxSource);

    Console.WriteLine($"Player: {config.Player.Name} (HP: {config.Player.Health}/{config.Player.MaxHealth})");
    Console.WriteLine($"Position: ({config.Player.Position.X}, {config.Player.Position.Y}, {config.Player.Position.Z})");
    Console.WriteLine();
}

static void Example2_TagMapping()
{
    Console.WriteLine("--- Example 2: Tag-Based Mapping ---");

    var oxSource = """
    @button
    [MyButton (text: "Click Me", x: 100, y: 50)]

    @panel
    [Container (width: 800, height: 600)]
    """;

    var mapper = new OXMapper();
    mapper.RegisterTag<Button>();
    mapper.RegisterTag<Panel>();

    var ui = mapper.Parse<UIConfig>(oxSource);

    Console.WriteLine($"Button: '{ui.Button?.Text}' at ({ui.Button?.X}, {ui.Button?.Y})");
    Console.WriteLine($"Panel: {ui.Panel?.Width}x{ui.Panel?.Height}");
    Console.WriteLine();
}

static void Example3_Collections()
{
    Console.WriteLine("--- Example 3: Collections with Anonymous Blocks ---");

    var oxSource = """
    [Container (name: "ItemList")
        [ (value: 100, label: "Gold")]
        [ (value: 50, label: "Silver")]
        [ (value: 25, label: "Bronze")]
    ]
    """;

    var mapper = new OXMapper();
    var config = mapper.Parse<ContainerConfig>(oxSource);

    Console.WriteLine($"Container: {config.Container.Name}");
    Console.WriteLine($"Items: {config.Container.Items.Count}");
    foreach (var item in config.Container.Items)
    {
        Console.WriteLine($"  - {item.Label}: {item.Value}");
    }
    Console.WriteLine();
}

static void Example4_FreeText()
{
    Console.WriteLine("--- Example 4: Free Text Blocks ---");

    var oxSource = """
    [Documentation (title: "User Guide", version: "1.0")
    ```
    This is a comprehensive user guide for the application.

    It supports multiple paragraphs and formatting.
    ```
    ]
    """;

    var mapper = new OXMapper();
    var config = mapper.Parse<DocConfig>(oxSource);

    Console.WriteLine($"Title: {config.Documentation.Title}");
    Console.WriteLine($"Version: {config.Documentation.Version}");
    Console.WriteLine($"Content:\n{config.Documentation.Content}");
    Console.WriteLine();
}

static void Example5_AutoMapping()
{
    Console.WriteLine("--- Example 5: Auto-Mapping (Convention Over Configuration) ---");

    var oxSource = """
    [Settings (volume: 0.8, fullscreen: true, resolution: "1920x1080")]
    """;

    var mapper = new OXMapper();
    var config = mapper.Parse<SettingsConfig>(oxSource);

    Console.WriteLine($"Settings: Volume={config.Settings.Volume}, Fullscreen={config.Settings.Fullscreen}, Resolution={config.Settings.Resolution}");
    Console.WriteLine();
}

// ============================================================================
// Model Classes
// ============================================================================

class GameConfig
{
    public Player Player { get; set; } = new();
}

class Player
{
    [OXProperty("name")]
    public string Name { get; set; } = "";

    [OXProperty("health")]
    public int Health { get; set; }

    [OXProperty("maxHealth")]
    public int MaxHealth { get; set; }

    [OXChild("Position")]
    public Position Position { get; set; } = new();
}

class Position
{
    [OXProperty("x")]
    public double X { get; set; }

    [OXProperty("y")]
    public double Y { get; set; }

    [OXProperty("z")]
    public double Z { get; set; }
}

// Tag-based mapping
class UIConfig
{
    public Button? Button { get; set; }
    public Panel? Panel { get; set; }
}

[OXTag("button")]
class Button
{
    [OXProperty("text")]
    public string Text { get; set; } = "";

    [OXProperty("x")]
    public int X { get; set; }

    [OXProperty("y")]
    public int Y { get; set; }
}

[OXTag("panel")]
class Panel
{
    [OXProperty("width")]
    public int Width { get; set; }

    [OXProperty("height")]
    public int Height { get; set; }
}

// Collections
class ContainerConfig
{
    public Container Container { get; set; } = new();
}

class Container
{
    [OXProperty("name")]
    public string Name { get; set; } = "";

    [OXChildren]
    public List<Item> Items { get; set; } = new();
}

class Item
{
    [OXProperty("value")]
    public int Value { get; set; }

    [OXProperty("label")]
    public string Label { get; set; } = "";
}

// Free text
class DocConfig
{
    public Documentation Documentation { get; set; } = new();
}

class Documentation
{
    [OXProperty("title")]
    public string Title { get; set; } = "";

    [OXProperty("version")]
    public string Version { get; set; } = "";

    [OXFreeText]
    public string Content { get; set; } = "";
}

// Auto-mapping (no attributes needed!)
class SettingsConfig
{
    public Settings Settings { get; set; } = new();
}

class Settings
{
    // These will auto-map from properties with matching names
    public double Volume { get; set; }
    public bool Fullscreen { get; set; }
    public string Resolution { get; set; } = "";
}
