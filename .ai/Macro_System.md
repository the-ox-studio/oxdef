# Macro System Integration Summary

## What Was Added

The OX Implementation Roadmap has been updated to include a comprehensive **Macro System** that enables user-controlled preprocessing and meta-programming capabilities.

## New Sections Added

### 1. Macro System (Core Concepts)
- **Location**: After Tag Rules Summary, before Template Syntax
- **Content**:
  - Overview of macro system philosophy
  - Two macro hooks: `onParse` and `onWalk`
  - Evaluation flow diagrams
  - Complete API reference
  - Property evaluation guarantees
  - 5 detailed use case examples:
    - Auto-sizing containers
    - Conditional child processing
    - Property validation
    - Peek and conditional evaluation
    - Code generation with pre-parse

### 2. Updated Preprocessing Architecture
- **Location**: Complete Preprocessing Architecture section
- **Changes**:
  - Added Phase 6: Pre-Parse Macro Hook (onParse callback)
  - Modified Phase 9: Template Expansion with Macro Walk
  - Renumbered remaining phases (10 → 11, etc.)
  - Detailed integration of macros into evaluation flow

### 3. New Implementation Phase
- **Phase 11: Macro System** (3-4 weeks)
- **Tasks**:
  1. Pre-Parse Hook implementation
  2. Macro Walk Hook implementation
  3. Cursor Control API (nextBlock, invokeWalk, back)
  4. Property Evaluation Control
  5. Error Handling (throwError)
  6. Auto-Processing Behavior
  7. Integration with Existing Phases
  8. Comprehensive Tests

### 4. Updated API Reference (Appendix)
- Added complete Macro API section:
  - `oxparser.init.onParse`
  - `oxparser.macros.onWalk`
  - `oxparser.macros.nextBlock()`
  - `oxparser.macros.invokeWalk()`
  - `oxparser.macros.back()`
  - `oxparser.macros.throwError()`
  - `oxparser.finish()`

### 5. Updated Timeline
- **Old**: 24-32 weeks (6-8 months)
- **New**: 30-38 weeks (7-9 months)
- Added 3-4 weeks for Macro System implementation
- Renumbered all subsequent phases:
  - Phase 11: Serialization (was Phase 10)
  - Phase 13: Documentation (was Phase 12) - includes macro examples
  - Phase 14: Testing (was Phase 13)

## Key Features of Macro System

### Pre-Parse Hook (`onParse`)
- Called once before any preprocessing
- Access to raw parsed tree (templates/expressions intact)
- Early termination capability via `finish()`
- Use cases: code generation, static analysis

### Macro Walk Hook (`onWalk`)
- Called for every block during preprocessing
- Block properties are evaluated (literals)
- Children properties not yet evaluated
- User controls child evaluation order
- Can modify properties
- Can validate and throw errors
- Use cases: auto-sizing, conditional processing, validation

### Cursor Control
- **Peek**: `nextBlock()` - view next block without evaluating
- **Advance**: `invokeWalk(block, parent)` - evaluate and process
- **Rewind**: `back()` - move cursor backward
- Fine-grained control over evaluation order

### Property Evaluation Guarantees
When `onWalk(block, parent)` is called:
- ✓ `block.properties` - evaluated (literals)
- ✓ `parent.properties` - evaluated
- ✓ Module properties - injected and available
- ✗ `block.children[].properties` - not evaluated (until invokeWalk)

### Auto-Processing
- If user doesn't manually walk children, preprocessor auto-evaluates them
- Depth-first traversal by default
- "Semi-final" (evaluated) vs "final" (committed to tree)
- User only needs control when custom ordering required

## Integration Points

1. **Phase 6** - onParse callback before preprocessing begins
2. **Phase 9** - onWalk callback during template expansion
3. **Module System** - Properties available before onWalk
4. **Expression Resolution** - Evaluated before onWalk
5. **Error Handling** - Macro errors distinct from preprocessing errors

## Use Cases Documented

1. **Auto-Sizing Container** - Calculate parent dimensions from children
2. **Conditional Child Processing** - Skip invisible branches for performance
3. **Property Validation** - Enforce required properties and types
4. **Peek and Conditional** - Inspect structure before evaluation
5. **Code Generation** - TypeScript types from OX structure

## Documentation Updates

- Macro API added to Parser API section
- Examples integrated throughout
- Phase 13 (Documentation) includes macro tutorials
- Complete API reference in Appendix

## Timeline Impact

Additional 6 weeks added to timeline:
- 3-4 weeks for Macro System implementation (Phase 11)
- Additional documentation for macros (Phase 13)
- Additional testing for macros (Phase 14)

Total timeline: **30-38 weeks (7-9 months)** (was 24-32 weeks)

---

## Benefits of Macro System

1. **Meta-Programming** - Users control preprocessing flow
2. **Performance** - Skip evaluation of unused branches
3. **Validation** - Custom property validation during preprocessing
4. **Auto-Sizing** - Parent dimensions from children (common UI pattern)
5. **Code Generation** - Access to raw structure before evaluation
6. **Flexibility** - Manual or automatic child processing

## Philosophy

The macro system maintains OX's core principle:
- **Authoring Phase**: Expressive OX with macros for control
- **Preprocessing Phase**: Macros evaluate to pure data
- **Interpretation Phase**: Zero runtime overhead

Macros don't add runtime overhead - they operate during preprocessing to produce optimized pure data structures.

---

**Document Version**: Updated with Macro System
**Date**: Implementation Roadmap v2.0
**Status**: Ready for Phase 11 Implementation
