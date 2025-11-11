import { parse } from "../src/parser/parser.js";
import { TagRegistry, TagProcessor } from "../src/preprocessor/tags.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("=== OX Module Property Injection Demo ===\n");

// Simulate external game state
const gameState = {
  player: {
    health: 100,
    mana: 50,
    level: 5,
    inventory: ["sword", "shield", "potion"],
  },
  enemy: {
    health: 30,
    damage: 10,
    type: "hostile",
  },
  npc: {
    health: 50,
    dialogue: "Welcome, traveler!",
    canTrade: true,
  },
  ui: {
    theme: "dark",
    fontSize: 16,
  },
};

// Create registry and define tags with module properties
const registry = new TagRegistry();

// Entity tag with module properties from game state
registry.defineTag("entity", {
  block: { canReuse: false, canOutput: true },
  module: {
    health: () => {
      // This would be dynamically determined based on entity type
      // For demo, we'll use player health
      return gameState.player.health;
    },
    timestamp: () => Date.now(),
  },
});

// Styled tag with UI theme properties
registry.defineTag("styled", {
  block: { canReuse: false, canOutput: true },
  module: {
    theme: () => gameState.ui.theme,
    fontSize: () => gameState.ui.fontSize,
  },
});

// Read and parse OX file
const oxFile = join(__dirname, "module-properties.ox");
const oxCode = readFileSync(oxFile, "utf-8");
console.log("Input OX Code:");
console.log("─".repeat(60));
console.log(oxCode);
console.log("─".repeat(60));
console.log();

const doc = parse(oxCode);
console.log(`Parsed ${doc.blocks.length} root blocks\n`);

// Create processor and inject module properties
const processor = new TagProcessor(registry);
const injected = processor.injectModuleProperties(doc.blocks);

console.log("=== After Module Property Injection ===\n");

// Display injected properties
function displayBlock(block, indent = 0) {
  const spaces = "  ".repeat(indent);
  console.log(`${spaces}[${block.id}]`);

  // Show properties
  const propEntries = Object.entries(block.properties);
  if (propEntries.length > 0) {
    console.log(`${spaces}  Properties:`);
    for (const [key, value] of propEntries) {
      if (value.type === "Literal") {
        console.log(`${spaces}    ${key}: ${JSON.stringify(value.value)}`);
      } else if (value.type === "Array") {
        const arrayValues = value.elements.map((el) => el.value);
        console.log(`${spaces}    ${key}: [${arrayValues.join(", ")}]`);
      }
    }
  }

  // Show children
  if (block.children.length > 0) {
    console.log(`${spaces}  Children:`);
    for (const child of block.children) {
      displayBlock(child, indent + 2);
    }
  }
  console.log();
}

for (const block of injected) {
  displayBlock(block);
}

// Show example of injected properties
console.log("=== Module Property Injection Details ===\n");
const mainPlayer = injected.find((b) => b.id === "MainPlayer");
if (mainPlayer) {
  console.log("MainPlayer properties:");
  console.log(`  User-defined:`);
  console.log(`    x: ${mainPlayer.properties.x.value}`);
  console.log(`    y: ${mainPlayer.properties.y.value}`);
  console.log(`    name: ${mainPlayer.properties.name.value}`);
  console.log(`  Module-injected:`);
  console.log(`    health: ${mainPlayer.properties.health.value}`);
  console.log(`    timestamp: ${mainPlayer.properties.timestamp.value}`);
}

console.log("\n✓ Module property injection complete!");
console.log(
  "✓ External data successfully merged with user-defined properties",
);
