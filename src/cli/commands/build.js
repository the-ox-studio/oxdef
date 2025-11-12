/**
 * Build Command
 * Parses OX files and runs a build script
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import chalk from "chalk";
import { OXProject } from "../../project/project.js";
import { logger } from "../utils/logger.js";
import { loadCLIConfig, validateCLIConfig } from "../utils/config-loader.js";

/**
 * Execute the build command
 *
 * @param {string} buildScriptPath - Path to build script (optional)
 * @param {Object} options - CLI options
 */
export async function buildCommand(buildScriptPath = null, options = {}) {
  const startTime = Date.now();

  // Load configuration
  logger.info("Loading configuration...");
  let config = await loadCLIConfig(options.config);
  config = validateCLIConfig(config);

  logger.debug(`Base directory: ${config.baseDir}`);
  logger.debug(`Entry point: ${config.entryPoint}`);
  logger.debug(`Output directory: ${config.outputDir}`);

  // Create OXProject
  logger.info(`Parsing OX project: ${config.entryPoint}`);
  const project = OXProject.fromDirectory(config.baseDir, config);

  // Parse the project
  const parseStart = Date.now();
  const blocks = project.parse();
  const parseTime = Date.now() - parseStart;

  logger.success(
    `Parsed ${blocks.length} blocks in ${logger.formatDuration(parseTime)}`,
  );

  // Get loaded files for reporting
  const loadedFiles = project.getLoadedFiles();
  logger.debug(`Loaded ${loadedFiles.length} files`);

  // If no build script specified, just validate and exit
  if (!buildScriptPath) {
    logger.success("Validation complete");
    logger.newline();
    logger.log(`  Files loaded: ${loadedFiles.length}`);
    logger.log(`  Blocks parsed: ${blocks.length}`);
    logger.log(`  Time: ${logger.formatDuration(Date.now() - startTime)}`);
    logger.newline();
    return { blocks, files: loadedFiles, time: Date.now() - startTime };
  }

  // Load and execute build script
  logger.info(`Running build script: ${buildScriptPath}`);

  const scriptPath = path.resolve(buildScriptPath);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Build script not found: ${scriptPath}`);
  }

  const buildStart = Date.now();
  const result = await executeBuildScript(scriptPath, project, blocks, config);
  const buildTime = Date.now() - buildStart;

  // Report results
  logger.newline();
  logger.success(chalk.bold("Build complete"));
  logger.newline();

  if (result.files && result.files.length > 0) {
    logger.log(`  Output files: ${result.files.length}`);
    result.files.forEach((file) => {
      const relativePath = path.relative(process.cwd(), file);
      logger.log(chalk.gray(`    • ${relativePath}`));
    });
  }

  logger.log(`  Parse time: ${logger.formatDuration(parseTime)}`);
  logger.log(`  Build time: ${logger.formatDuration(buildTime)}`);
  logger.log(`  Total time: ${logger.formatDuration(Date.now() - startTime)}`);
  logger.newline();

  return { blocks, ...result };
}

/**
 * Load and execute a build script
 */
async function executeBuildScript(scriptPath, project, blocks, config) {
  const absolutePath = path.resolve(scriptPath);
  const fileUrl = pathToFileURL(absolutePath).href;

  try {
    const module = await import(fileUrl);
    const buildFn = module.default || module.build;

    if (typeof buildFn !== "function") {
      throw new Error(
        `Build script must export a default function or 'build' function`,
      );
    }

    // Execute build function
    const result = await buildFn(project, blocks, config);

    return result || {};
  } catch (error) {
    // Enhance error with build script context
    error.buildScript = true;
    error.scriptPath = scriptPath;
    throw error;
  }
}
