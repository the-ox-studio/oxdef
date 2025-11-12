/**
 * Configuration Loader for CLI
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Load ox.config.js from the current directory or specified path
 */
export async function loadCLIConfig(configPath = null) {
  // If explicit path provided, use it
  if (configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    return await importConfig(configPath);
  }

  // Look for ox.config.js in current directory
  const cwd = process.cwd();
  const jsPath = path.join(cwd, "ox.config.js");
  const jsonPath = path.join(cwd, "ox.config.json");

  if (fs.existsSync(jsPath)) {
    return await importConfig(jsPath);
  } else if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, "utf-8");
    return JSON.parse(content);
  }

  // Return default config if no config file found
  return {
    baseDir: cwd,
    entryPoint: "main.ox",
    outputDir: "./dist",
    moduleDirectories: ["node_modules"],
  };
}

/**
 * Import a JS config file (ESM)
 */
async function importConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  const fileUrl = pathToFileURL(absolutePath).href;

  const module = await import(fileUrl);
  return module.default || module;
}

/**
 * Validate and normalize CLI config
 */
export function validateCLIConfig(config) {
  if (!config.baseDir) {
    config.baseDir = process.cwd();
  }

  if (!config.entryPoint) {
    throw new Error("Config must specify 'entryPoint'");
  }

  if (!config.outputDir) {
    config.outputDir = "./dist";
  }

  // Ensure outputDir is absolute
  if (!path.isAbsolute(config.outputDir)) {
    config.outputDir = path.resolve(config.baseDir, config.outputDir);
  }

  // Ensure baseDir is absolute
  if (!path.isAbsolute(config.baseDir)) {
    config.baseDir = path.resolve(config.baseDir);
  }

  return config;
}
