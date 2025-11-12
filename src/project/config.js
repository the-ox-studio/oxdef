/**
 * Config Parser - Load and parse OX project configuration
 *
 * Supports:
 * - ox.config.js (ES modules)
 * - ox.config.json
 * - Default configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  // Entry point (auto-detected if not specified)
  entry: null,

  // Base directory for resolution
  baseDir: './',

  // Module directories (Node.js style)
  moduleDirectories: ['node_modules'],

  // Package resolution defaults
  packageDefaults: {
    oxDirectory: 'ox',
    oxMain: 'index.ox',
    configFile: 'ox.config.json'
  }
};

/**
 * Load configuration from project directory
 *
 * @param {string} projectDir - Project directory path
 * @returns {Promise<Object>} Merged configuration
 */
export async function loadConfig(projectDir) {
  const configPath = findConfigFile(projectDir);

  if (!configPath) {
    // No config file found, use defaults
    return {
      ...DEFAULT_CONFIG,
      baseDir: projectDir
    };
  }

  const config = await parseConfigFile(configPath);

  // Merge with defaults
  return mergeConfig(DEFAULT_CONFIG, config, projectDir);
}

/**
 * Find config file in project directory
 *
 * Looks for (in order):
 * 1. ox.config.js
 * 2. ox.config.json
 *
 * @param {string} projectDir - Project directory
 * @returns {string|null} Config file path or null
 */
export function findConfigFile(projectDir) {
  const candidates = [
    path.join(projectDir, 'ox.config.js'),
    path.join(projectDir, 'ox.config.json')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Parse config file based on extension
 *
 * @param {string} configPath - Path to config file
 * @returns {Promise<Object>} Parsed configuration
 */
export async function parseConfigFile(configPath) {
  const ext = path.extname(configPath);

  if (ext === '.js') {
    return await parseJSConfig(configPath);
  } else if (ext === '.json') {
    return parseJSONConfig(configPath);
  } else {
    throw new Error(`Unsupported config file extension: ${ext}`);
  }
}

/**
 * Parse JavaScript config file (ES modules)
 *
 * @param {string} configPath - Path to .js config
 * @returns {Promise<Object>} Parsed configuration
 */
export async function parseJSConfig(configPath) {
  try {
    // Convert to file URL for dynamic import
    const fileUrl = `file:///${configPath.replace(/\\/g, '/')}`;
    const module = await import(fileUrl);

    // Support both default export and named exports
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to load config from ${configPath}: ${error.message}`
    );
  }
}

/**
 * Parse JSON config file
 *
 * @param {string} configPath - Path to .json config
 * @returns {Object} Parsed configuration
 */
export function parseJSONConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse config from ${configPath}: ${error.message}`
    );
  }
}

/**
 * Merge user config with defaults
 *
 * @param {Object} defaults - Default configuration
 * @param {Object} userConfig - User-provided configuration
 * @param {string} projectDir - Project directory
 * @returns {Object} Merged configuration
 */
export function mergeConfig(defaults, userConfig, projectDir) {
  const merged = { ...defaults };

  // Entry point
  if (userConfig.entry) {
    merged.entry = userConfig.entry;
  }

  // Base directory (resolve relative to project dir)
  if (userConfig.baseDir) {
    merged.baseDir = path.resolve(projectDir, userConfig.baseDir);
  } else {
    merged.baseDir = projectDir;
  }

  // Module directories
  if (userConfig.moduleDirectories) {
    merged.moduleDirectories = userConfig.moduleDirectories;
  }

  // Package defaults (deep merge)
  if (userConfig.packageDefaults) {
    merged.packageDefaults = {
      ...defaults.packageDefaults,
      ...userConfig.packageDefaults
    };
  }

  return merged;
}

/**
 * Validate configuration
 *
 * @param {Object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config) {
  // Validate base directory exists
  if (!fs.existsSync(config.baseDir)) {
    throw new Error(`Base directory does not exist: ${config.baseDir}`);
  }

  // Validate base directory is a directory
  const stats = fs.statSync(config.baseDir);
  if (!stats.isDirectory()) {
    throw new Error(`Base directory is not a directory: ${config.baseDir}`);
  }

  // Validate module directories
  if (!Array.isArray(config.moduleDirectories)) {
    throw new Error('moduleDirectories must be an array');
  }

  // Validate package defaults
  if (typeof config.packageDefaults !== 'object') {
    throw new Error('packageDefaults must be an object');
  }

  if (!config.packageDefaults.oxDirectory) {
    throw new Error('packageDefaults.oxDirectory is required');
  }

  if (!config.packageDefaults.oxMain) {
    throw new Error('packageDefaults.oxMain is required');
  }
}

/**
 * Auto-detect entry point
 *
 * Looks for (in order):
 * 1. Explicit entry in config
 * 2. index.ox
 * 3. main.ox
 *
 * @param {Object} config - Project configuration
 * @returns {string} Entry point path
 * @throws {Error} If entry point not found
 */
export function detectEntryPoint(config) {
  // If explicitly specified, use it
  if (config.entry) {
    const entryPath = path.resolve(config.baseDir, config.entry);
    if (fs.existsSync(entryPath)) {
      return entryPath;
    }
    throw new Error(`Entry point not found: ${config.entry}`);
  }

  // Auto-detect: try index.ox, then main.ox
  const candidates = ['index.ox', 'main.ox'];

  for (const candidate of candidates) {
    const candidatePath = path.join(config.baseDir, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `No entry point found in ${config.baseDir}. ` +
    `Create index.ox, main.ox, or specify 'entry' in config.`
  );
}
