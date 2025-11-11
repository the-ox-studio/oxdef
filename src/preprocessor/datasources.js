import { PreprocessError } from "../errors/errors.js";

/**
 * DataSourceProcessor - handles detection, validation, and execution of data sources
 */
export class DataSourceProcessor {
  constructor(transaction) {
    this.transaction = transaction;
    this.detectedSources = new Set();
    this.dependencyGraph = new Map(); // source -> parent sources
  }

  /**
   * Detect all <on-data> blocks in AST
   * Returns list of data source names and their nesting relationships
   */
  detectDataSources(nodes, parentSource = null) {
    const sources = [];

    // Handle DocumentNode with templates
    if (nodes && nodes.type === "Document") {
      // Check templates array for OnData nodes
      if (nodes.templates && nodes.templates.length > 0) {
        const templateSources = this.detectDataSources(
          nodes.templates,
          parentSource,
        );
        sources.push(...templateSources);
      }
      // Also check blocks
      if (nodes.blocks && nodes.blocks.length > 0) {
        const blockSources = this.detectDataSources(nodes.blocks, parentSource);
        sources.push(...blockSources);
      }
      return sources;
    }

    // Handle arrays
    const nodeArray = Array.isArray(nodes) ? nodes : [nodes];

    for (const node of nodeArray) {
      if (node.type === "OnData") {
        const sourceName = node.sourceName;

        // Track this source
        this.detectedSources.add(sourceName);

        // Track dependency (nested data sources)
        if (parentSource) {
          if (!this.dependencyGraph.has(sourceName)) {
            this.dependencyGraph.set(sourceName, []);
          }
          this.dependencyGraph.get(sourceName).push(parentSource);
        }

        sources.push({
          name: sourceName,
          node: node,
          parent: parentSource,
          isNested: parentSource !== null,
        });

        // Recursively detect nested data sources in dataBlocks
        const nestedSources = this.detectDataSources(
          node.dataBlocks,
          sourceName,
        );
        sources.push(...nestedSources);
      } else if (node.type === "Block") {
        // Recurse into block children
        if (node.children && node.children.length > 0) {
          const childSources = this.detectDataSources(
            node.children,
            parentSource,
          );
          sources.push(...childSources);
        }
      } else if (node.type === "If") {
        // Check if branches
        const thenSources = this.detectDataSources(
          node.thenBlocks,
          parentSource,
        );
        sources.push(...thenSources);

        for (const branch of node.elseIfBranches) {
          const branchSources = this.detectDataSources(
            branch.blocks,
            parentSource,
          );
          sources.push(...branchSources);
        }

        const elseSources = this.detectDataSources(
          node.elseBlocks,
          parentSource,
        );
        sources.push(...elseSources);
      } else if (node.type === "Foreach" || node.type === "While") {
        // Check loop bodies
        const bodySources = this.detectDataSources(node.body, parentSource);
        sources.push(...bodySources);
      }
    }

    return sources;
  }

  /**
   * Validate that all detected data sources exist in transaction
   */
  validateDataSources() {
    const errors = [];

    for (const sourceName of this.detectedSources) {
      if (!this.transaction.hasDataSource(sourceName)) {
        errors.push({
          type: "UndefinedDataSource",
          message: `Data source '${sourceName}' is not defined in transaction`,
          source: sourceName,
        });
      }
    }

    if (errors.length > 0) {
      throw new PreprocessError(
        `Undefined data sources: ${errors.map((e) => e.source).join(", ")}`,
        "UndefinedDataSource",
        null,
      );
    }
  }

  /**
   * Determine execution order for data sources
   * Returns groups of sources that can be fetched in parallel
   */
  getExecutionPlan(sources) {
    // Group by nesting level
    const levels = new Map();

    for (const source of sources) {
      const level = this.getSourceLevel(source.name, 0);
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level).push(source);
    }

    // Sort levels
    const sortedLevels = Array.from(levels.entries()).sort(([a], [b]) => a - b);

    return sortedLevels.map(([level, sources]) => ({
      level,
      sources: sources.map((s) => s.name),
      isParallel: sources.every((s) => !s.isNested),
    }));
  }

  /**
   * Calculate nesting level of a data source
   */
  getSourceLevel(sourceName, depth, visited = new Set()) {
    // Detect circular dependency
    if (visited.has(sourceName)) {
      const chain = Array.from(visited).join(" → ");
      throw new PreprocessError(
        `Circular data source dependency detected: ${chain} → ${sourceName}`,
        "CircularDataSourceDependency",
        null,
      );
    }

    const parents = this.dependencyGraph.get(sourceName);
    if (!parents || parents.length === 0) {
      return depth;
    }

    // Track this source in the chain
    const newVisited = new Set(visited);
    newVisited.add(sourceName);

    // Find maximum parent depth
    const parentDepths = parents.map((parent) =>
      this.getSourceLevel(parent, depth + 1, newVisited),
    );
    return Math.max(...parentDepths);
  }

  /**
   * Execute data sources according to execution plan
   */
  async executeDataSources(sources) {
    // Detect all sources
    const detectedSources = this.detectDataSources(sources);

    if (detectedSources.length === 0) {
      return; // No data sources to fetch
    }

    // Validate all sources exist
    this.validateDataSources();

    // Get execution plan
    const executionPlan = this.getExecutionPlan(detectedSources);

    // Execute level by level
    for (const level of executionPlan) {
      if (level.isParallel) {
        // Fetch all at this level in parallel (use Promise.allSettled to not fail fast)
        const promises = level.sources.map((sourceName) =>
          this.transaction.fetchDataSource(sourceName).catch(() => {
            // Errors are already cached in transaction
          }),
        );
        await Promise.all(promises);
      } else {
        // Fetch sequentially (nested data sources)
        for (const sourceName of level.sources) {
          try {
            await this.transaction.fetchDataSource(sourceName);
          } catch (error) {
            // Error is already cached in transaction
          }
        }
      }
    }
  }

  /**
   * Check if data source fetch was successful
   */
  isDataSourceSuccessful(sourceName) {
    return this.transaction.hasDataSourceResult(sourceName);
  }

  /**
   * Check if data source fetch failed
   */
  isDataSourceFailed(sourceName) {
    return this.transaction.hasDataSourceError(sourceName);
  }

  /**
   * Get data for a source (for template expansion)
   */
  getDataSourceData(sourceName) {
    if (this.transaction.hasDataSourceResult(sourceName)) {
      return this.transaction.getDataSourceResult(sourceName);
    }
    return null;
  }

  /**
   * Get error for a source (for <on-error> expansion)
   */
  getDataSourceError(sourceName) {
    if (this.transaction.hasDataSourceError(sourceName)) {
      return this.transaction.getDataSourceError(sourceName);
    }
    return null;
  }

  /**
   * Reset processor state
   */
  reset() {
    this.detectedSources.clear();
    this.dependencyGraph.clear();
  }
}
