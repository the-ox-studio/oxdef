/**
 * Build Script: OX to HTML
 *
 * Converts parsed OX blocks to an HTML visualization
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

  // Generate HTML
  const html = generateHTML(blocks, config);

  // Write output file
  const outputFile = path.join(outputDir, "index.html");
  fs.writeFileSync(outputFile, html, "utf-8");

  // Return build result
  return {
    files: [outputFile],
    blocks: blocks.length,
  };
}

/**
 * Generate HTML from blocks
 */
function generateHTML(blocks, config) {
  const title = config.title || "OX Document";
  const blocksHTML = blocks.map((block) => blockToHTML(block, 0)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .block {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin: 10px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .block-header {
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 12px;
      font-size: 18px;
    }
    .block-id {
      color: #7c3aed;
      font-family: monospace;
    }
    .properties {
      background: #f9fafb;
      border-left: 3px solid #2563eb;
      padding: 12px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .property {
      margin: 4px 0;
      font-family: monospace;
      font-size: 14px;
    }
    .property-name {
      color: #059669;
      font-weight: 600;
    }
    .property-value {
      color: #dc2626;
    }
    .children {
      margin-left: 20px;
      margin-top: 10px;
      border-left: 2px solid #e5e7eb;
      padding-left: 15px;
    }
    .tags {
      display: inline-flex;
      gap: 6px;
      margin-left: 10px;
    }
    .tag {
      background: #dbeafe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    h1 {
      color: #1f2937;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
    }
  </style>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
  ${blocksHTML}
</body>
</html>`;
}

/**
 * Convert a single block to HTML
 */
function blockToHTML(block, depth) {
  if (!block || typeof block !== "object") {
    return "";
  }

  const indent = "  ".repeat(depth);
  let html = `${indent}<div class="block">`;

  // Block header with ID
  const tags = block.tags && block.tags.length > 0
    ? `<span class="tags">${block.tags.map(t => `<span class="tag">${escapeHTML(formatTag(t))}</span>`).join("")}</span>`
    : "";

  html += `\n${indent}  <div class="block-header">`;
  html += `<span class="block-id">${escapeHTML(block.id || "Block")}</span>`;
  html += tags;
  html += `</div>`;

  // Properties
  if (block.properties && Object.keys(block.properties).length > 0) {
    html += `\n${indent}  <div class="properties">`;
    for (const [key, value] of Object.entries(block.properties)) {
      const formattedValue = formatValue(value);
      html += `\n${indent}    <div class="property">`;
      html += `<span class="property-name">${escapeHTML(key)}</span>: `;
      html += `<span class="property-value">${escapeHTML(formattedValue)}</span>`;
      html += `</div>`;
    }
    html += `\n${indent}  </div>`;
  }

  // Children
  if (block.children && block.children.length > 0) {
    html += `\n${indent}  <div class="children">`;
    block.children.forEach((child) => {
      html += "\n" + blockToHTML(child, depth + 2);
    });
    html += `\n${indent}  </div>`;
  }

  html += `\n${indent}</div>`;
  return html;
}

/**
 * Format a tag for display
 */
function formatTag(tag) {
  if (typeof tag === "string") return tag;
  let str = tag.tagType === "definition" ? "@" : "#";
  str += tag.name;
  if (tag.argument) {
    str += `(${tag.argument})`;
  }
  return str;
}

/**
 * Format a property value for display
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str) {
  const text = String(str);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
