import { PreprocessError } from "../errors/errors.js";
import { ExpressionEvaluator } from "./expressions.js";

/**
 * TemplateExpander - expands template blocks using transaction data
 */
export class TemplateExpander {
  constructor(transaction, dataSourceProcessor) {
    this.transaction = transaction;
    this.dataSourceProcessor = dataSourceProcessor;
    this.expressionEvaluator = new ExpressionEvaluator(transaction);
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
   * Sets a variable in the transaction and produces no blocks
   */
  expandSet(setNode) {
    const name = setNode.name;
    const value = this.expressionEvaluator.evaluate(setNode.value);

    this.transaction.setVariable(name, value);

    // Set templates don't produce blocks
    return null;
  }

  /**
   * Expand <if> template
   * Evaluates conditions and expands the matching branch
   */
  expandIf(ifNode) {
    // Evaluate the main condition
    const condition = this.expressionEvaluator.evaluate(ifNode.condition);

    if (this.expressionEvaluator.toBoolean(condition)) {
      // Condition is true, expand the then blocks
      return this.expandNodes(ifNode.thenBlocks);
    }

    // Check elseif branches
    if (ifNode.elseIfBranches && ifNode.elseIfBranches.length > 0) {
      for (const branch of ifNode.elseIfBranches) {
        const elseifCondition = this.expressionEvaluator.evaluate(
          branch.condition,
        );
        if (this.expressionEvaluator.toBoolean(elseifCondition)) {
          return this.expandNodes(branch.blocks);
        }
      }
    }

    // All conditions false, expand else blocks if present
    if (ifNode.elseBlocks && ifNode.elseBlocks.length > 0) {
      return this.expandNodes(ifNode.elseBlocks);
    }

    // No matching branch, return empty array
    return [];
  }

  /**
   * Expand <foreach> template
   * Iterates over a collection and expands blocks for each item
   */
  expandForeach(foreachNode) {
    const itemName = foreachNode.itemVar;
    const indexName = foreachNode.indexVar; // optional (null if not specified)

    // Collection is a variable name (string), look it up
    const collection = this.transaction.getVariable(foreachNode.collection);

    if (collection === undefined) {
      throw new PreprocessError(
        `Undefined variable: ${foreachNode.collection}`,
        "UndefinedVariable",
        foreachNode.location,
      );
    }

    // Collection must be iterable (array)
    if (!Array.isArray(collection)) {
      throw new PreprocessError(
        `Foreach collection must be an array, got ${typeof collection}`,
        "InvalidForeachCollection",
        foreachNode.location,
      );
    }

    const expandedBlocks = [];

    // Save previous values of item and index variables
    const previousItem = this.transaction.getVariable(itemName);
    const previousIndex = indexName
      ? this.transaction.getVariable(indexName)
      : undefined;

    try {
      // Iterate over collection
      for (let i = 0; i < collection.length; i++) {
        // Set loop variables
        this.transaction.setVariable(itemName, collection[i]);
        if (indexName) {
          this.transaction.setVariable(indexName, i);
        }

        // Clone the body nodes for this iteration to avoid shared state
        const clonedBody = this.cloneNodes(foreachNode.body);

        // Expand blocks with current item in scope
        const iterationBlocks = this.expandNodes(clonedBody);
        expandedBlocks.push(...iterationBlocks);
      }

      // Restore previous values
      if (previousItem !== undefined) {
        this.transaction.setVariable(itemName, previousItem);
      } else {
        this.transaction.deleteVariable(itemName);
      }

      if (indexName) {
        if (previousIndex !== undefined) {
          this.transaction.setVariable(indexName, previousIndex);
        } else {
          this.transaction.deleteVariable(indexName);
        }
      }

      return expandedBlocks;
    } catch (error) {
      // Restore on error too
      if (previousItem !== undefined) {
        this.transaction.setVariable(itemName, previousItem);
      } else {
        this.transaction.deleteVariable(itemName);
      }

      if (indexName) {
        if (previousIndex !== undefined) {
          this.transaction.setVariable(indexName, previousIndex);
        } else {
          this.transaction.deleteVariable(indexName);
        }
      }

      throw error;
    }
  }

  /**
   * Expand <while> template
   * Repeatedly expands blocks while condition is true
   */
  expandWhile(whileNode) {
    const expandedBlocks = [];
    const maxIterations = 10000; // Prevent infinite loops
    let iterations = 0;

    while (true) {
      // Check iteration limit
      if (iterations >= maxIterations) {
        throw new PreprocessError(
          `While loop exceeded maximum iterations (${maxIterations})`,
          "MaxIterationsExceeded",
          whileNode.location,
        );
      }

      // Evaluate condition
      const condition = this.expressionEvaluator.evaluate(whileNode.condition);

      if (!this.expressionEvaluator.toBoolean(condition)) {
        break; // Condition false, exit loop
      }

      // Clone the body nodes for this iteration to avoid shared state
      const clonedBody = this.cloneNodes(whileNode.body);

      // Expand blocks with condition true
      const iterationBlocks = this.expandNodes(clonedBody);
      expandedBlocks.push(...iterationBlocks);

      iterations++;
    }

    return expandedBlocks;
  }

  /**
   * Clone an array of nodes (deep copy)
   */
  cloneNodes(nodes) {
    return nodes.map((node) => this.cloneNode(node));
  }

  /**
   * Deep clone a single node
   */
  cloneNode(node) {
    if (!node || typeof node !== "object") {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item) => this.cloneNode(item));
    }

    const cloned = { ...node };

    // Deep clone nested objects and arrays
    for (const key in cloned) {
      if (cloned.hasOwnProperty(key)) {
        if (typeof cloned[key] === "object" && cloned[key] !== null) {
          cloned[key] = this.cloneNode(cloned[key]);
        }
      }
    }

    return cloned;
  }

  /**
   * Evaluate property expressions in a block
   * Converts Expression nodes to Literal nodes with evaluated values
   */
  evaluateBlockProperties(block) {
    if (!block.properties) {
      return;
    }

    for (const [key, valueNode] of Object.entries(block.properties)) {
      if (valueNode && valueNode.type === "Expression") {
        // Evaluate the expression and replace with a literal
        const evaluatedValue = this.expressionEvaluator.evaluate(valueNode);

        // Determine the type of the evaluated value
        let valueType;
        if (typeof evaluatedValue === "number") {
          valueType = "number";
        } else if (typeof evaluatedValue === "string") {
          valueType = "string";
        } else if (typeof evaluatedValue === "boolean") {
          valueType = "boolean";
        } else if (evaluatedValue === null) {
          valueType = "null";
        } else {
          valueType = "object";
        }

        // Replace with a literal node
        block.properties[key] = {
          type: "Literal",
          valueType: valueType,
          value: evaluatedValue,
          location: valueNode.location,
        };
      }
    }
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
        // Evaluate property expressions
        this.evaluateBlockProperties(node);

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
