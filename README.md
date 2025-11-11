# OX Definition Language

A powerful, language-agnostic data definition system with template preprocessing capabilities.

## Overview

OX is designed to be more expressive than JSON, more concise than XML/HTML, and more powerful than YAML or TOML, while maintaining zero runtime overhead through a three-phase architecture:

1. **Authoring Phase**: Write expressive OX code with templates, expressions, and dynamic data
2. **Pre-processing Phase**: Evaluate all templates and expressions to produce pure data structures
3. **Interpretation Phase**: User-defined walkers transform pure data into target output

## Installation

```bash
npm install oxdefinition
```

## Quick Start

```javascript
import { createParser } from 'oxdefinition';

const parser = createParser();
const parsed = parser.parse('example.ox');
const transaction = parser.createTransaction({
  variables: { screenWidth: 1920 },
  functions: { max: Math.max }
});

const result = await parser.executeWithTransaction(parsed, transaction);
console.log(result.tree);
```

## Example OX Code

```ox
<set margin = 20>

[Container (width: 1920, padding: (margin))
  [Header (height: 60)]
  
  [Content (
    y: 60,
    width: ($parent.width - margin * 2)
  )]
]
```

## Documentation

See `.ai/README.md` for complete implementation specification and API documentation.

## Features

- **Blocks** `[]` for structure
- **Properties** `()` for metadata
- **Arrays** `{}` for collections
- **Templates** `<set>`, `<if>`, `<foreach>`, `<on-data>`
- **Expressions** with `$` references and arithmetic
- **Tag System** for reusable components
- **Multi-file Imports**
- **Async Data Sources**
- **Streaming Support**

## License

MIT
