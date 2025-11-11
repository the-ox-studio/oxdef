/**
 * Base error class for OX parsing and preprocessing errors
 */
export class OXError extends Error {
  constructor(message, location = null) {
    super(message);
    this.name = 'OXError';
    this.location = location;
  }

  toString() {
    if (this.location) {
      return `${this.name}: ${this.message}\n  at ${this.location.file || '<input>'}:${this.location.line}:${this.location.column}`;
    }
    return `${this.name}: ${this.message}`;
  }
}

/**
 * Parse errors (Stage 1 - fail fast)
 */
export class ParseError extends OXError {
  constructor(message, location = null, context = null) {
    super(message, location);
    this.name = 'ParseError';
    this.context = context;
  }
}

/**
 * Preprocessing errors (Stage 2 - collect all)
 */
export class PreprocessError extends OXError {
  constructor(message, subtype, location = null, context = null, suggestion = null) {
    super(message, location);
    this.name = 'PreprocessError';
    this.subtype = subtype;
    this.context = context;
    this.suggestion = suggestion;
  }
}

/**
 * Warning (non-fatal issues)
 */
export class OXWarning {
  constructor(type, message, location = null) {
    this.type = type;
    this.message = message;
    this.location = location;
  }

  toString() {
    if (this.location) {
      return `Warning [${this.type}]: ${this.message}\n  at ${this.location.file || '<input>'}:${this.location.line}:${this.location.column}`;
    }
    return `Warning [${this.type}]: ${this.message}`;
  }
}

/**
 * Create a location object
 */
export function createLocation(file, line, column) {
  return { file, line, column };
}

/**
 * Error collector for preprocessing phase
 */
export class ErrorCollector {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  clear() {
    this.errors = [];
    this.warnings = [];
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      hasErrors: this.hasErrors(),
      hasWarnings: this.hasWarnings()
    };
  }
}
