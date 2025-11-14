# OX Runtime Interpreter System

## Overview

The OX runtime interpreter system provides a flexible, event-driven approach to transforming parsed OX data structures. The interpreter operates in the **interpretation phase** of OX's three-phase architecture (authoring → preprocessing → interpretation), after the OX parser has resolved all templates, expressions, and data sources into pure data structures.

This system is designed around the principle of **user-controlled interpretation** with zero runtime overhead for unused features. The core runtime handles parsing and expression evaluation, while interpretation logic is provided through composable handlers—either built-in addons or custom user code.

## Architecture

### Core Components

1. **OXParser** - Parses .ox files into data structures, evaluates expressions
2. **OXInterpreter** - Event-driven system for tag-based transformation
3. **OXAddons** - Optional built-in handlers (HTML, markdown, interpolation, etc.)
4. **OXContext** - Wrapper class providing utilities and access to node data
5. **User Handlers** - Domain-specific interpretation logic

### Separation of Concerns

```
┌─────────────────────────────────────────────┐
│  OXParser (Core Runtime)                    │
│  - Parse .ox files                          │
│  - Evaluate expressions                     │
│  - Build data structure                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  OXInterpreter (Event System)               │
│  - Tag-based routing                        │
│  - Handler registration                     │
│  - Tree transformation                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Handlers (Addons + User Code)              │
│  - OXAddons.parseHtml                       │
│  - OXAddons.parseMarkdown                   │
│  - Custom domain logic                      │
└─────────────────────────────────────────────┘
```

## Basic Usage

### Tree Execution Model

The tree execution model transforms the entire parsed OX structure, building a complete interpreted tree:

```haxe
// Parse OX file
var parser = new OXParser();
var data = parser.parseFile("path/to/file.ox");

// Create interpreter and register handlers
var interpreter = new OXInterpreter();

// Use built-in addon
interpreter.on("html", OXAddons.parseHtml);

// Custom handler
interpreter.on("component", (tagArgs, block, context) -> {
  var componentName = tagArgs[0];
  return renderComponent(componentName, block, context);
});

// Execute full tree transformation
var finalTree = interpreter.execute(data);
```

**Use tree execution when:**
- You need the complete interpreted structure
- Loading game data or configuration
- Building a complete document or UI tree
- Memory usage is not a concern

### On-the-Fly Execution Model

The on-the-fly model processes nodes during traversal without building a complete transformed tree:

```haxe
var parser = new OXParser();
var data = parser.parseFile("path/to/file.ox");

var interpreter = new OXInterpreter();
interpreter.on("stream-event", processStreamEvent);
interpreter.on("html", OXAddons.parseHtml);

// Walk and process on-the-fly
parser.walk(data, {
  visit: (node, parent) -> {
    var result = interpreter.executeBlock(node);
    
    // Process immediately
    if (node.hasTag("stream-event")) {
      handleEvent(result);
      return null; // Don't keep in tree
    }
    
    return result;
  }
});
```

**Use on-the-fly execution when:**
- Processing large files
- Streaming data
- Memory constraints are important
- You don't need to retain the full tree

## OXInterpreter API

### Core Methods

```haxe
class OXInterpreter {
  /**
   * Register a handler for a specific tag name.
   * 
   * @param tagName The name of the tag to handle (without @ symbol)
   * @param handler Function to process nodes with this tag
   */
  public function on(tagName: String, handler: TagHandler): Void;
  
  /**
   * Execute full tree transformation.
   * 
   * @param data The parsed OX data structure
   * @param context Optional user-provided context data
   * @return Transformed OX tree
   */
  public function execute(data: OXNode, ?context: Dynamic): OXNode;
  
  /**
   * Execute interpretation for a single block.
   * 
   * @param block The block to interpret
   * @param context Execution context
   * @return Interpreted result (String, OXNode, or null)
   */
  public function executeBlock(block: OXBlock, context: OXContext): Dynamic;
  
  /**
   * Register a fallback handler for unhandled tags.
   * 
   * @param handler Function to handle tags without registered handlers
   */
  public function onUnhandled(handler: TagHandler): Void;
}
```

### Handler Signature

```haxe
typedef TagHandler = (
  tagArgs: Array<Dynamic>,
  block: OXBlock,
  context: OXContext
) -> Dynamic;
```

### Handler Return Types

Handlers can return different types to control transformation behavior:

- **String** - Replaces the block content with the returned string
- **OXNode** - Replaces the entire node with the returned node
- **null** - Removes the node from the tree
- **void/undefined** - Keeps the node unchanged

```haxe
// Replace block content
interpreter.on("template", (tagArgs, block, context) -> {
  return renderTemplate(block.text, context.data);
});

// Replace entire node
interpreter.on("include", (tagArgs, block, context) -> {
  var filePath = tagArgs[0];
  return parser.parseFile(filePath);
});

// Remove node
interpreter.on("comment", (tagArgs, block, context) -> {
  return null; // Don't include comments in output
});

// Keep unchanged
interpreter.on("debug", (tagArgs, block, context) -> {
  trace('Debug: ${block.text}');
  // Return nothing, node stays as-is
});
```

## OXContext

The context object provides utilities and access to node data during interpretation:

```haxe
class OXContext {
  /**
   * Current OXNode being processed
   */
  public var node: OXNode;
  
  /**
   * Parent node (null if root)
   */
  public var parent: Null<OXNode>;
  
  /**
   * All tags on the current node
   */
  public var tags: Array<OXTag>;
  
  /**
   * All properties on the current node
   */
  public var properties: Map<String, Dynamic>;
  
  /**
   * User-provided data passed to execute()
   */
  public var data: Dynamic;
  
  /**
   * Evaluate an OX expression in the current context
   */
  public function evaluate(expr: String): Dynamic;
  
  /**
   * Find blocks matching a criteria (utility for interpolation)
   */
  public function findBlocks(predicate: OXBlock -> Bool): Array<OXBlock>;
  
  /**
   * Find child nodes matching criteria
   */
  public function findChildren(predicate: OXNode -> Bool): Array<OXNode>;
  
  /**
   * Get the value of a specific tag argument
   */
  public function getTagArg(tagName: String, argIndex: Int): Dynamic;
  
  /**
   * Check if node has a specific tag
   */
  public function hasTag(tagName: String): Bool;
  
  /**
   * Get property value with optional default
   */
  public function getProperty(name: String, ?defaultValue: Dynamic): Dynamic;
}
```

## Built-in Addons

The `OXAddons` class provides common interpretation handlers. These are **separate from the core runtime** and optional—users only include what they need.

### OXAddons.interpolate

Basic string interpolation using `${expr}` syntax:

```haxe
interpreter.on("text", OXAddons.interpolate);
```

**Example:**
```ox
@text [
  greeting (name: "Alice")
  ```Hello ${name}! Welcome to ${site.title}.```
]
```

### OXAddons.parseHtml

Interprets blocks as HTML with expression interpolation and optional sanitization:

```haxe
interpreter.on("html", OXAddons.parseHtml);
```

**Example:**
```ox
@html [
  content (sanitize: true)
  ```<p>Welcome to ${site.title}</p>```
]
```

**Options via properties:**
- `sanitize: bool` - Enable HTML sanitization
- `escapeVars: bool` - Auto-escape interpolated variables

### OXAddons.parseMarkdown

Converts markdown blocks to HTML:

```haxe
interpreter.on("markdown", OXAddons.parseMarkdown);
```

**Example:**
```ox
@markdown [
  doc
  ```
  # Title
  
  This is **bold** text with ${dynamicContent}.
  ```
]
```

### Creating Custom Addons

Users can create their own addon modules following the same pattern:

```haxe
class MyGameAddons {
  public static function parseDialogue(tagArgs, block, context): String {
    var speaker = context.getProperty("speaker", "Unknown");
    var emotion = context.getProperty("emotion", "neutral");
    
    var text = OXAddons.interpolate(tagArgs, block, context);
    
    return '{
      "speaker": "${speaker}",
      "emotion": "${emotion}",
      "text": "${text}"
    }';
  }
  
  public static function parseQuest(tagArgs, block, context): OXNode {
    // Parse quest data format
    // Return structured node
  }
}

// Usage
interpreter.on("dialogue", MyGameAddons.parseDialogue);
interpreter.on("quest", MyGameAddons.parseQuest);
```

## Common Patterns

### Tag-Driven Interpretation

Different tags trigger different interpretation logic:

```ox
@html [
  content
  ```<div class="${className}">${content}</div>```
]

@markdown [
  docs
  ```# ${title}

  ${description}```
]

@component [
  navbar (items: [...])
  ```Navigation items: ${items}```
]
```

```haxe
interpreter.on("html", OXAddons.parseHtml);
interpreter.on("markdown", OXAddons.parseMarkdown);
interpreter.on("component", (tagArgs, block, context) -> {
  var componentName = tagArgs[0];
  return componentRegistry.render(componentName, context);
});
```

### Conditional Interpretation

Use tag arguments to control interpretation behavior:

```ox
@block [
  content (format: "html", sanitize: true)
  ```${userContent}```
]
```

```haxe
interpreter.on("block", (tagArgs, block, context) -> {
  var format = context.getProperty("format", "text");
  var sanitize = context.getProperty("sanitize", false);
  
  var result = switch (format) {
    case "html": parseAsHtml(block.text);
    case "markdown": parseAsMarkdown(block.text);
    default: block.text;
  };
  
  return sanitize ? sanitizeOutput(result) : result;
});
```

### Nested Interpretation

Process parent blocks after children are interpreted:

```ox
@layout [
  page
  ```
  <header>${header}</header>
  <main>${content}</main>
  ```
]

@html [header ```<h1>Title</h1>```]
@html [content ```<p>Content here</p>```]
```

```haxe
// Children are interpreted first automatically
interpreter.on("layout", (tagArgs, block, context) -> {
  // At this point, child @html blocks are already processed
  var text = OXAddons.interpolate(tagArgs, block, context);
  return wrapInLayout(text);
});

interpreter.on("html", OXAddons.parseHtml);
```

### Context Data Passing

Pass runtime data through the context:

```haxe
var gameData = {
  player: { name: "Hero", level: 10 },
  quest: { title: "Save the Kingdom" }
};

var finalTree = interpreter.execute(data, gameData);
```

Access in handlers:

```haxe
interpreter.on("player-info", (tagArgs, block, context) -> {
  var player = context.data.player;
  return 'Player: ${player.name} (Level ${player.level})';
});
```

### Fallback Handling

Handle unknown tags gracefully:

```haxe
interpreter.onUnhandled((tagName, tagArgs, block, context) -> {
  // Log warning
  trace('Warning: No handler registered for @${tagName}');
  
  // Option 1: Pass through unchanged
  return block;
  
  // Option 2: Provide default behavior
  return OXAddons.interpolate(tagArgs, block, context);
  
  // Option 3: Throw error for strict mode
  throw 'Unknown tag: @${tagName}';
});
```

## Performance Considerations

### Lazy Evaluation

Only register handlers for tags you actually use:

```haxe
// Don't register everything
interpreter.on("html", OXAddons.parseHtml);
interpreter.on("component", renderComponent);
// Only these two tags will be processed
```

### Memory Management

For large files, use on-the-fly execution to avoid holding the entire tree in memory:

```haxe
parser.walk(data, {
  visit: (node, parent) -> {
    var result = interpreter.executeBlock(node);
    processImmediately(result);
    return null; // Don't keep in tree
  }
});
```

### Caching

Cache compiled templates or frequently-used interpretations:

```haxe
var templateCache = new Map<String, CompiledTemplate>();

interpreter.on("template", (tagArgs, block, context) -> {
  var templateId = tagArgs[0];
  
  if (!templateCache.exists(templateId)) {
    templateCache.set(templateId, compileTemplate(block.text));
  }
  
  return templateCache.get(templateId).render(context.data);
});
```

## Error Handling

### Graceful Degradation

Provide fallback behavior for handler errors:

```haxe
interpreter.on("risky-operation", (tagArgs, block, context) -> {
  try {
    return complexOperation(block, context);
  } catch (e: Dynamic) {
    trace('Error in risky-operation: ${e}');
    return block.text; // Fallback to raw text
  }
});
```

### Validation

Validate tag arguments and properties:

```haxe
interpreter.on("component", (tagArgs, block, context) -> {
  if (tagArgs.length == 0) {
    throw "Component tag requires component name as first argument";
  }
  
  var componentName = tagArgs[0];
  if (!componentRegistry.has(componentName)) {
    throw 'Unknown component: ${componentName}';
  }
  
  return componentRegistry.render(componentName, context);
});
```

### Debug Mode

Add logging for development:

```haxe
class DebugInterpreter extends OXInterpreter {
  override public function executeBlock(block, context) {
    trace('Executing block with tags: ${context.tags}');
    var result = super.executeBlock(block, context);
    trace('Result: ${result}');
    return result;
  }
}
```

## Integration with OX Ecosystem

### Multi-Language Runtime

Each language runtime (C99, JavaScript, Haxe) implements the same interpreter API:

**JavaScript:**
```javascript
const parser = new OXParser();
const data = parser.parseFile('file.ox');

const interpreter = new OXInterpreter();
interpreter.on('html', OXAddons.parseHtml);

const result = interpreter.execute(data);
```

**C99:**
```c
ox_parser_t* parser = ox_parser_create();
ox_node_t* data = ox_parse_file(parser, "file.ox");

ox_interpreter_t* interp = ox_interpreter_create();
ox_interpreter_on(interp, "html", ox_addons_parse_html);

ox_node_t* result = ox_interpreter_execute(interp, data);
```

**Haxe:**
```haxe
var parser = new OXParser();
var data = parser.parseFile("file.ox");

var interpreter = new OXInterpreter();
interpreter.on("html", OXAddons.parseHtml);

var result = interpreter.execute(data);
```

### Authoring → Preprocessing → Interpretation

The complete OX pipeline:

```haxe
// 1. AUTHORING: Write OX with templates, expressions
// (done in .ox files)

// 2. PREPROCESSING: Resolve templates, evaluate expressions
// (handled by oxdef package)
// Produces pure .ox data files

// 3. INTERPRETATION: User-controlled transformation
var parser = new OXParser();
var data = parser.parseFile("preprocessed.ox");

var interpreter = new OXInterpreter();
interpreter.on("html", OXAddons.parseHtml);
interpreter.on("component", customHandler);

var finalOutput = interpreter.execute(data, runtimeData);
```

## Examples

### HTML Rendering System

```haxe
var interpreter = new OXInterpreter();

// Handle HTML blocks
interpreter.on("html", OXAddons.parseHtml);

// Handle components
interpreter.on("component", (tagArgs, block, context) -> {
  var name = tagArgs[0];
  var props = context.properties;
  return componentLibrary.render(name, props, block);
});

// Handle layouts
interpreter.on("layout", (tagArgs, block, context) -> {
  var layoutName = tagArgs[0];
  var content = OXAddons.interpolate(tagArgs, block, context);
  return layouts.apply(layoutName, content);
});

var html = interpreter.execute(pageData, {
  title: "My Page",
  user: currentUser
});
```

### Game Dialogue System

```haxe
var interpreter = new OXInterpreter();

interpreter.on("dialogue", (tagArgs, block, context) -> {
  var speaker = context.getProperty("speaker");
  var emotion = context.getProperty("emotion", "neutral");
  var text = OXAddons.interpolate(tagArgs, block, context);
  
  return {
    speaker: speaker,
    emotion: emotion,
    text: text,
    choices: context.findChildren(n -> n.hasTag("choice"))
  };
});

interpreter.on("choice", (tagArgs, block, context) -> {
  var condition = context.getProperty("if", null);
  if (condition != null && !context.evaluate(condition)) {
    return null; // Hide unavailable choices
  }
  
  return {
    text: block.text,
    action: context.getProperty("action")
  };
});

var dialogue = interpreter.execute(questData, gameState);
```

### Configuration System

```haxe
var interpreter = new OXInterpreter();

// Environment-specific values
interpreter.on("env", (tagArgs, block, context) -> {
  var envName = tagArgs[0];
  var currentEnv = context.data.environment;
  
  if (envName == currentEnv) {
    return block; // Keep this block
  }
  return null; // Remove non-matching environments
});

// Secret interpolation
interpreter.on("secret", (tagArgs, block, context) -> {
  var secretName = tagArgs[0];
  return context.data.secrets.get(secretName);
});

var config = interpreter.execute(configData, {
  environment: "production",
  secrets: secretStore
});
```

## Best Practices

1. **Keep handlers pure** - Avoid side effects in handlers when possible
2. **Use context.data for runtime state** - Don't rely on global variables
3. **Register only needed handlers** - Minimize overhead by only handling relevant tags
4. **Validate inputs** - Check tag arguments and properties for correctness
5. **Provide fallbacks** - Use `onUnhandled()` for graceful degradation
6. **Cache expensive operations** - Compile templates, load resources once
7. **Document tag schemas** - Clearly specify what arguments/properties each tag expects
8. **Test handlers independently** - Unit test each handler with mock contexts
9. **Consider security** - Sanitize user content, validate expressions
10. **Profile performance** - Measure handler execution time for optimization

## Conclusion

The OX interpreter system provides a flexible, event-driven approach to transforming parsed OX data. By separating parsing from interpretation and using composable handlers, OX remains language-agnostic while supporting diverse use cases—from HTML rendering to game data processing to configuration management.

The key insight is that **OX doesn't dictate how you interpret your data**—it provides the structure and tools, you provide the meaning.
