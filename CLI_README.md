# OXDef CLI

Command-line interface for building and processing OX files.

## Installation

```bash
npm install -g oxdefinition
```

Or use locally in your project:

```bash
npm install oxdefinition
npx oxdef --help
```

## Commands

### `oxdef validate`

Validate OX syntax without building. Useful for checking if your OX files are correct.

```bash
oxdef validate
oxdef validate --config path/to/ox.config.js
```

**Options:**
- `-c, --config <path>` - Path to config file (default: `ox.config.js` in current directory)
- `-v, --verbose` - Show verbose output including stack traces

### `oxdef build [script]`

Parse OX files and optionally run a build script to transform the output.

```bash
# Just parse and validate
oxdef build

# Run a build script
oxdef build build-scripts/to-html.js
oxdef build build-scripts/to-json.js
```

**Options:**
- `-c, --config <path>` - Path to config file
- `-v, --verbose` - Show verbose output including stack traces

## Configuration

Create an `ox.config.js` file in your project root:

```javascript
export default {
  baseDir: import.meta.dirname,
  entryPoint: "main.ox",
  outputDir: "./dist",
  title: "My OX Project",
  moduleDirectories: ["node_modules", "./components"],
};
```

### Configuration Options

- **baseDir** - Base directory for resolving imports/injects (default: current directory)
- **entryPoint** - Main OX file to parse (required)
- **outputDir** - Where to write build output (default: `./dist`)
- **title** - Project title (used by build scripts)
- **moduleDirectories** - Directories to search for OX modules

## Build Scripts

Build scripts are JavaScript modules that transform parsed OX blocks into your desired output format.

### Build Script API

```javascript
/**
 * @param {OXProject} project - The OXProject instance
 * @param {Array} blocks - Parsed blocks from the entry point
 * @param {Object} config - Configuration from ox.config.js
 * @returns {Object} Build result
 */
export default async function build(project, blocks, config) {
  // Your transformation logic here
  
  return {
    files: ["path/to/output.html"], // Array of generated files
    blocks: blocks.length,          // Optional metadata
  };
}
```

### Example: Convert to JSON

```javascript
// build-scripts/to-json.js
import fs from "fs";
import path from "path";

export default async function build(project, blocks, config) {
  const outputDir = config.outputDir || "./dist";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const json = JSON.stringify(blocks, null, 2);
  const outputFile = path.join(outputDir, "output.json");
  fs.writeFileSync(outputFile, json, "utf-8");

  return {
    files: [outputFile],
    blocks: blocks.length,
  };
}
```

### Example: Convert to HTML

```javascript
// build-scripts/to-html.js
import fs from "fs";
import path from "path";

export default async function build(project, blocks, config) {
  const outputDir = config.outputDir || "./dist";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const html = generateHTML(blocks, config);
  const outputFile = path.join(outputDir, "index.html");
  fs.writeFileSync(outputFile, html, "utf-8");

  return {
    files: [outputFile],
  };
}

function generateHTML(blocks, config) {
  // Your HTML generation logic
  return `<!DOCTYPE html>...`;
}
```

## Project Structure

Recommended project structure:

```
my-ox-project/
├── ox.config.js           # Configuration
├── main.ox                # Entry point
├── components/            # Reusable OX components
│   ├── button.ox
│   └── card.ox
├── build-scripts/         # Custom build scripts
│   ├── to-html.js
│   └── to-json.js
└── dist/                  # Build output (generated)
```

## Examples

The `examples/` directory contains working examples:

```bash
cd examples
oxdef validate
oxdef build build-scripts/to-json.js
oxdef build build-scripts/to-html.js
```

## Error Handling

The CLI provides clear error messages:

```bash
# Syntax error
✖ Build failed
  Syntax Error:
  Unexpected token '}'
  at main.ox:15:3

# File not found
✖ Build failed
  File not found:
  components/missing.ox

# Circular dependency
✖ Build failed
  Circular dependency detected:
  a.ox -> b.ox -> c.ox -> a.ox
```

Use `--verbose` for full stack traces:

```bash
oxdef build script.js --verbose
```

## Development

Link the CLI for local development:

```bash
npm link
oxdef --help
```

## License

MIT
