# Multi-File System Design

**Status**: Implementation in Progress  
**Date**: November 12, 2025

---

## Overview

The OX multi-file system enables splitting OX documents across multiple files using two mechanisms:
1. **`<import>`** - Import tag definitions from other files
2. **`<inject>`** - Merge evaluated block trees from other files

Each file maintains its own scope and is evaluated independently, with only tags being shared across file boundaries.

---

## Core Principles

### 1. Files Are Independent Scopes

- Each `.ox` file is parsed and evaluated as a **separate tree**
- Block references (`$parent`, `$BlockId`) are **file-scoped only**
- Variables and expressions are evaluated within file scope
- `$` references **cannot cross file boundaries**

### 2. Tags Are the Export Mechanism

- **Tag capabilities** are defined in JavaScript (`TagRegistry`)
- **Tag templates** (`@tag` definitions) are defined in OX files
- Only `@tag` definitions can be exported/imported between files
- Regular blocks (without `@`) are **never** exported

### 3. Two-Level Tag Definition System

**Level 1 - JavaScript (Tag Capabilities)**:
```javascript
// Define what the tag CAN do
const registry = new TagRegistry();
registry.defineTag('component', {
  canReuse: true,
  canOutput: false,
  acceptChildren: true,
  module: {
    timestamp: () => Date.now()
  }
});
```

**Level 2 - OX Files (Tag Templates)**:
```ox
// Define the actual block template
@component(Button) [Button (width: 100, height: 50)
  [Label (text: "Click me")]
]
```

**Usage in Other Files**:
```ox
<import "./components.ox">

// Use the imported tag definition
#component(Button) [MyButton (label: "Submit")]
```

---

## `<import>` - Tag Definition Import

### Purpose
Import `@tag` definitions (block templates) from other files to make them available as `#tag` instances.

### Syntax
```ox
<import "path/to/file.ox">
<import "path/to/file.ox" as namespace>
```

### Rules
1. **Top-level only** - Must appear at document root (before any blocks)
2. **Tag definitions only** - Only imports `@tag` definitions, NOT regular blocks
3. **File extension required** - Must include `.ox` extension
4. **Path types**:
   - Relative: `<import "./components.ox">`
   - Package: `<import "@my-ui-lib/components.ox">`

### Behavior

**Without namespace** (direct import):
```ox
// components.ox
@component(Button) [Button (width: 100)]
@component(Input) [Input (placeholder: "text")]
[RegularBlock]  // ← NOT imported

// main.ox
<import "./components.ox">

#component(Button) [MyButton]   // ✅ Uses imported tag
#component(Input) [EmailInput]  // ✅ Uses imported tag
[RegularBlock]                   // ❌ ERROR - not a tag, not imported
```

**With namespace** (prefixed import):
```ox
// library.ox
@component(Widget) [Widget (type: "default")]

// myui.ox
@component(Widget) [Widget (type: "custom", color: "blue")]

// main.ox
<import "./library.ox" as lib>
<import "./myui.ox" as my>

#lib.component(Widget) [LibraryWidget]  // Uses library.ox template
#my.component(Widget) [CustomWidget]    // Uses myui.ox template

// Can also override locally:
@component(Widget) [Widget (type: "local")]
#component(Widget) [LocalWidget]        // Uses local template
```

### Tag Definition Precedence

When the same tag is defined in multiple places:

1. **Local definitions** (in current file) take precedence
2. **Namespaced imports** are kept separate by namespace
3. **Direct imports** are merged (last import wins on conflict)

```ox
<import "./lib1.ox">
<import "./lib2.ox">

// Both lib1 and lib2 define @component(Button)
#component(Button) [Btn]  // Uses lib2's definition (last import)

<import "./lib1.ox" as lib1>
<import "./lib2.ox" as lib2>

#lib1.component(Button) [Btn1]  // Uses lib1's definition
#lib2.component(Button) [Btn2]  // Uses lib2's definition

@component(Button) [Button (custom: true)]
#component(Button) [LocalBtn]   // Uses local definition
```

---

## `<inject>` - Block Tree Injection

### Purpose
Evaluate another file's entire block tree and merge the resulting blocks at the injection point.

### Syntax
```ox
<inject "path/to/file.ox">
```

### Rules
1. **Top-level or block children only** - Cannot be used in property scope
2. **Evaluates entire file** - File is parsed and preprocessed independently
3. **Independent scope** - Injected file has its own variable/reference scope
4. **Merges blocks** - Resulting blocks are merged at injection location

### Allowed Locations

```ox
// ✅ Top-level injection
<inject "./header.ox">

[App
  // ✅ As block child
  <inject "./content.ox">
  
  [Section
    // ✅ Nested block child
    <inject "./sidebar.ox">
  ]
]

// ❌ ERROR: In property scope
[Block (value: <inject "./data.ox">)]
```

### Behavior

**File evaluation is independent**:
```ox
// header.ox
[Header (title: "My App")
  [Logo (src: ($parent.title + ".png"))]  // $parent is Header
]

// main.ox
[App (title: "Application")
  <inject "./header.ox">
]

// Result after injection:
[App (title: "Application")
  [Header (title: "My App")              // title from header.ox, NOT App
    [Logo (src: "My App.png")]           // $parent.title = "My App"
  ]
]
```

**Variables are file-scoped**:
```ox
// config.ox
<set theme = "dark">
[Settings (theme: theme)]  // Uses local variable

// main.ox
<set theme = "light">
<inject "./config.ox">

[App (theme: theme)]  // Uses main.ox's theme = "light"

// Result:
[Settings (theme: "dark")]  // From config.ox
[App (theme: "light")]      // From main.ox
```

---

## File Scope & References

### What is File-Scoped

**File-scoped (cannot cross files)**:
- `$parent` references
- `$this` references
- `$BlockId` references
- Template variables (`<set>`)
- Block definitions

**Shared across files**:
- Tag definitions (`@tag`) via `<import>`
- Tag capabilities (defined in JavaScript)

### Examples

```ox
// components.ox
[Container (width: 400)
  [Box (width: ($parent.width - 40))]     // ✅ OK - parent in same file
]

[Header (size: ($Container.width))]       // ✅ OK - sibling in same file

// main.ox
<inject "./components.ox">

[App (width: 800)
  [Widget (width: ($Container.width))]    // ❌ ERROR - Container not in main.ox
  [Panel (width: ($parent.width))]        // ✅ OK - parent is App (same file)
]
```

---

## Path Resolution

### Relative Paths
Resolved relative to the **importing file's directory**:

```ox
// src/components/button.ox
<import "./utils.ox">           // → src/components/utils.ox
<import "../shared/theme.ox">   // → src/shared/theme.ox
```

### Package Paths
Resolved using Node.js-style module resolution:

```ox
<import "@my-ui-lib/components/button.ox">
```

**Resolution algorithm**:
1. Look for `node_modules/@my-ui-lib/`
2. Read `ox.config.json` or `ox.config.js` in package root
3. Use `source` field to find OX files directory
4. Resolve path within that directory

**Package config** (`node_modules/@my-ui-lib/ox.config.json`):
```json
{
  "source": "./ox",
  "main": "./ox/index.ox"
}
```

### Resolution Order

For `<import "@my-ui-lib/button.ox">`:
1. Find package: `node_modules/@my-ui-lib/`
2. Read config: `node_modules/@my-ui-lib/ox.config.json`
3. Get source dir: `"source": "./ox"` → `node_modules/@my-ui-lib/ox/`
4. Resolve file: `node_modules/@my-ui-lib/ox/button.ox`

Fallback: If no config, try `node_modules/@my-ui-lib/ox/` by convention

---

## Project Configuration

### Config File: `ox.config.js` or `ox.config.json`

Located in project root:

```javascript
// ox.config.js
export default {
  // Entry point (auto-detected: index.ox or main.ox)
  entry: 'main.ox',
  
  // Base directory for resolution
  baseDir: './',
  
  // Module directories (Node.js style)
  moduleDirectories: ['node_modules'],
  
  // Package resolution defaults
  packageDefaults: {
    oxDirectory: 'ox',      // Default folder name in packages
    oxMain: 'index.ox',     // Default entry point
    configFile: 'ox.config.json'  // Config file name
  }
};
```

### Auto-Detection

If `entry` not specified, look for (in order):
1. `index.ox`
2. `main.ox`

If neither found: error

---

## OXProject API

### Basic Usage

```javascript
import { OXProject } from './src/project/project.js';
import { TagRegistry } from './src/preprocessor/tags.js';

// Define tag capabilities in JavaScript
const tags = new TagRegistry();
tags.defineTag('component', {
  canReuse: true,
  canOutput: false,
  acceptChildren: true
});

// Create project from directory
const project = OXProject.fromDirectory('./my-project', {
  tagRegistry: tags
});

// Parse and preprocess
const tree = await project.parse();
```

### API Methods

```javascript
// From directory (auto-detect entry point)
const project = OXProject.fromDirectory('./path/to/project');

// From directory with config
const project = OXProject.fromDirectory('./path/to/project', {
  entry: 'custom-entry.ox',
  tagRegistry: myTags
});

// From single file with imports
const project = OXProject.fromFile('./path/to/file.ox', {
  tagRegistry: myTags
});

// Parse
const tree = await project.parse();

// Parse with macro context
const tree = await project.parse({
  macroContext: myMacroContext
});

// Get all loaded files (for debugging)
const files = project.getLoadedFiles();

// Clear cache
project.clearCache();
```

---

## Processing Pipeline

### Multi-File Processing Order

1. **Load entry point** (`main.ox` or `index.ox`)
2. **Process imports** (recursive)
   - Load imported files
   - Extract `@tag` definitions
   - Add to tag registry
   - Detect circular imports
3. **Process file tree**
   - Parse entry point
   - Expand `<inject>` directives
   - For each inject:
     - Load target file
     - Process its imports
     - Evaluate file independently
     - Merge resulting blocks
4. **Preprocess** (standard OX pipeline)
   - Tag expansion
   - Template expansion
   - Expression evaluation
   - Reference resolution

### Example Processing

**File structure**:
```
project/
  main.ox
  components/
    button.ox
    input.ox
  pages/
    header.ox
```

**main.ox**:
```ox
<import "./components/button.ox">
<import "./components/input.ox">

[App
  <inject "./pages/header.ox">
  
  #component(Button) [SubmitBtn]
  #component(Input) [EmailField]
]
```

**Processing steps**:
1. Load `main.ox`
2. Process `<import "./components/button.ox">`
   - Load `button.ox`
   - Extract `@component(Button)` definition
   - Add to registry
3. Process `<import "./components/input.ox">`
   - Load `input.ox`
   - Extract `@component(Input)` definition
   - Add to registry
4. Process `<inject "./pages/header.ox">`
   - Load `header.ox`
   - Process its imports (if any)
   - Evaluate `header.ox` independently
   - Merge resulting blocks into `App`
5. Expand tag instances
   - `#component(Button)` → expand with template from `button.ox`
   - `#component(Input)` → expand with template from `input.ox`
6. Continue standard preprocessing

---

## Error Handling

### Import Errors

```ox
// File not found
<import "./missing.ox">
// ERROR: Cannot resolve import './missing.ox' from 'main.ox'

// Import not at top-level
[Block
  <import "./tags.ox">
]
// ERROR: <import> must be at document top-level

// Invalid path
<import "no-extension">
// ERROR: Import path must include .ox extension
```

### Inject Errors

```ox
// Inject in property scope
[Block (value: <inject "./data.ox">)]
// ERROR: <inject> not allowed in property scope

// Circular injection
// a.ox: <inject "./b.ox">
// b.ox: <inject "./a.ox">
// ERROR: Circular injection detected: a.ox → b.ox → a.ox
```

### Scope Errors

```ox
// main.ox
<inject "./components.ox">

[App (width: ($Container.width))]
// ERROR: Undefined block reference '$Container' (not in current file scope)
```

### Tag Errors

```ox
// Tag not defined in JavaScript
#undefined(Widget) [MyWidget]
// ERROR: Tag 'undefined' not defined in TagRegistry

// Tag template not imported
#component(MissingButton) [Btn]
// ERROR: Tag instance 'component(MissingButton)' has no definition
// (Did you forget to import the file with @component(MissingButton)?)
```

---

## Circular Dependency Detection

### Import Cycles

```
a.ox: <import "./b.ox">
b.ox: <import "./c.ox">
c.ox: <import "./a.ox">

ERROR: Circular import detected: a.ox → b.ox → c.ox → a.ox
```

### Inject Cycles

```
main.ox: <inject "./header.ox">
header.ox: <inject "./nav.ox">
nav.ox: <inject "./main.ox">

ERROR: Circular injection detected: main.ox → header.ox → nav.ox → main.ox
```

### Detection Strategy

- Maintain import/inject stack during resolution
- Before loading file, check if already in stack
- If found: throw error with full cycle path
- After processing: pop from stack

---

## Use Cases

### Use Case 1: Component Library

**Library structure**:
```
@my-ui-lib/
  ox.config.json
  ox/
    index.ox
    components/
      button.ox
      input.ox
      card.ox
```

**Library files**:
```ox
// ox/components/button.ox
@component(Button) [Button (width: 100, height: 40)]

// ox/components/input.ox
@component(Input) [Input (placeholder: "Enter text")]

// ox/index.ox
<import "./components/button.ox">
<import "./components/input.ox">
```

**Consumer usage**:
```javascript
// JavaScript setup
import { OXProject, TagRegistry } from 'ox-parser';

const tags = new TagRegistry();
tags.defineTag('component', { canReuse: true, canOutput: false });

const project = OXProject.fromFile('./app.ox', { tagRegistry: tags });
const tree = await project.parse();
```

```ox
// app.ox
<import "@my-ui-lib/index.ox">

[Form
  #component(Button) [SubmitBtn (label: "Submit")]
  #component(Input) [EmailInput (type: "email")]
]
```

### Use Case 2: Split Application Structure

**Project structure**:
```
my-app/
  main.ox
  layout/
    header.ox
    footer.ox
  pages/
    home.ox
    about.ox
```

**Files**:
```ox
// layout/header.ox
[Header (title: "My Application")
  [Logo]
  [Nav
    [Link (href: "/")]
    [Link (href: "/about")]
  ]
]

// layout/footer.ox
[Footer (year: 2025)]

// main.ox
[App
  <inject "./layout/header.ox">
  
  <inject "./pages/home.ox">
  
  <inject "./layout/footer.ox">
]
```

### Use Case 3: Tag Libraries with Namespaces

```ox
// main.ox
<import "@material-ui/components.ox" as mui>
<import "@bootstrap/components.ox" as bs>
<import "./custom-ui.ox" as custom>

[App
  #mui.component(Button) [MaterialButton]
  #bs.component(Button) [BootstrapButton]
  #custom.component(Button) [CustomButton]
]
```

---

## Implementation Architecture

### File Structure

```
src/
  project/
    project.js          - OXProject main class
    resolver.js         - Path resolution (relative + package)
    loader.js           - File loading with caching
    import-processor.js - Process <import> directives
    inject-processor.js - Process <inject> directives
    config.js           - Config file parsing
    import-graph.js     - Circular dependency detection
```

### Class Responsibilities

**OXProject**:
- Entry point API
- Orchestrate multi-file processing
- Manage tag registry
- Coordinate loader and processors

**PathResolver**:
- Resolve relative paths
- Resolve package paths
- Read package configs

**FileLoader**:
- Load `.ox` files from disk
- Cache parsed ASTs
- Track loaded files

**ImportProcessor**:
- Extract `<import>` directives
- Load imported files
- Extract `@tag` definitions
- Handle namespacing

**InjectProcessor**:
- Extract `<inject>` directives
- Evaluate injected files
- Merge blocks at injection points
- Maintain file scope separation

**ImportGraph**:
- Track import/inject chains
- Detect circular dependencies
- Generate error messages with full cycle path

---

**End of Multi-File System Design**
