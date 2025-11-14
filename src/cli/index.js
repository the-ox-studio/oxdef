#!/usr/bin/env node

/**
 * OXDef CLI - Main Entry Point
 */

import { Command } from "commander";
import { buildCommand } from "./commands/build.js";
import { handleError, withErrorHandling } from "./utils/error-handler.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
);

const program = new Command();

program
  .name("oxdef")
  .description("OX Language Definition CLI - Build and process OX files")
  .version(packageJson.version);

// Build command
program
  .command("build [script]")
  .description("Parse OX files and optionally run a build script")
  .option("-c, --config <path>", "Path to config file (ox.config.js)")
  .option("-v, --verbose", "Show verbose output including stack traces")
  .action(async (script, options) => {
    await withErrorHandling(
      async () => {
        await buildCommand(script, options);
      },
      { verbose: options.verbose },
    );
  });

// Validate command (alias for build without script)
program
  .command("validate")
  .description("Validate OX syntax without building")
  .option("-c, --config <path>", "Path to config file (ox.config.js)")
  .option("-v, --verbose", "Show verbose output including stack traces")
  .action(async (options) => {
    await withErrorHandling(
      async () => {
        await buildCommand(null, options);
      },
      { verbose: options.verbose },
    );
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
