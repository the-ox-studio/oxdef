namespace OX;

/// <summary>
/// Marks a class as mappable to an OX tag type.
/// </summary>
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
public class OXTagAttribute : Attribute
{
    public string TagName { get; }
    public string[]? Arguments { get; }

    public OXTagAttribute(string tagName, string[]? arguments = null)
    {
        TagName = tagName;
        Arguments = arguments;
    }
}

/// <summary>
/// Maps a property to an OX property.
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class OXPropertyAttribute : Attribute
{
    public string PropertyName { get; }

    public OXPropertyAttribute(string propertyName)
    {
        PropertyName = propertyName;
    }
}

/// <summary>
/// Maps a property to a child block by ID.
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class OXChildAttribute : Attribute
{
    public string? BlockId { get; }

    public OXChildAttribute(string? blockId = null)
    {
        BlockId = blockId;
    }
}

/// <summary>
/// Maps a property to all child blocks (for collections).
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class OXChildrenAttribute : Attribute
{
    public string? TagFilter { get; }

    public OXChildrenAttribute(string? tagFilter = null)
    {
        TagFilter = tagFilter;
    }
}

/// <summary>
/// Maps a property to free text content.
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class OXFreeTextAttribute : Attribute
{
}

/// <summary>
/// Maps a property to the block's ID.
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class OXBlockIdAttribute : Attribute
{
}
