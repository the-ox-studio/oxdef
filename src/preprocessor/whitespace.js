/**
 * Whitespace processing utilities for free text blocks
 * Implements Python's textwrap.dedent() algorithm
 */

/**
 * Process free text content using dedent algorithm
 *
 * Algorithm:
 * 1. Trim leading newline
 * 2. Trim trailing newline
 * 3. Find minimum indentation across non-empty lines
 * 4. Remove common indentation from all lines
 * 5. Preserve relative indentation
 *
 * @param {string} text - Raw text content from free text block
 * @returns {string} Processed text with dedented indentation
 */
export function dedent(text) {
  if (!text) {
    return "";
  }

  // Step 1: Trim leading newline
  if (text.startsWith("\n") || text.startsWith("\r\n")) {
    text = text.replace(/^(\r\n|\n)/, "");
  }

  // Step 2: Trim trailing newline
  if (text.endsWith("\n") || text.endsWith("\r\n")) {
    text = text.replace(/(\r\n|\n)$/, "");
  }

  // If text is empty or only whitespace, return empty string
  if (text.trim() === "") {
    return "";
  }

  // Split into lines
  const lines = text.split(/\r\n|\n/);

  // Step 3: Find minimum indentation
  let minIndent = Infinity;

  for (const line of lines) {
    // Skip empty lines in indent calculation
    if (line.trim() === "") {
      continue;
    }

    // Count leading whitespace (convert tabs to 4 spaces)
    const normalizedLine = line.replace(/\t/g, "    ");
    const indent = normalizedLine.match(/^\s*/)[0].length;

    if (indent < minIndent) {
      minIndent = indent;
    }
  }

  // If no non-empty lines found, return original
  if (minIndent === Infinity) {
    return text;
  }

  // Step 4 & 5: Remove common indentation from all lines
  const dedentedLines = lines.map(line => {
    if (line.trim() === "") {
      return line; // Preserve empty lines as-is
    }

    // Normalize tabs to spaces for consistent removal
    const normalizedLine = line.replace(/\t/g, "    ");

    // Remove the common indentation
    return normalizedLine.substring(minIndent);
  });

  return dedentedLines.join("\n");
}

/**
 * Process free text with tag-aware whitespace handling
 * This is the main entry point for processing free text blocks
 *
 * @param {string} rawText - Raw text from tokenizer
 * @param {Array} tags - Array of tag nodes associated with this free text
 * @returns {string} Processed text
 */
export function processFreeText(rawText, tags = []) {
  // Apply dedent algorithm
  let processed = dedent(rawText);

  // Future: Allow tags to modify processing
  // For example, #preserve-whitespace could skip dedenting
  // For now, we just use the standard dedent algorithm

  return processed;
}
