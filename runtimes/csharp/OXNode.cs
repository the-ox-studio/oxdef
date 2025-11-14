namespace OX;

/// <summary>
/// Represents any node in the OX document tree.
/// </summary>
public abstract class OXNode
{
    public OXLocation Location { get; set; } = new();
}

/// <summary>
/// Represents the root document node.
/// </summary>
public class OXDocument : OXNode
{
    public List<OXNode> Blocks { get; set; } = new();
}

/// <summary>
/// Represents a block with optional ID, properties, children, and tags.
/// </summary>
public class OXBlock : OXNode
{
    public string? Id { get; set; }
    public Dictionary<string, object?> Properties { get; set; } = new();
    public List<OXNode> Children { get; set; } = new();
    public List<OXTag> Tags { get; set; } = new();
}

/// <summary>
/// Represents free text content.
/// </summary>
public class OXFreeText : OXNode
{
    public string Content { get; set; } = string.Empty;
    public List<OXTag> Tags { get; set; } = new();
}

/// <summary>
/// Represents a tag (declaration or instance).
/// </summary>
public class OXTag
{
    public OXTagType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Argument { get; set; }
}

/// <summary>
/// Tag type: Declaration (@) or Instance (#).
/// </summary>
public enum OXTagType
{
    Declaration,
    Instance
}

/// <summary>
/// Location information for error reporting.
/// </summary>
public class OXLocation
{
    public string File { get; set; } = "<input>";
    public int Line { get; set; } = 1;
    public int Column { get; set; } = 1;
}
