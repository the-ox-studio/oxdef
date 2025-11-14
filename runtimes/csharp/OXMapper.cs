using System.Reflection;

namespace OX;

/// <summary>
/// Maps OX nodes to C# objects using attributes.
/// </summary>
public class OXMapper
{
    private readonly Dictionary<string, Type> _tagRegistry = new();
    private readonly Dictionary<Type, OXTagAttribute> _typeCache = new();

    /// <summary>
    /// Register a type for a specific tag name.
    /// </summary>
    public void RegisterTag<T>() where T : class
    {
        var attr = typeof(T).GetCustomAttribute<OXTagAttribute>();
        if (attr == null)
            throw new InvalidOperationException($"Type {typeof(T).Name} does not have OXTagAttribute");

        _tagRegistry[attr.TagName] = typeof(T);
        _typeCache[typeof(T)] = attr;
    }

    /// <summary>
    /// Parse OX source and map to typed object.
    /// </summary>
    public T Parse<T>(string source, string filename = "<input>") where T : class, new()
    {
        var parser = new OXParser(source, filename);
        var document = parser.Parse();
        return MapDocument<T>(document);
    }

    /// <summary>
    /// Parse OX file and map to typed object.
    /// </summary>
    public T ParseFile<T>(string path) where T : class, new()
    {
        var source = File.ReadAllText(path);
        return Parse<T>(source, path);
    }

    /// <summary>
    /// Map an OX document to a typed object.
    /// </summary>
    public T MapDocument<T>(OXDocument document) where T : class, new()
    {
        var result = new T();
        MapDocumentToObject(document, result);
        return result;
    }

    /// <summary>
    /// Map an OX tree (block) to a typed object.
    /// </summary>
    public T MapTree<T>(OXNode node) where T : class, new()
    {
        if (node is OXBlock block)
        {
            return MapBlock<T>(block);
        }

        throw new InvalidOperationException($"Cannot map {node.GetType().Name} to {typeof(T).Name}");
    }

    // ============================================================================
    // Mapping Implementation
    // ============================================================================

    private void MapDocumentToObject(OXDocument document, object target)
    {
        var targetType = target.GetType();
        var properties = targetType.GetProperties(BindingFlags.Public | BindingFlags.Instance);

        foreach (var block in document.Blocks.OfType<OXBlock>())
        {
            // Try to match by block ID to property name
            if (block.Id != null)
            {
                var propName = ToPascalCase(block.Id);
                var prop = properties.FirstOrDefault(p => p.Name.Equals(propName, StringComparison.OrdinalIgnoreCase));

                if (prop != null && prop.CanWrite)
                {
                    var value = MapBlockToProperty(block, prop.PropertyType);
                    prop.SetValue(target, value);
                    continue;
                }
            }

            // Try to match by tag
            foreach (var tag in block.Tags.Where(t => t.Type == OXTagType.Declaration))
            {
                if (_tagRegistry.TryGetValue(tag.Name, out var tagType))
                {
                    var prop = properties.FirstOrDefault(p => p.PropertyType == tagType ||
                        (p.PropertyType.IsGenericType && p.PropertyType.GetGenericArguments()[0] == tagType));

                    if (prop != null && prop.CanWrite)
                    {
                        var value = MapBlockToProperty(block, prop.PropertyType);
                        prop.SetValue(target, value);
                        break;
                    }
                }
            }
        }
    }

    private T MapBlock<T>(OXBlock block) where T : class, new()
    {
        var result = new T();
        MapBlockToObject(block, result);
        return result;
    }

    private object? MapBlockToProperty(OXBlock block, Type targetType)
    {
        // Handle nullable types
        var underlyingType = Nullable.GetUnderlyingType(targetType);
        if (underlyingType != null)
        {
            return MapBlockToProperty(block, underlyingType);
        }

        // Handle collections
        if (targetType.IsGenericType)
        {
            var genericDef = targetType.GetGenericTypeDefinition();
            if (genericDef == typeof(List<>) || genericDef == typeof(IList<>) || genericDef == typeof(IEnumerable<>))
            {
                var elementType = targetType.GetGenericArguments()[0];
                var listType = typeof(List<>).MakeGenericType(elementType);
                var list = Activator.CreateInstance(listType)!;
                var addMethod = listType.GetMethod("Add")!;

                // Map child blocks
                foreach (var child in block.Children.OfType<OXBlock>())
                {
                    var element = MapBlockToProperty(child, elementType);
                    addMethod.Invoke(list, new[] { element });
                }

                return list;
            }
        }

        // Handle single object
        var instance = Activator.CreateInstance(targetType)!;
        MapBlockToObject(block, instance);
        return instance;
    }

    private void MapBlockToObject(OXBlock block, object target)
    {
        var targetType = target.GetType();
        var properties = targetType.GetProperties(BindingFlags.Public | BindingFlags.Instance);

        foreach (var prop in properties)
        {
            if (!prop.CanWrite) continue;

            // Check for OXBlockId attribute
            if (prop.GetCustomAttribute<OXBlockIdAttribute>() != null)
            {
                if (prop.PropertyType == typeof(string))
                {
                    prop.SetValue(target, block.Id);
                }
                continue;
            }

            // Check for OXProperty attribute
            var oxProp = prop.GetCustomAttribute<OXPropertyAttribute>();
            if (oxProp != null)
            {
                if (block.Properties.TryGetValue(oxProp.PropertyName, out var value))
                {
                    var convertedValue = ConvertValue(value, prop.PropertyType);
                    prop.SetValue(target, convertedValue);
                }
                continue;
            }

            // Check for OXChild attribute
            var oxChild = prop.GetCustomAttribute<OXChildAttribute>();
            if (oxChild != null)
            {
                var blockId = oxChild.BlockId ?? ToCamelCase(prop.Name);
                var childBlock = block.Children.OfType<OXBlock>()
                    .FirstOrDefault(b => b.Id?.Equals(blockId, StringComparison.OrdinalIgnoreCase) == true);

                if (childBlock != null)
                {
                    var childValue = MapBlockToProperty(childBlock, prop.PropertyType);
                    prop.SetValue(target, childValue);
                }
                continue;
            }

            // Check for OXChildren attribute
            var oxChildren = prop.GetCustomAttribute<OXChildrenAttribute>();
            if (oxChildren != null)
            {
                var children = block.Children.OfType<OXBlock>();

                // Filter by tag if specified
                if (oxChildren.TagFilter != null)
                {
                    children = children.Where(b => b.Tags.Any(t => t.Name == oxChildren.TagFilter));
                }

                var value = MapChildrenToCollection(children, prop.PropertyType);
                prop.SetValue(target, value);
                continue;
            }

            // Check for OXFreeText attribute
            var oxFreeText = prop.GetCustomAttribute<OXFreeTextAttribute>();
            if (oxFreeText != null)
            {
                var freeText = block.Children.OfType<OXFreeText>().FirstOrDefault();
                if (freeText != null && prop.PropertyType == typeof(string))
                {
                    prop.SetValue(target, freeText.Content);
                }
                continue;
            }

            // Auto-map by convention: try to find property in block properties
            var propNameLower = prop.Name.ToLowerInvariant();
            var propNameCamel = ToCamelCase(prop.Name);

            if (block.Properties.TryGetValue(propNameCamel, out var autoValue) ||
                block.Properties.TryGetValue(propNameLower, out autoValue) ||
                block.Properties.TryGetValue(prop.Name, out autoValue))
            {
                var convertedValue = ConvertValue(autoValue, prop.PropertyType);
                prop.SetValue(target, convertedValue);
                continue;
            }

            // Auto-map child block by name
            var childBlockAuto = block.Children.OfType<OXBlock>()
                .FirstOrDefault(b => b.Id?.Equals(prop.Name, StringComparison.OrdinalIgnoreCase) == true);

            if (childBlockAuto != null)
            {
                var childValue = MapBlockToProperty(childBlockAuto, prop.PropertyType);
                prop.SetValue(target, childValue);
            }
        }
    }

    private object? MapChildrenToCollection(IEnumerable<OXBlock> children, Type collectionType)
    {
        if (!collectionType.IsGenericType)
            throw new InvalidOperationException($"Cannot map children to non-generic type {collectionType.Name}");

        var elementType = collectionType.GetGenericArguments()[0];
        var listType = typeof(List<>).MakeGenericType(elementType);
        var list = Activator.CreateInstance(listType)!;
        var addMethod = listType.GetMethod("Add")!;

        foreach (var child in children)
        {
            var element = MapBlockToProperty(child, elementType);
            addMethod.Invoke(list, new[] { element });
        }

        return list;
    }

    private object? ConvertValue(object? value, Type targetType)
    {
        if (value == null)
            return null;

        var underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;

        // Handle enums
        if (underlyingType.IsEnum)
        {
            if (value is string strValue)
                return Enum.Parse(underlyingType, strValue, ignoreCase: true);
            return Enum.ToObject(underlyingType, value);
        }

        // Handle direct assignment
        if (underlyingType.IsAssignableFrom(value.GetType()))
            return value;

        // Handle numeric conversions
        if (value is long longValue)
        {
            if (underlyingType == typeof(int)) return (int)longValue;
            if (underlyingType == typeof(short)) return (short)longValue;
            if (underlyingType == typeof(byte)) return (byte)longValue;
            if (underlyingType == typeof(long)) return longValue;
            if (underlyingType == typeof(double)) return (double)longValue;
            if (underlyingType == typeof(float)) return (float)longValue;
        }

        if (value is double doubleValue)
        {
            if (underlyingType == typeof(float)) return (float)doubleValue;
            if (underlyingType == typeof(double)) return doubleValue;
        }

        // Use Convert as fallback
        try
        {
            return Convert.ChangeType(value, underlyingType);
        }
        catch
        {
            throw new InvalidOperationException($"Cannot convert {value.GetType().Name} to {targetType.Name}");
        }
    }

    private string ToPascalCase(string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        var parts = input.Split(new[] { '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(parts.Select(p => char.ToUpperInvariant(p[0]) + p.Substring(1)));
    }

    private string ToCamelCase(string input)
    {
        var pascal = ToPascalCase(input);
        if (string.IsNullOrEmpty(pascal))
            return pascal;

        return char.ToLowerInvariant(pascal[0]) + pascal.Substring(1);
    }
}
