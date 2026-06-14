#!/usr/bin/env node
// Remove empty containedIngredients entries

const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '../../src/content/products');
const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.mdx'));

let cleaned = 0;

files.forEach(filename => {
  const filepath = path.join(PRODUCTS_DIR, filename);
  let content = fs.readFileSync(filepath, 'utf-8');

  // Remove containedIngredients if it has empty entries
  if (content.includes('containedIngredients:\n  - \n')) {
    content = content.replace(/containedIngredients:\n  - \n/, '');
    fs.writeFileSync(filepath, content);
    cleaned++;
  }
});

console.log(`Cleaned ${cleaned} empty containedIngredients entries`);
