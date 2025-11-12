/**
 * Build Script: OX to JSON
 *
 * Converts parsed OX blocks to JSON format
 */

import fs from "fs";
import path from "path";

/**
 * Build function called by oxdef CLI
 *
 * @param {OXProject} project - The OXProject instance
 * @param {Array} blocks - Parsed blocks from the entry point
 * @param {Object} config - Configuration from ox.config.js
 * @returns {Object} Build result with output files
 */
export default async function build(project, blocks, config) {
  // Ensure output directory exists
  const outputDir = config.outputDir || "./dist";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert blocks to JSON
  const json = JSON.stringify(blocks, null, 2);

  // Write output file
  const outputFile = path.join(outputDir, "output.json");
  fs.writeFileSync(outputFile, json, "utf-8");

  // Return build result
  return {
    files: [outputFile],
    blocks: blocks.length,
  };
}
