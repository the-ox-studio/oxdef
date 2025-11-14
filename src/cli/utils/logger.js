/**
 * CLI Logger with colored output
 */

import chalk from "chalk";

export const logger = {
  info(message) {
    console.log(chalk.blue("ℹ"), message);
  },

  success(message) {
    console.log(chalk.green("✔"), message);
  },

  warn(message) {
    console.log(chalk.yellow("⚠"), message);
  },

  error(message) {
    console.log(chalk.red("✖"), message);
  },

  debug(message) {
    if (process.env.DEBUG) {
      console.log(chalk.gray("→"), message);
    }
  },

  log(message) {
    console.log(message);
  },

  newline() {
    console.log();
  },

  /**
   * Format a duration in milliseconds to human-readable string
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  },

  /**
   * Format file size in bytes to human-readable string
   */
  formatSize(bytes) {
    if (bytes < 1024) {
      return `${bytes}B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)}KB`;
    } else {
      return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    }
  },
};
