#!/usr/bin/env node
/**
 * add-product.cjs — Generate DE + EN product MDX from CLI params.
 *
 * Usage:
 *   node scripts/add-product.cjs \
 *     --vendor "Sports Research" \
 *     --name "Krill Oil 1000" \
 *     --slug "sports-research-krill-oil-1000" \
 *     --ingredient omega-3 \
 *     --also astaxanthin \
 *     --dose 1000 --price 28.90 --servings 60 \
 *     --form softgel \
 *     --summary "Antarctic krill oil with astaxanthin" \
 *     --verdict empfehlenswert
 *
 * Creates:
 *   src/content/products/<slug>.mdx        (DE)
 *   src/content/en/products/<slug>.mdx     (EN stub)
 *
 * Ratings and body text are left as TODOs for the agent to fill in.
 */

const fs = require('fs');
const path = require('path');

function parseArgs(args) {
  const params = {};
  const also = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--also') { also.push(args[++i]); continue; }
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      params[key] = args[++i];
    }
  }
  params.also = also;
  return params;
}

const p = parseArgs(process.argv.slice(2));

// Required fields
const required = ['vendor', 'name', 'ingredient', 'dose', 'price', 'servings', 'form'];
const missing = required.filter(k => !p[k]);
if (missing.length) {
  console.error(`❌ Missing: ${missing.join(', ')}`);
  console.error(`\nUsage: node scripts/add-product.cjs --vendor "X" --name "Y" --ingredient z --dose 100 --price 19.90 --servings 60 --form capsule`);
  console.error(`Optional: --slug, --also <ingredient>, --summary, --verdict, --vendorUrl`);
  process.exit(1);
}

// Derive slug if not provided
const slug = p.slug || `${p.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-').replace(/-$/, '');
const pricePerDay = (Number(p.price) / Number(p.servings)).toFixed(2);
const today = new Date().toISOString().slice(0, 10);
const allIngredients = [p.ingredient, ...p.also];

const containedBlock = allIngredients.map(s => `  - slug: "${s}"`).join('\n');

const template = `---
title: "${p.vendor} ${p.name}"
slug: "${slug}"
ingredient: "${p.ingredient}"
containedIngredients:
${containedBlock}
vendor: "${p.vendor}"
vendorUrl: "${p.vendorUrl || 'https://www.amazon.de'}"
priceEur: ${p.price}
doseMg: ${p.dose}
servingsPerPack: ${p.servings}
pricePerDayEur: ${pricePerDay}
publishedAt: ${today}
lastPriceCheck: ${today}
form: ${p.form}
availableInDE: true
summary: "${p.summary || 'TODO'}"
ratings:
  evidenceForIngredient:
    score: 0
    explanation: "TODO"
  valueForMoney:
    score: 0
    explanation: "TODO"
  productQuality:
    score: 0
    explanation: "TODO"
  labelHonesty:
    score: 0
    explanation: "TODO"
  thirdPartyTesting:
    score: 0
    explanation: "TODO"
certifications: []
verdict: "${p.verdict || 'empfehlenswert'}"
verdictNote: "TODO"
---

## Produktbeschreibung

TODO

## Was gefällt uns

- TODO

## Was uns fehlt

- TODO

## Einnahmeempfehlung

TODO
`;

const deDir = path.join(__dirname, '..', 'src', 'content', 'products');
const enDir = path.join(__dirname, '..', 'src', 'content', 'en', 'products');
const deFile = path.join(deDir, `${slug}.mdx`);
const enFile = path.join(enDir, `${slug}.mdx`);

if (fs.existsSync(deFile)) {
  console.error(`⚠️  ${slug}.mdx already exists! Skipping.`);
  process.exit(1);
}

// EN version: same frontmatter, english section headers
const enTemplate = template
  .replace('## Produktbeschreibung', '## Product Description')
  .replace('## Was gefällt uns', '## What We Like')
  .replace('## Was uns fehlt', "## What We're Missing")
  .replace('## Einnahmeempfehlung', '## Usage Recommendation');

fs.writeFileSync(deFile, template);
fs.writeFileSync(enFile, enTemplate);

console.log(`✅ Created: ${slug}`);
console.log(`   DE: src/content/products/${slug}.mdx`);
console.log(`   EN: src/content/en/products/${slug}.mdx`);
console.log(`   💰 ${pricePerDay} €/day | ${allIngredients.join(' + ')}`);
console.log(`\n📝 Fill in: ratings (scores + explanations), verdictNote, body sections.`);
console.log(`   Then: npm run build && git add -A && git commit`);
