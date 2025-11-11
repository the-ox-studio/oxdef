import { readFileSync } from 'fs';
import { parse } from '../src/parser/parser.js';

// Helper to print AST in a readable format
function printAST(node, indent = 0) {
  const spaces = '  '.repeat(indent);

  if (node.type === 'Document') {
    console.log(`${spaces}Document:`);
    if (node.imports.length > 0) {
      console.log(`${spaces}  Imports:`);
      node.imports.forEach(imp => printAST(imp, indent + 2));
    }
    if (node.templates.length > 0) {
      console.log(`${spaces}  Templates:`);
      node.templates.forEach(tmpl => printAST(tmpl, indent + 2));
    }
    if (node.blocks.length > 0) {
      console.log(`${spaces}  Blocks:`);
      node.blocks.forEach(block => printAST(block, indent + 2));
    }
  } else if (node.type === 'Block') {
    const tags = node.tags.length > 0 ? ` [${node.tags.map(t => `${t.tagType[0]}${t.name}${t.argument ? `(${t.argument})` : ''}`).join(' ')}]` : '';
    console.log(`${spaces}Block: ${node.id}${tags}`);

    if (Object.keys(node.properties).length > 0) {
      console.log(`${spaces}  Properties:`);
      for (const [key, value] of Object.entries(node.properties)) {
        console.log(`${spaces}    ${key}: ${formatValue(value)}`);
      }
    }

    if (node.children.length > 0) {
      console.log(`${spaces}  Children:`);
      node.children.forEach(child => printAST(child, indent + 2));
    }
  } else if (node.type === 'Set') {
    console.log(`${spaces}Set: ${node.name} = ${formatValue(node.value)}`);
  } else if (node.type === 'If') {
    console.log(`${spaces}If: ${formatValue(node.condition)}`);
    if (node.thenBlocks.length > 0) {
      console.log(`${spaces}  Then:`);
      node.thenBlocks.forEach(block => printAST(block, indent + 2));
    }
    if (node.elseIfBranches.length > 0) {
      node.elseIfBranches.forEach(branch => {
        console.log(`${spaces}  ElseIf: ${formatValue(branch.condition)}`);
        branch.blocks.forEach(block => printAST(block, indent + 2));
      });
    }
    if (node.elseBlocks.length > 0) {
      console.log(`${spaces}  Else:`);
      node.elseBlocks.forEach(block => printAST(block, indent + 2));
    }
  } else if (node.type === 'Foreach') {
    const vars = node.indexVar ? `${node.itemVar}, ${node.indexVar}` : node.itemVar;
    console.log(`${spaces}Foreach: ${vars} in ${node.collection}`);
    if (node.body.length > 0) {
      node.body.forEach(item => printAST(item, indent + 1));
    }
  } else if (node.type === 'OnData') {
    console.log(`${spaces}OnData: ${node.sourceName}`);
    if (node.dataBlocks.length > 0) {
      console.log(`${spaces}  Data:`);
      node.dataBlocks.forEach(block => printAST(block, indent + 2));
    }
    if (node.errorBlocks.length > 0) {
      console.log(`${spaces}  Error:`);
      node.errorBlocks.forEach(block => printAST(block, indent + 2));
    }
  } else if (node.type === 'Import') {
    console.log(`${spaces}Import: ${node.path}${node.alias ? ` as ${node.alias}` : ''}`);
  } else {
    console.log(`${spaces}${node.type}: ${JSON.stringify(node)}`);
  }
}

function formatValue(value) {
  if (!value) return 'null';

  if (value.type === 'Literal') {
    return JSON.stringify(value.value);
  } else if (value.type === 'Expression') {
    return `(${value.tokens.map(t => t.value || t.type).join(' ')})`;
  } else if (value.type === 'Array') {
    return `{${value.elements.map(e => formatValue(e)).join(', ')}}`;
  }

  return JSON.stringify(value);
}

// Main
const filename = process.argv[2] || 'examples/basic.ox';

try {
  console.log(`\nParsing: ${filename}\n`);
  const source = readFileSync(filename, 'utf-8');
  const ast = parse(source, filename);

  printAST(ast);

  console.log('\n✓ Parse successful!\n');
} catch (error) {
  console.error('\n✗ Parse error:');
  console.error(error.toString());
  console.error();
  process.exit(1);
}
