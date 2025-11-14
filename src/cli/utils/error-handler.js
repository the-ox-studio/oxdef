/**
 * CLI Error Handler
 * Formats errors in a user-friendly way
 */

import chalk from "chalk";
import { logger } from "./logger.js";

/**
 * Handle CLI errors with nice formatting
 */
export function handleError(error, options = {}) {
  const { exit = true, verbose = false } = options;

  logger.newline();
  logger.error(chalk.bold("Build failed"));
  logger.newline();

  // Parse error (syntax error in OX file)
  if (error.name === "ParseError") {
    logger.log(chalk.red("  Syntax Error:"));
    logger.log(`  ${error.message}`);

    if (error.location) {
      logger.log(
        chalk.gray(
          `  at ${error.location.file}:${error.location.line}:${error.location.column}`,
        ),
      );
    }
  }
  // File not found, permission errors, etc.
  else if (error.code === "ENOENT") {
    logger.log(chalk.red("  File not found:"));
    logger.log(`  ${error.path || error.message}`);
  } else if (error.code === "EACCES") {
    logger.log(chalk.red("  Permission denied:"));
    logger.log(`  ${error.path || error.message}`);
  }
  // Validation errors from InputValidator
  else if (error instanceof TypeError) {
    logger.log(chalk.red("  Invalid input:"));
    logger.log(`  ${error.message}`);
  }
  // Circular dependency errors
  else if (error.message.match(/circular.*dependency/i)) {
    logger.log(chalk.red("  Circular dependency detected:"));
    logger.log(`  ${error.message}`);
  }
  // Build script errors
  else if (error.buildScript) {
    logger.log(chalk.red("  Build script error:"));
    logger.log(`  ${error.message}`);

    if (error.scriptPath) {
      logger.log(chalk.gray(`  in ${error.scriptPath}`));
    }
  }
  // Generic error
  else {
    logger.log(chalk.red("  Error:"));
    logger.log(`  ${error.message}`);
  }

  // Verbose mode: show stack trace
  if (verbose && error.stack) {
    logger.newline();
    logger.log(chalk.gray("Stack trace:"));
    logger.log(chalk.gray(error.stack));
  }

  logger.newline();

  if (exit) {
    process.exit(1);
  }
}

/**
 * Wrap a promise/function and handle errors
 */
export async function withErrorHandling(fn, options = {}) {
  try {
    return await fn();
  } catch (error) {
    handleError(error, options);
  }
}
