#!/usr/bin/env node
/**
 * product-index.cjs — Build a fast-lookup JSON index of all products.
 * Usage: node scripts/product-index.cjs
 * Output: data/product-index.json
 *
 * Use with jq for instant lookups:
 *   jq '.[] | select(.vendor | test("Sports"; "i"))' data/product-index.json
 *   jq '[.[] | .vendor] | unique' data/product-index.json
 *   jq '.[] | select(.ingredient == "omega-3")' data/product-index.json
 */

const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'src', 'content', 'products');
const OUTPUT = path.join(__dirname, '..', 'data', 'product-index.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (m) {
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!isNaN(val) && val !== '') val = Number(val);
      fm[m[1]] = val;
    }
  }
  // Parse containedIngredients
  const ciMatch = match[1].match(/containedIngredients:\n((?:\s+-\s+slug:.*\n?)*)/);
  if (ciMatch) {
    fm.containedIngredients = [...ciMatch[1].matchAll(/slug:\s*"?([^"\n]+)"?/g)].map(m => m[1]);
  }
  return fm;
}

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.mdx'));
const index = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf-8');
  const fm = parseFrontmatter(content);
  if (!fm) continue;
  index.push({
    slug: fm.slug || file.replace('.mdx', ''),
    title: fm.title,
    vendor: fm.vendor,
    ingredient: fm.ingredient,
    containedIngredients: fm.containedIngredients || [fm.ingredient],
    priceEur: fm.priceEur,
    doseMg: fm.doseMg,
    pricePerDayEur: fm.pricePerDayEur,
    form: fm.form,
    verdict: fm.verdict,
    servingsPerPack: fm.servingsPerPack,
  });
}

// Sort by vendor, then title
index.sort((a, b) => (a.vendor || '').localeCompare(b.vendor || '') || (a.title || '').localeCompare(b.title || ''));

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2));
console.log(`✅ ${index.length} products indexed → ${OUTPUT}`);
console.log(`\nVendors: ${[...new Set(index.map(p => p.vendor))].sort().join(', ')}`);
