import { PreprocessError } from "../errors/errors.js";

/**
 * TemplateExpander - expands template blocks using transaction data
 */
export class TemplateExpander {
  constructor(transaction, dataSourceProcessor) {
    this.transaction = transaction;
    this.dataSourceProcessor = dataSourceProcessor;
  }

  /**
   * Expand all templates in the document
   * This processes <on-data>, <on-error>, and other template blocks
   */
  expandTemplates(document) {
    const expandedBlocks = [];

    // Process templates array (where <on-data> blocks are stored)
    if (document.templates && document.templates.length > 0) {
      for (const template of document.templates) {
        const expanded = this.expandTemplate(template);
        if (expanded) {
          if (Array.isArray(expanded)) {
            expandedBlocks.push(...expanded);
          } else {
            expandedBlocks.push(expanded);
          }
        }
      }
    }

    // Also process regular blocks
    if (document.blocks && document.blocks.length > 0) {
      expandedBlocks.push(...document.blocks);
    }

    return expandedBlocks;
  }

  /**
   * Expand a single template node
   */
  expandTemplate(template) {
    switch (template.type) {
      case "OnData":
        return this.expandOnData(template);

      case "Set":
        return this.expandSet(template);

      case "If":
        return this.expandIf(template);

      case "Foreach":
        return this.expandForeach(template);

      case "While":
        return this.expandWhile(template);

      case "Block":
        // Regular block, just return it
        return template;

      default:
        // Unknown template type, skip
        return null;
    }
  }

  /**
   * Expand <on-data> template
   */
  expandOnData(onDataNode) {
    const sourceName = onDataNode.sourceName;

    // Check if data source was successful
    if (this.dataSourceProcessor.isDataSourceSuccessful(sourceName)) {
      // Get the fetched data
      const data = this.dataSourceProcessor.getDataSourceData(sourceName);

      // Make data available as a variable (source name becomes variable name)
      const previousValue = this.transaction.getVariable(sourceName);
      this.transaction.setVariable(sourceName, data);

      try {
        // Expand the data blocks with the data in scope
        const expandedBlocks = this.expandNodes(onDataNode.dataBlocks);

        // Restore previous value
        if (previousValue !== undefined) {
          this.transaction.setVariable(sourceName, previousValue);
        } else {
          this.transaction.deleteVariable(sourceName);
        }

        return expandedBlocks;
      } catch (error) {
        // Restore on error too
        if (previousValue !== undefined) {
          this.transaction.setVariable(sourceName, previousValue);
        } else {
          this.transaction.deleteVariable(sourceName);
        }
        throw error;
      }
    }

    // Check if data source failed
    if (this.dataSourceProcessor.isDataSourceFailed(sourceName)) {
      // Get the error information
      const error = this.dataSourceProcessor.getDataSourceError(sourceName);

      // Make error available as $error variable
      const previousError = this.transaction.getVariable("$error");
      this.transaction.setVariable("$error", error);

      try {
        // Expand the error blocks with $error in scope
        const expandedBlocks = this.expandNodes(onDataNode.errorBlocks);

        // Restore previous error value
        if (previousError !== undefined) {
          this.transaction.setVariable("$error", previousError);
        } else {
          this.transaction.deleteVariable("$error");
        }

        return expandedBlocks;
      } catch (expandError) {
        // Restore on error too
        if (previousError !== undefined) {
          this.transaction.setVariable("$error", previousError);
        } else {
          this.transaction.deleteVariable("$error");
        }
        throw expandError;
      }
    }

    // Data source was neither successful nor failed (shouldn't happen)
    throw new PreprocessError(
      `Data source '${sourceName}' was not executed`,
      "DataSourceNotExecuted",
      onDataNode.location,
    );
  }

  /**
   * Expand <set> template (variable declaration)
   */
  expandSet(setNode) {
    // Set templates don't produce blocks, they just set variables
    // This will be handled in Phase 9 when we implement full template expansion
    // For now, just return null (no blocks produced)
    return null;
  }

  /**
   * Expand <if> template
   */
  expandIf(ifNode) {
    // If templates will be fully implemented in Phase 9
    // For now, just expand all branches (no condition evaluation yet)
    return null;
  }

  /**
   * Expand <foreach> template
   */
  expandForeach(foreachNode) {
    // Foreach templates will be fully implemented in Phase 9
    // For now, just return null
    return null;
  }

  /**
   * Expand <while> template
   */
  expandWhile(whileNode) {
    // While templates will be fully implemented in Phase 9
    // For now, just return null
    return null;
  }

  /**
   * Expand an array of nodes (recursively)
   */
  expandNodes(nodes) {
    const expanded = [];

    for (const node of nodes) {
      if (node.type === "OnData") {
        const result = this.expandOnData(node);
        if (result) {
          if (Array.isArray(result)) {
            expanded.push(...result);
          } else {
            expanded.push(result);
          }
        }
      } else if (node.type === "Block") {
        // Recursively expand children
        if (node.children && node.children.length > 0) {
          node.children = this.expandNodes(node.children);
        }
        expanded.push(node);
      } else {
        // Other template types
        const result = this.expandTemplate(node);
        if (result) {
          if (Array.isArray(result)) {
            expanded.push(...result);
          } else {
            expanded.push(result);
          }
        }
      }
    }

    return expanded;
  }
}
