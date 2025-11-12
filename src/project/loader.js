/**
 * File Loader for Multi-File OX System
 *
 * Responsibilities:
 * - Read .ox files from disk
 * - Parse files with core parser
 * - Cache parsed ASTs (parse each file once)
 * - Track loaded files
 * - Handle file not found errors
 */

import fs from "fs";
import path from "path";
import { parse } from "../parser/parser.js";

// Security: Maximum file size (10MB) to prevent DOS attacks
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Security: Maximum total cache size (100MB) to prevent memory exhaustion
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

/**
 * FileLoader loads and caches parsed OX files
 */
export class FileLoader {
  /**
   * @param {Object} config - Project configuration from loadConfig()
   * @param {Object} options - Optional configuration
   * @param {number} options.maxFileSize - Maximum file size in bytes (default: 10MB)
   * @param {number} options.maxCacheSize - Maximum total cache size in bytes (default: 100MB)
   */
  constructor(config, options = {}) {
    this.config = config;
    this.maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
    this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE;

    // Cache: filePath -> { ast, content, filePath, size }
    this.cache = new Map();

    // Track load order for debugging
    this.loadOrder = [];

    // Security: Track aggregate cache size
    this.currentCacheSize = 0;
  }

  /**
   * Load and parse a single file
   * Returns cached AST if already loaded
   *
   * @param {string} filePath - Absolute path to .ox file
   * @returns {Object} { ast, content, filePath }
   * @throws {Error} If file not found or parse error
   */
  loadFile(filePath) {
    // Normalize path for consistent caching
    const normalizedPath = path.normalize(filePath);

    // Return cached if available
    if (this.cache.has(normalizedPath)) {
      return this.cache.get(normalizedPath);
    }

    // Validate .ox extension
    if (path.extname(normalizedPath) !== ".ox") {
      throw new Error(
        `Invalid file extension: '${normalizedPath}'. ` +
          `OX files must have .ox extension.`,
      );
    }

    // Check file exists
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`File not found: '${normalizedPath}'`);
    }

    // Security: Check file size before reading
    const stats = fs.statSync(normalizedPath);
    if (stats.size > this.maxFileSize) {
      throw new Error(
        `File too large: '${normalizedPath}' (${stats.size} bytes). ` +
          `Maximum allowed: ${this.maxFileSize} bytes (${(this.maxFileSize / 1024 / 1024).toFixed(1)}MB)`,
      );
    }

    // Security: Check aggregate cache size limit
    if (this.currentCacheSize + stats.size > this.maxCacheSize) {
      throw new Error(
        `Cache size limit exceeded. Current: ${(this.currentCacheSize / 1024 / 1024).toFixed(2)}MB, ` +
          `File: ${(stats.size / 1024 / 1024).toFixed(2)}MB, ` +
          `Limit: ${(this.maxCacheSize / 1024 / 1024).toFixed(1)}MB. ` +
          `Consider increasing maxCacheSize or clearing cache.`,
      );
    }

    // Read file content
    let content;
    try {
      content = fs.readFileSync(normalizedPath, "utf-8");
    } catch (err) {
      throw new Error(
        `Failed to read file '${normalizedPath}': ${err.message}`,
      );
    }

    // Security: Verify content size matches (TOCTOU protection)
    const contentSize = Buffer.byteLength(content, "utf-8");
    if (contentSize > this.maxFileSize) {
      throw new Error(
        `File grew beyond size limit during read: '${normalizedPath}'`,
      );
    }

    // Parse the file
    let ast;
    try {
      ast = parse(content, normalizedPath);
    } catch (err) {
      // Re-throw with file context
      throw new Error(`Parse error in '${normalizedPath}': ${err.message}`);
    }

    // Cache the result with size tracking
    const result = {
      ast,
      content,
      filePath: normalizedPath,
      size: contentSize,
    };

    this.cache.set(normalizedPath, result);
    this.loadOrder.push(normalizedPath);
    this.currentCacheSize += contentSize;

    return result;
  }

  /**
   * Get cached AST for a file (returns null if not loaded)
   *
   * @param {string} filePath - Absolute path to .ox file
   * @returns {Object|null} Cached result or null
   */
  getCache(filePath) {
    const normalizedPath = path.normalize(filePath);
    return this.cache.get(normalizedPath) || null;
  }

  /**
   * Check if a file has been loaded
   *
   * @param {string} filePath - Absolute path to .ox file
   * @returns {boolean} True if file is in cache
   */
  hasLoaded(filePath) {
    const normalizedPath = path.normalize(filePath);
    return this.cache.has(normalizedPath);
  }

  /**
   * Get all loaded file paths (in load order)
   *
   * @returns {string[]} Array of absolute file paths
   */
  getLoadedFiles() {
    return [...this.loadOrder];
  }

  /**
   * Clear all cached files
   */
  clearCache() {
    this.cache.clear();
    this.loadOrder = [];
    this.currentCacheSize = 0;
  }

  /**
   * Get cache statistics for debugging
   *
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      filesLoaded: this.cache.size,
      loadOrder: this.loadOrder,
      cacheSize: this.cache.size,
      currentCacheSizeBytes: this.currentCacheSize,
      currentCacheSizeMB: (this.currentCacheSize / 1024 / 1024).toFixed(2),
      maxCacheSizeMB: (this.maxCacheSize / 1024 / 1024).toFixed(1),
    };
  }

  /**
   * Reload a specific file (useful for hot-reloading)
   *
   * @param {string} filePath - Absolute path to .ox file
   * @returns {Object} { ast, content, filePath }
   */
  reloadFile(filePath) {
    const normalizedPath = path.normalize(filePath);

    // Get old cached entry to update size tracking
    const oldEntry = this.cache.get(normalizedPath);
    if (oldEntry && oldEntry.size) {
      this.currentCacheSize -= oldEntry.size;
    }

    // Remove from cache
    this.cache.delete(normalizedPath);

    // Remove from load order
    const index = this.loadOrder.indexOf(normalizedPath);
    if (index !== -1) {
      this.loadOrder.splice(index, 1);
    }

    // Load fresh
    return this.loadFile(normalizedPath);
  }
}
