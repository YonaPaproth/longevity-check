#!/usr/bin/env node
// Inject extracted ingredients back into product MDX files

const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '../../src/content/products');
const extracted = require('../extracted-ingredients.json');

let updated = 0;
let skipped = 0;

Object.entries(extracted).forEach(([filename, slugs]) => {
  const filepath = path.join(PRODUCTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`❌ ${filename} not found`);
    skipped++;
    return;
  }

  let content = fs.readFileSync(filepath, 'utf-8');
  
  // Split frontmatter and body
  const match = content.match(/^---([\s\S]*?)---\n([\s\S]*)$/);
  if (!match) {
    console.log(`⚠️  ${filename} has no frontmatter`);
    skipped++;
    return;
  }

  let [_, frontmatter, body] = match;

  // Check if containedIngredients already exists
  if (frontmatter.includes('containedIngredients:')) {
    // Replace existing
    frontmatter = frontmatter.replace(
      /containedIngredients:[\s\S]*?(?=\n[a-z]|\nratings:|\n$)/,
      `containedIngredients:\n  - ${slugs.map(s => `slug: "${s}"`).join('\n  - ')}`
    );
  } else {
    // Add after ingredient field
    const ingredientMatch = frontmatter.match(/(ingredient: "[^"]*")/);
    if (ingredientMatch) {
      frontmatter = frontmatter.replace(
        ingredientMatch[1],
        `${ingredientMatch[1]}\ncontainedIngredients:\n  - ${slugs.map(s => `slug: "${s}"`).join('\n  - ')}`
      );
    } else {
      console.log(`⚠️  ${filename} has no ingredient field`);
      skipped++;
      return;
    }
  }

  const newContent = `---${frontmatter}---\n${body}`;
  fs.writeFileSync(filepath, newContent);
  updated++;

  if (updated % 10 === 0) console.log(`  ✅ ${updated} files updated...`);
});

console.log(`\n✨ Done: ${updated} updated, ${skipped} skipped`);
