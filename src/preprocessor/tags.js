import { PreprocessError, createLocation } from "../errors/errors.js";

/**
 * Tag Registry - manages tag definitions and their configurations
 */
export class TagRegistry {
  constructor() {
    this.tags = new Map(); // tagName -> TagDefinition
    this.instances = new Map(); // "tagName(argument)" -> BlockNode (from @tag definitions)
  }

  /**
   * Define a tag with configuration
   */
  defineTag(name, config) {
    if (this.tags.has(name)) {
      throw new Error(`Tag '${name}' is already defined`);
    }

    const tagDef = {
      name,
      block: {
        canReuse: config.block?.canReuse ?? false,
        canOutput: config.block?.canOutput ?? true,
        acceptChildren: config.block?.acceptChildren ?? true,
        output: config.block?.output ?? null,
      },
      module: config.module ?? {},
      descriptor: {
        attributes: config.descriptor?.attributes ?? [],
        exposeAs: config.descriptor?.exposeAs ?? [],
      },
    };

    this.tags.set(name, tagDef);
  }

  /**
   * Get tag definition
   */
  getTag(name) {
    return this.tags.get(name);
  }

  /**
   * Check if tag exists
   */
  hasTag(name) {
    return this.tags.has(name);
  }

  /**
   * Register a tag instance (from @tag blocks in OX)
   * Key format: "tagName" or "tagName(argument)"
   */
  registerInstance(key, blockNode) {
    if (this.instances.has(key)) {
      const location = blockNode.location;
      throw new PreprocessError(
        `Duplicate tag definition: @${key}`,
        "DuplicateTagDefinition",
        location,
      );
    }

    this.instances.set(key, blockNode);
  }

  /**
   * Get tag instance by key
   */
  getInstance(key) {
    return this.instances.get(key);
  }

  /**
   * Check if instance exists
   */
  hasInstance(key) {
    return this.instances.has(key);
  }

  /**
   * Get all instances for a tag name (regardless of argument)
   */
  getInstancesForTag(tagName) {
    const instances = [];
    for (const [key, block] of this.instances.entries()) {
      if (key === tagName || key.startsWith(`${tagName}(`)) {
        instances.push({ key, block });
      }
    }
    return instances;
  }

  /**
   * Clear all instances (useful for re-parsing)
   */
  clearInstances() {
    this.instances.clear();
  }

  /**
   * Get all tag definitions
   */
  getAllTags() {
    return Array.from(this.tags.values());
  }
}

/**
 * Tag Processor - handles tag validation and processing
 */
export class TagProcessor {
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Create instance key from tag
   */
  createKey(tagName, argument = null) {
    return argument ? `${tagName}(${argument})` : tagName;
  }

  /**
   * Validate tag on block
   */
  validateTag(tag, blockNode, isDefinition) {
    const tagDef = this.registry.getTag(tag.name);

    if (!tagDef) {
      throw new PreprocessError(
        `Tag '${tag.name}' is not defined`,
        "UndefinedTag",
        tag.location,
      );
    }

    // For definitions (@tag)
    if (isDefinition) {
      if (!tagDef.block.canReuse) {
        throw new PreprocessError(
          `Tag '${tag.name}' cannot be used as a definition (canReuse is false)`,
          "InvalidTagDefinition",
          tag.location,
        );
      }

      // Tag definitions cannot have expressions in properties
      this.validateNoExpressions(blockNode);
    }

    // For instances (#tag)
    if (!isDefinition) {
      if (!tagDef.block.canReuse) {
        throw new PreprocessError(
          `Tag '${tag.name}' cannot be instantiated (canReuse is false)`,
          "InvalidTagInstance",
          tag.location,
        );
      }

      // Check if instance can have children
      if (!tagDef.block.acceptChildren && blockNode.children.length > 0) {
        throw new PreprocessError(
          `Tag instance #${tag.name} cannot have children (acceptChildren is false)`,
          "TagInstanceWithChildren",
          blockNode.location,
        );
      }
    }

    return tagDef;
  }

  /**
   * Validate that block has no expressions (for tag definitions)
   */
  validateNoExpressions(blockNode) {
    for (const [key, value] of Object.entries(blockNode.properties)) {
      if (value.type === "Expression") {
        throw new PreprocessError(
          `Tag definitions cannot use expressions in properties (property '${key}')`,
          "TagDefinitionWithExpression",
          blockNode.location,
        );
      }

      if (value.type === "Array") {
        for (const element of value.elements) {
          if (element.type === "Expression") {
            throw new PreprocessError(
              `Tag definitions cannot use expressions in array properties (property '${key}')`,
              "TagDefinitionWithExpression",
              blockNode.location,
            );
          }
        }
      }
    }
  }

  /**
   * Validate tag composition (multiple #tags on same block)
   */
  validateComposition(tags, blockNode) {
    // Composition cannot have properties
    if (Object.keys(blockNode.properties).length > 0) {
      throw new PreprocessError(
        "Tag composition cannot have properties",
        "TagCompositionWithProperties",
        blockNode.location,
      );
    }

    // Composition cannot have children
    if (blockNode.children.length > 0) {
      throw new PreprocessError(
        "Tag composition cannot have children",
        "TagCompositionWithChildren",
        blockNode.location,
      );
    }

    // All tags must be instances (not definitions)
    const hasDefinition = tags.some((t) => t.tagType === "definition");
    if (hasDefinition) {
      throw new PreprocessError(
        "Cannot mix @tag and #tag on same block",
        "MixedTagTypes",
        blockNode.location,
      );
    }
  }

  /**
   * Detect tag usage on block
   */
  detectTagUsage(blockNode) {
    if (!blockNode.tags || blockNode.tags.length === 0) {
      return { type: "none" };
    }

    const definitions = blockNode.tags.filter(
      (t) => t.tagType === "definition",
    );
    const instances = blockNode.tags.filter((t) => t.tagType === "instance");

    // Cannot mix @ and #
    if (definitions.length > 0 && instances.length > 0) {
      throw new PreprocessError(
        "Cannot mix @tag and #tag on same block",
        "MixedTagTypes",
        blockNode.location,
      );
    }

    // Definition
    if (definitions.length > 0) {
      if (definitions.length > 1) {
        throw new PreprocessError(
          "Block can only have one @tag definition",
          "MultipleTagDefinitions",
          blockNode.location,
        );
      }
      return { type: "definition", tag: definitions[0] };
    }

    // Instance
    if (instances.length === 1) {
      return { type: "instance", tag: instances[0] };
    }

    // Composition
    if (instances.length > 1) {
      return { type: "composition", tags: instances };
    }

    return { type: "none" };
  }

  /**
   * Process tag definitions in AST
   * Extracts @tag blocks and registers them
   */
  processDefinitions(blocks) {
    const processed = [];

    for (const block of blocks) {
      const usage = this.detectTagUsage(block);

      if (usage.type === "definition") {
        const tag = usage.tag;
        const tagDef = this.validateTag(tag, block, true);

        const key = this.createKey(tag.name, tag.argument);
        this.registry.registerInstance(key, block);

        // If canOutput is true, include in processed blocks
        if (tagDef.block.canOutput) {
          processed.push(block);
        }

        // Call user-defined output function if provided
        if (tagDef.block.output) {
          tagDef.block.output(block);
        }
      } else {
        // Not a definition, keep as-is
        processed.push(block);
      }

      // Recursively process children
      if (block.children && block.children.length > 0) {
        block.children = this.processDefinitions(block.children);
      }
    }

    return processed;
  }

  /**
   * Validate all tag instances reference valid definitions
   */
  validateInstances(blocks) {
    for (const block of blocks) {
      const usage = this.detectTagUsage(block);

      if (usage.type === "instance") {
        const tag = usage.tag;
        const tagDef = this.validateTag(tag, block, false);

        // Check if definition exists
        const key = this.createKey(tag.name, tag.argument);
        if (tagDef.block.canReuse && !this.registry.hasInstance(key)) {
          throw new PreprocessError(
            `No definition found for #${key}`,
            "TagDefinitionNotFound",
            tag.location,
          );
        }
      } else if (usage.type === "composition") {
        this.validateComposition(usage.tags, block);

        // Validate each tag in composition
        for (const tag of usage.tags) {
          this.validateTag(tag, block, false);

          const key = this.createKey(tag.name, tag.argument);
          const tagDef = this.registry.getTag(tag.name);
          if (tagDef.block.canReuse && !this.registry.hasInstance(key)) {
            throw new PreprocessError(
              `No definition found for #${key}`,
              "TagDefinitionNotFound",
              tag.location,
            );
          }
        }
      }

      // Recursively validate children
      if (block.children && block.children.length > 0) {
        this.validateInstances(block.children);
      }
    }
  }

  /**
   * Expand tag composition (multiple #tags → child blocks)
   */
  expandComposition(blockNode, tags) {
    const children = [];

    for (const tag of tags) {
      const key = this.createKey(tag.name, tag.argument);
      const definition = this.registry.getInstance(key);

      if (!definition) {
        throw new PreprocessError(
          `No definition found for #${key}`,
          "TagDefinitionNotFound",
          tag.location,
        );
      }

      // Generate child ID: {parentId}_{tagName}
      const childId = `${blockNode.id}_${tag.argument || tag.name}`;

      // Deep clone the definition
      const child = this.cloneBlock(definition);
      child.id = childId;

      // Pattern match to expand the child
      const expandedChild = this.expandInstance(child, tag);
      children.push(expandedChild);
    }

    // Replace block with composition
    blockNode.children = children;
    blockNode.tags = []; // Remove tags after expansion

    return blockNode;
  }

  /**
   * Expand tag instance (#tag with single tag)
   */
  expandInstance(blockNode, tag) {
    const key = this.createKey(tag.name, tag.argument);
    const definition = this.registry.getInstance(key);

    if (!definition) {
      throw new PreprocessError(
        `No definition found for #${key}`,
        "TagDefinitionNotFound",
        tag.location,
      );
    }

    // Merge properties (instance overrides definition)
    const mergedProperties = {
      ...this.cloneProperties(definition.properties),
      ...blockNode.properties,
    };

    // Copy definition's children if instance doesn't have any
    let children = blockNode.children;
    if (children.length === 0 && definition.children.length > 0) {
      children = definition.children.map((c) => this.cloneBlock(c));
    }

    blockNode.properties = mergedProperties;
    blockNode.children = children;
    blockNode.tags = []; // Remove tags after expansion

    return blockNode;
  }

  /**
   * Inject module properties into blocks with tags
   * Module properties are computed from external scope
   */
  injectModuleProperties(blocks) {
    const injected = [];

    for (const block of blocks) {
      // Check if block has any tags
      if (block.tags && block.tags.length > 0) {
        for (const tag of block.tags) {
          const tagDef = this.registry.getTag(tag.name);

          if (
            tagDef &&
            tagDef.module &&
            Object.keys(tagDef.module).length > 0
          ) {
            // Validate no conflicts with existing properties
            this.validateModulePropertyConflicts(block, tagDef, tag);

            // Inject module properties
            for (const [propName, getter] of Object.entries(tagDef.module)) {
              // Call the getter function to get the value
              const value = getter();

              // Wrap value in Literal node
              const literalNode = this.wrapValueAsLiteral(value);

              // Add to block properties
              block.properties[propName] = literalNode;
            }
          }
        }
      }

      injected.push(block);

      // Recursively inject into children
      if (block.children && block.children.length > 0) {
        block.children = this.injectModuleProperties(block.children);
      }
    }

    return injected;
  }

  /**
   * Validate that module properties don't conflict with existing properties
   */
  validateModulePropertyConflicts(blockNode, tagDef, tag) {
    const moduleProps = Object.keys(tagDef.module);
    const existingProps = Object.keys(blockNode.properties);

    for (const propName of moduleProps) {
      if (existingProps.includes(propName)) {
        throw new PreprocessError(
          `Cannot override module property '${propName}' from tag '${tag.name}'`,
          "ModulePropertyConflict",
          blockNode.location,
        );
      }
    }
  }

  /**
   * Wrap a JavaScript value as a Literal AST node
   */
  wrapValueAsLiteral(value) {
    // Determine the type
    if (value === null) {
      return { type: "Literal", valueType: "null", value: null };
    }

    if (typeof value === "boolean") {
      return { type: "Literal", valueType: "boolean", value };
    }

    if (typeof value === "number") {
      return { type: "Literal", valueType: "number", value };
    }

    if (typeof value === "string") {
      return { type: "Literal", valueType: "string", value };
    }

    if (Array.isArray(value)) {
      // Wrap each element as a literal
      const elements = value.map((v) => this.wrapValueAsLiteral(v));
      return { type: "Array", elements };
    }

    if (typeof value === "object") {
      // For objects, convert to a string representation
      // Users can implement custom serialization if needed
      return {
        type: "Literal",
        valueType: "string",
        value: JSON.stringify(value),
      };
    }

    // Fallback: convert to string
    return { type: "Literal", valueType: "string", value: String(value) };
  }

  /**
   * Expand all tag instances and compositions in AST
   */
  expandTags(blocks) {
    const expanded = [];

    for (const block of blocks) {
      const usage = this.detectTagUsage(block);

      if (usage.type === "composition") {
        this.validateComposition(usage.tags, block);
        const composedBlock = this.expandComposition(block, usage.tags);
        expanded.push(composedBlock);
      } else if (usage.type === "instance") {
        const expandedBlock = this.expandInstance(block, usage.tag);
        expanded.push(expandedBlock);
      } else {
        // No tags, keep as-is
        expanded.push(block);
      }

      // Recursively expand children
      if (block.children && block.children.length > 0) {
        block.children = this.expandTags(block.children);
      }
    }

    return expanded;
  }

  /**
   * Deep clone a block node
   */
  cloneBlock(block) {
    return {
      ...block,
      properties: this.cloneProperties(block.properties),
      children: block.children.map((c) => this.cloneBlock(c)),
      tags: [...(block.tags || [])],
    };
  }

  /**
   * Clone properties object
   */
  cloneProperties(properties) {
    const cloned = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value.type === "Array") {
        cloned[key] = {
          ...value,
          elements: [...value.elements],
        };
      } else {
        cloned[key] = { ...value };
      }
    }
    return cloned;
  }
}
