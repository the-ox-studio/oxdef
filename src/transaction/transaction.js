/**
 * Transaction - manages variables, functions, and data sources for OX preprocessing
 */
export class Transaction {
  constructor(config = {}) {
    // Variables accessible in OX templates
    this.variables = new Map(Object.entries(config.variables || {}));

    // Functions callable in expressions
    this.functions = new Map(Object.entries(config.functions || {}));

    // Data sources (async functions or wrappers)
    this.dataSources = new Map();
    this.dataSourceResults = new Map(); // Cache for fetched data
    this.dataSourceErrors = new Map(); // Cache for errors

    // Configuration
    this.config = {
      timeout: config.config?.timeout || 5000,
      allowVariableOverride: config.config?.allowVariableOverride ?? false,
      strictMode: config.config?.strictMode ?? true,
    };

    // Register data sources
    if (config.dataSources) {
      for (const [name, source] of Object.entries(config.dataSources)) {
        this.addDataSource(name, source);
      }
    }
  }

  // ============ Variable Management ============

  setVariable(name, value) {
    this.variables.set(name, value);
  }

  getVariable(name) {
    return this.variables.get(name);
  }

  hasVariable(name) {
    return this.variables.has(name);
  }

  deleteVariable(name) {
    this.variables.delete(name);
  }

  getAllVariables() {
    return Object.fromEntries(this.variables);
  }

  // ============ Function Management ============

  addFunction(name, func) {
    if (typeof func !== "function") {
      throw new Error(`Function '${name}' must be a function`);
    }
    this.functions.set(name, func);
  }

  getFunction(name) {
    return this.functions.get(name);
  }

  hasFunction(name) {
    return this.functions.has(name);
  }

  removeFunction(name) {
    this.functions.delete(name);
  }

  // ============ Data Source Management ============

  /**
   * Add a data source
   * @param {string} name - Data source name
   * @param {Function} source - Async function or wrapper function
   */
  addDataSource(name, source) {
    if (typeof source !== "function") {
      throw new Error(`Data source '${name}' must be a function`);
    }

    // If source is a wrapper that takes transaction, call it now to get actual async function
    const asyncFunc = source.length > 0 ? source(this) : source;

    if (typeof asyncFunc !== "function") {
      throw new Error(
        `Data source '${name}' wrapper must return an async function`,
      );
    }

    this.dataSources.set(name, asyncFunc);
  }

  /**
   * Update existing data source
   */
  setDataSource(name, source) {
    this.addDataSource(name, source);
  }

  /**
   * Check if data source exists
   */
  hasDataSource(name) {
    return this.dataSources.has(name);
  }

  /**
   * Remove data source
   */
  removeDataSource(name) {
    this.dataSources.delete(name);
    this.dataSourceResults.delete(name);
    this.dataSourceErrors.delete(name);
  }

  /**
   * Get all data source names
   */
  getDataSourceNames() {
    return Array.from(this.dataSources.keys());
  }

  // ============ Data Source Execution ============

  /**
   * Fetch a single data source
   */
  async fetchDataSource(name) {
    if (!this.dataSources.has(name)) {
      throw new Error(`Data source '${name}' not found`);
    }

    // Check if already fetched
    if (this.dataSourceResults.has(name)) {
      return this.dataSourceResults.get(name);
    }

    // Check if previous fetch failed
    if (this.dataSourceErrors.has(name)) {
      throw this.dataSourceErrors.get(name);
    }

    const source = this.dataSources.get(name);

    try {
      // Create timeout promise with cancellable timer
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Data source '${name}' timed out after ${this.config.timeout}ms`,
            ),
          );
        }, this.config.timeout);
      });

      try {
        // Race between data fetch and timeout
        const result = await Promise.race([source(), timeoutPromise]);

        // CRITICAL: Clear timeout on success to prevent memory leak
        clearTimeout(timeoutId);

        // Cache result
        this.dataSourceResults.set(name, result);

        return result;
      } catch (raceError) {
        // CRITICAL: Clear timeout on error too
        clearTimeout(timeoutId);
        throw raceError;
      }
    } catch (error) {
      // Create structured error
      const structuredError = {
        message: error.message || "Unknown error",
        code: error.code || "FETCH_ERROR",
        source: name,
        timestamp: Date.now(),
        originalError: error,
      };

      // Cache error
      this.dataSourceErrors.set(name, structuredError);

      throw structuredError;
    }
  }

  /**
   * Fetch multiple data sources in parallel
   */
  async fetchDataSources(names) {
    const results = await Promise.allSettled(
      names.map((name) => this.fetchDataSource(name)),
    );

    const successfulResults = {};
    const errors = {};

    results.forEach((result, index) => {
      const name = names[index];
      if (result.status === "fulfilled") {
        successfulResults[name] = result.value;
      } else {
        errors[name] = result.reason;
      }
    });

    return { results: successfulResults, errors };
  }

  /**
   * Get cached data source result
   */
  getDataSourceResult(name) {
    return this.dataSourceResults.get(name);
  }

  /**
   * Check if data source has been fetched
   */
  hasDataSourceResult(name) {
    return this.dataSourceResults.has(name);
  }

  /**
   * Get cached data source error
   */
  getDataSourceError(name) {
    return this.dataSourceErrors.get(name);
  }

  /**
   * Check if data source fetch failed
   */
  hasDataSourceError(name) {
    return this.dataSourceErrors.has(name);
  }

  /**
   * Clear all data source caches
   */
  clearDataSourceCache() {
    this.dataSourceResults.clear();
    this.dataSourceErrors.clear();
  }

  // ============ Transaction Management ============

  /**
   * Reset transaction to initial state
   */
  reset() {
    this.variables.clear();
    this.functions.clear();
    this.dataSources.clear();
    this.dataSourceResults.clear();
    this.dataSourceErrors.clear();
  }

  /**
   * Clone transaction (creates independent copy)
   */
  clone() {
    const cloned = new Transaction({
      variables: Object.fromEntries(this.variables),
      functions: Object.fromEntries(this.functions),
      config: { ...this.config },
    });

    // Copy data sources
    for (const [name, source] of this.dataSources.entries()) {
      cloned.dataSources.set(name, source);
    }

    // Copy cached results
    for (const [name, result] of this.dataSourceResults.entries()) {
      cloned.dataSourceResults.set(name, result);
    }

    // Copy cached errors
    for (const [name, error] of this.dataSourceErrors.entries()) {
      cloned.dataSourceErrors.set(name, error);
    }

    return cloned;
  }
}
