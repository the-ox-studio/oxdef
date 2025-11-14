/**
 * Path Resolver - Resolve import paths (relative and package)
 *
 * Supports:
 * - Relative paths: ./file.ox, ../dir/file.ox
 * - Package paths: @scope/package/file.ox
 */

import fs from "fs";
import path from "path";

/**
 * Resolve import path
 *
 * @param {string} importPath - Import path from <import> or <inject>
 * @param {string} currentFile - Path of file containing the import
 * @param {Object} config - Project configuration
 * @returns {string} Resolved absolute path
 * @throws {Error} If path cannot be resolved
 */
export function resolveImportPath(importPath, currentFile, config) {
  // Validate import path is not empty
  if (!importPath || typeof importPath !== "string") {
    throw new Error(`Invalid import path: must be a non-empty string`);
  }

  // Validate import path has .ox extension
  if (!importPath.endsWith(".ox")) {
    throw new Error(`Import path must include .ox extension: '${importPath}'`);
  }

  // Security: Validate no null bytes (can bypass security checks)
  if (importPath.includes("\0")) {
    throw new Error(`Invalid import path: contains null byte`);
  }

  // Security: Validate no invalid filename characters (applies to all paths)
  if (/[<>"|?*]/.test(importPath)) {
    throw new Error(
      `Invalid import path: contains invalid characters: '${importPath}'`,
    );
  }

  // Relative import (starts with ./ or ../)
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    return resolveRelativePath(importPath, currentFile, config);
  }

  // Package import (starts with @ or package name)
  if (importPath.startsWith("@") || !importPath.includes("/")) {
    return resolvePackagePath(importPath, config);
  }

  // Assume it's a package path without @ prefix
  return resolvePackagePath(importPath, config);
}

/**
 * Resolve relative import path
 *
 * @param {string} importPath - Relative path (./file.ox or ../dir/file.ox)
 * @param {string} currentFile - Path of importing file
 * @param {Object} config - Project configuration (optional, for security boundary check)
 * @returns {string} Resolved absolute path
 * @throws {Error} If file doesn't exist or path traversal detected
 */
export function resolveRelativePath(importPath, currentFile, config = null) {
  const currentDir = path.dirname(currentFile);
  let resolvedPath = path.resolve(currentDir, importPath);

  // Security: Check path boundaries BEFORE checking file existence
  // This prevents information disclosure about filesystem structure
  if (config && config.baseDir) {
    const normalizedBase = path.resolve(config.baseDir);
    const relativePath = path.relative(normalizedBase, resolvedPath);

    // If relative path starts with '..' or is absolute, it's outside baseDir
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(
        `Security: Import path '${importPath}' resolves outside project boundaries. ` +
          `Attempted path: ${resolvedPath}, Base: ${normalizedBase}`,
      );
    }
  }

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Cannot resolve import '${importPath}' from '${currentFile}': ` +
        `File not found at ${resolvedPath}`,
    );
  }

  // Security: Resolve symbolic links to get real path and revalidate
  try {
    const realPath = fs.realpathSync(resolvedPath);

    // Revalidate after resolving symlinks
    if (config && config.baseDir) {
      let normalizedBase;
      try {
        normalizedBase = fs.realpathSync(config.baseDir);
      } catch (err) {
        normalizedBase = path.resolve(config.baseDir);
      }

      const relativePath = path.relative(normalizedBase, realPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(
          `Security: Symlink resolves outside project boundaries. ` +
            `Real path: ${realPath}, Base: ${normalizedBase}`,
        );
      }
    }

    resolvedPath = realPath;
  } catch (err) {
    // If realpathSync fails for reasons other than our security check, throw original error
    if (!err.message.includes("Security:")) {
      throw new Error(
        `Cannot resolve real path for '${importPath}': ${err.message}`,
      );
    }
    throw err;
  }

  return resolvedPath;
}

/**
 * Resolve package import path
 *
 * Example: "@my-ui-lib/components/button.ox"
 *
 * Resolution algorithm:
 * 1. Find package in node_modules
 * 2. Read package ox.config.json or ox.config.js
 * 3. Use 'source' field to locate OX files
 * 4. Resolve file path within source directory
 *
 * @param {string} importPath - Package path
 * @param {Object} config - Project configuration
 * @returns {string} Resolved absolute path
 * @throws {Error} If package or file not found
 */
export function resolvePackagePath(importPath, config) {
  // Split package path: @scope/package/path/to/file.ox
  const parts = importPath.split("/");

  let packageName;
  let filePath;

  if (parts[0].startsWith("@")) {
    // Scoped package: @scope/package
    packageName = `${parts[0]}/${parts[1]}`;
    filePath = parts.slice(2).join("/");
  } else {
    // Regular package: package
    packageName = parts[0];
    filePath = parts.slice(1).join("/");
  }

  // Find package directory
  const packageDir = findPackageDirectory(
    packageName,
    config.baseDir,
    config.moduleDirectories,
  );

  if (!packageDir) {
    throw new Error(
      `Cannot resolve package '${packageName}': ` +
        `Package not found in ${config.moduleDirectories.join(", ")}`,
    );
  }

  // Read package config
  const packageConfig = readPackageConfig(packageDir, config.packageDefaults);

  // Resolve file within package
  const resolvedPath = resolveFileInPackage(
    filePath,
    packageDir,
    packageConfig,
  );

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Cannot resolve '${importPath}': ` + `File not found at ${resolvedPath}`,
    );
  }

  return resolvedPath;
}

/**
 * Find package directory in module directories
 *
 * @param {string} packageName - Package name (e.g., "@scope/package")
 * @param {string} baseDir - Project base directory
 * @param {string[]} moduleDirectories - Module directory names
 * @returns {string|null} Package directory path or null
 */
export function findPackageDirectory(packageName, baseDir, moduleDirectories) {
  for (const moduleDir of moduleDirectories) {
    const modulePath = path.join(baseDir, moduleDir, packageName);

    if (fs.existsSync(modulePath)) {
      const stats = fs.statSync(modulePath);
      if (stats.isDirectory()) {
        return modulePath;
      }
    }
  }

  return null;
}

/**
 * Read package OX configuration
 *
 * Looks for:
 * 1. ox.config.json
 * 2. ox.config.js
 * 3. Fallback to defaults
 *
 * @param {string} packageDir - Package directory
 * @param {Object} defaults - Default package configuration
 * @returns {Object} Package configuration
 */
export function readPackageConfig(packageDir, defaults) {
  // Try ox.config.json
  const jsonConfigPath = path.join(packageDir, "ox.config.json");
  if (fs.existsSync(jsonConfigPath)) {
    try {
      const content = fs.readFileSync(jsonConfigPath, "utf-8");
      const config = JSON.parse(content);
      return {
        source: config.source || defaults.oxDirectory,
        main: config.main || defaults.oxMain,
      };
    } catch (error) {
      // Fall through to defaults
    }
  }

  // Try ox.config.js (synchronous for simplicity)
  const jsConfigPath = path.join(packageDir, "ox.config.js");
  if (fs.existsSync(jsConfigPath)) {
    try {
      // For now, skip JS config (requires async import)
      // TODO: Support async config loading
    } catch (error) {
      // Fall through to defaults
    }
  }

  // Fallback to defaults
  return {
    source: defaults.oxDirectory,
    main: defaults.oxMain,
  };
}

/**
 * Resolve file path within package
 *
 * @param {string} filePath - File path within package
 * @param {string} packageDir - Package directory
 * @param {Object} packageConfig - Package configuration
 * @returns {string} Resolved absolute path
 */
export function resolveFileInPackage(filePath, packageDir, packageConfig) {
  // Security: Validate source directory doesn't escape package boundaries
  const sourceDir = path.resolve(packageDir, packageConfig.source);

  // Check that source dir is within package directory
  const relativePath = path.relative(packageDir, sourceDir);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Security: Package source directory '${packageConfig.source}' ` +
        `escapes package boundaries at '${packageDir}'`,
    );
  }

  // Security: Validate final resolved path stays within source directory
  const resolvedFile = path.resolve(sourceDir, filePath);
  const relativeToSource = path.relative(sourceDir, resolvedFile);
  if (relativeToSource.startsWith("..") || path.isAbsolute(relativeToSource)) {
    throw new Error(
      `Security: File path '${filePath}' escapes package source directory`,
    );
  }

  return resolvedFile;
}

/**
 * Normalize path separators for consistent comparison
 *
 * @param {string} filePath - File path
 * @returns {string} Normalized path
 */
export function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, "/");
}

/**
 * Get relative path for error messages
 *
 * @param {string} filePath - Absolute file path
 * @param {string} baseDir - Base directory
 * @returns {string} Relative path for display
 */
export function getRelativePathForDisplay(filePath, baseDir) {
  const relative = path.relative(baseDir, filePath);
  return normalizePath(relative);
}
