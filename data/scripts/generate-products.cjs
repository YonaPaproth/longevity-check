#!/usr/bin/env node
// Generate product MDX files for new brands using Claude Haiku
// Usage: node generate-products.cjs

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PRODUCTS_DIR = path.join(__dirname, '../../src/content/products');
const EN_PRODUCTS_DIR = path.join(__dirname, '../../src/content/en/products');
const VALID_SLUGS = fs.readdirSync(path.join(__dirname, '../../data/sources/ingredients'))
  .filter(f => f.endsWith('.yaml')).map(f => f.replace('.yaml', '')).sort();

// Existing product slugs to avoid duplicates
const existing = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.mdx')).map(f => f.replace('.mdx', ''));
const existingEN = fs.readdirSync(EN_PRODUCTS_DIR).filter(f => f.endsWith('.mdx')).map(f => f.replace('.mdx', ''));

// Sample existing product for format reference
const sampleProduct = fs.readFileSync(path.join(PRODUCTS_DIR, 'sunday-natural-kreatin.mdx'), 'utf-8');
const sampleProductEN = fs.existsSync(path.join(EN_PRODUCTS_DIR, 'sunday-natural-kreatin.mdx'))
  ? fs.readFileSync(path.join(EN_PRODUCTS_DIR, 'sunday-natural-kreatin.mdx'), 'utf-8')
  : null;

const brands = [
  {
    vendor: 'Sunday Natural',
    vendorUrl: 'https://www.sunday.de',
    prefix: 'sunday-natural',
    products: [
      { name: 'Omega-3 Fischöl 1000', slug: 'sunday-natural-omega-3-1000', ingredient: 'omega-3', doseMg: 1000, form: 'softgel', priceEur: 24.90, servings: 120, ppd: 0.21 },
      { name: 'Vitamin D3+K2 2000 I.E.', slug: 'sunday-natural-d3-k2-2000', ingredient: 'vitamin-d3-k2', doseMg: 50, form: 'capsule', priceEur: 19.90, servings: 120, ppd: 0.17 },
      { name: 'CoQ10 Ubiquinol 100', slug: 'sunday-natural-coq10-ubiquinol-100', ingredient: 'coq10', doseMg: 100, form: 'softgel', priceEur: 34.90, servings: 60, ppd: 0.58 },
      { name: 'Kollagen Hydrolysat Pulver', slug: 'sunday-natural-kollagen', ingredient: 'kollagen', doseMg: 10000, form: 'powder', priceEur: 29.90, servings: 30, ppd: 1.00 },
      { name: 'Lion\'s Mane Extrakt 500', slug: 'sunday-natural-lions-mane-500', ingredient: 'lion-s-mane', doseMg: 500, form: 'capsule', priceEur: 24.90, servings: 90, ppd: 0.28 },
      { name: 'Ashwagandha KSM-66 600', slug: 'sunday-natural-ashwagandha-600', ingredient: 'ashwagandha', doseMg: 600, form: 'capsule', priceEur: 22.90, servings: 90, ppd: 0.25 },
    ]
  },
  {
    vendor: 'ZeinPharma',
    vendorUrl: 'https://www.zeinpharma.de',
    prefix: 'zeinpharma',
    products: [
      { name: 'Magnesium-Glycinat 120', slug: 'zeinpharma-magnesium-glycinat-120', ingredient: 'magnesium', doseMg: 120, form: 'capsule', priceEur: 16.90, servings: 120, ppd: 0.14 },
      { name: 'Curcumin Triplex3 500', slug: 'zeinpharma-curcumin-triplex-500', ingredient: 'curcumin', doseMg: 500, form: 'capsule', priceEur: 21.90, servings: 90, ppd: 0.24, ci: ['curcumin', 'piperin'] },
      { name: 'Omega-3 Gold Cardio', slug: 'zeinpharma-omega-3-gold-cardio', ingredient: 'omega-3', doseMg: 1000, form: 'softgel', priceEur: 19.90, servings: 120, ppd: 0.17 },
      { name: 'Vitamin D3 2000 I.E.', slug: 'zeinpharma-vitamin-d3-2000', ingredient: 'vitamin-d3', doseMg: 50, form: 'capsule', priceEur: 9.90, servings: 90, ppd: 0.11 },
      { name: 'NAC 600', slug: 'zeinpharma-nac-600', ingredient: 'nac', doseMg: 600, form: 'capsule', priceEur: 14.90, servings: 120, ppd: 0.12 },
      { name: 'Selen Plus 200 µg', slug: 'zeinpharma-selen-plus-200', ingredient: 'selen', doseMg: 0.2, form: 'capsule', priceEur: 12.90, servings: 120, ppd: 0.11 },
      { name: 'Quercetin 500', slug: 'zeinpharma-quercetin-500', ingredient: 'quercetin', doseMg: 500, form: 'capsule', priceEur: 19.90, servings: 90, ppd: 0.22 },
      { name: 'L-Theanin 250', slug: 'zeinpharma-l-theanin-250', ingredient: 'l-theanin', doseMg: 250, form: 'capsule', priceEur: 17.90, servings: 90, ppd: 0.20 },
    ]
  },
  {
    vendor: 'Orthomol',
    vendorUrl: 'https://www.orthomol.com',
    prefix: 'orthomol',
    products: [
      { name: 'Orthomol Immun', slug: 'orthomol-immun', ingredient: 'vitamin-c', doseMg: 1000, form: 'tablet', priceEur: 49.90, servings: 30, ppd: 1.66, ci: ['vitamin-c', 'vitamin-d3', 'zink', 'selen', 'eisen', 'folsaeure', 'vitamin-b12', 'vitamin-b6'] },
      { name: 'Orthomol Vital M', slug: 'orthomol-vital-m', ingredient: 'magnesium', doseMg: 400, form: 'tablet', priceEur: 54.90, servings: 30, ppd: 1.83, ci: ['magnesium', 'omega-3', 'coq10', 'vitamin-b6', 'vitamin-b12', 'folsaeure', 'vitamin-d3'] },
      { name: 'Orthomol Vital F', slug: 'orthomol-vital-f', ingredient: 'magnesium', doseMg: 400, form: 'tablet', priceEur: 54.90, servings: 30, ppd: 1.83, ci: ['magnesium', 'omega-3', 'coq10', 'vitamin-b6', 'vitamin-b12', 'folsaeure', 'eisen', 'vitamin-d3'] },
      { name: 'Orthomol Sport', slug: 'orthomol-sport', ingredient: 'magnesium', doseMg: 400, form: 'tablet', priceEur: 49.90, servings: 30, ppd: 1.66, ci: ['magnesium', 'coq10', 'omega-3', 'l-carnitin', 'vitamin-b6', 'vitamin-b12', 'eisen'] },
    ]
  },
  {
    vendor: 'BIOGENA',
    vendorUrl: 'https://www.biogena.com',
    prefix: 'biogena',
    products: [
      { name: 'Biogena Magnesium 7 Salze', slug: 'biogena-magnesium-7-salze', ingredient: 'magnesium', doseMg: 300, form: 'capsule', priceEur: 32.90, servings: 90, ppd: 0.37 },
      { name: 'Biogena Omega 3 Premium', slug: 'biogena-omega-3-premium', ingredient: 'omega-3', doseMg: 1000, form: 'softgel', priceEur: 39.90, servings: 120, ppd: 0.33 },
      { name: 'Biogena Vitamin D3 K2 2000', slug: 'biogena-vitamin-d3-k2-2000', ingredient: 'vitamin-d3-k2', doseMg: 50, form: 'capsule', priceEur: 29.90, servings: 120, ppd: 0.25 },
      { name: 'Biogena Zink 15 Komplex', slug: 'biogena-zink-15', ingredient: 'zink', doseMg: 15, form: 'capsule', priceEur: 18.90, servings: 90, ppd: 0.21 },
      { name: 'Biogena CoQ10 100 aktiv', slug: 'biogena-coq10-100', ingredient: 'coq10', doseMg: 100, form: 'capsule', priceEur: 39.90, servings: 60, ppd: 0.67 },
      { name: 'Biogena Ubiquinol 50 CoQH', slug: 'biogena-ubiquinol-50', ingredient: 'coq10', doseMg: 50, form: 'softgel', priceEur: 34.90, servings: 60, ppd: 0.58 },
      { name: 'Biogena Curcuma 500 Plus', slug: 'biogena-curcuma-500', ingredient: 'curcumin', doseMg: 500, form: 'capsule', priceEur: 29.90, servings: 60, ppd: 0.50, ci: ['curcumin', 'piperin'] },
      { name: 'Biogena Selen 200 Komplex', slug: 'biogena-selen-200', ingredient: 'selen', doseMg: 0.2, form: 'capsule', priceEur: 19.90, servings: 60, ppd: 0.33 },
    ]
  }
];

// Filter out already existing
const toCreate = [];
for (const brand of brands) {
  for (const p of brand.products) {
    if (existing.includes(p.slug)) {
      console.log(`⏭️  Skip (exists): ${p.slug}`);
      continue;
    }
    toCreate.push({ ...p, vendor: brand.vendor, vendorUrl: brand.vendorUrl });
  }
}

console.log(`\n🔧 Creating ${toCreate.length} products in batches...\n`);

// Batch generate DE MDX with Haiku
const BATCH_SIZE = 8;
for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
  const batch = toCreate.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;

  const prompt = `Generate German supplement product review MDX files. Follow this exact format:

EXAMPLE:
${sampleProduct}

---

Generate ${batch.length} product files. For each:
1. Keep EXACT frontmatter structure as example
2. Write 4 sections: ## Produktbeschreibung, ## Was gefällt uns, ## Was uns fehlt, ## Einnahmeempfehlung  
3. Be honest, fair, evidence-based
4. publishedAt and lastPriceCheck: 2026-06-14
5. verdict: "empfehlenswert" or "bedingt empfehlenswert" (premium brands = usually empfehlenswert)
6. Ratings 1-10: evidence=based on our ingredient, value=price vs market, quality=brand reputation+form, label=transparency, testing=certifications

PRODUCTS TO GENERATE:
${batch.map((p, idx) => `
### Product ${idx + 1}
- filename: ${p.slug}.mdx
- title: "${p.vendor} ${p.name}"
- slug: "${p.slug}"
- ingredient: "${p.ingredient}"
- containedIngredients: ${JSON.stringify((p.ci || [p.ingredient]).map(s => ({slug: s})))}
- vendor: "${p.vendor}"
- vendorUrl: "${p.vendorUrl}"
- priceEur: ${p.priceEur}
- doseMg: ${p.doseMg}
- servingsPerPack: ${p.servings}
- pricePerDayEur: ${p.ppd}
- form: ${p.form}
- availableInDE: true
`).join('\n')}

Output ONLY the MDX content for each product, separated by:
===FILE: filename.mdx===
No other text.`;

  const tmpFile = `/tmp/product-batch-${batchNum}.txt`;
  fs.writeFileSync(tmpFile, prompt);

  try {
    console.log(`  Batch ${batchNum}/${Math.ceil(toCreate.length / BATCH_SIZE)}...`);
    const result = execSync(
      `cat "${tmpFile}" | claude --model haiku --print --permission-mode bypassPermissions -`,
      { timeout: 180000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf-8' }
    );

    // Parse output into individual files
    const files = result.split(/===FILE:\s*([^\s=]+\.mdx)===/);
    for (let j = 1; j < files.length; j += 2) {
      const filename = files[j].trim();
      const content = files[j + 1].trim();
      if (content.startsWith('---')) {
        fs.writeFileSync(path.join(PRODUCTS_DIR, filename), content + '\n');
        console.log(`    ✅ ${filename}`);
      }
    }
  } catch (e) {
    console.log(`    ❌ Batch ${batchNum} failed: ${e.message.slice(0, 100)}`);
  }

  fs.unlinkSync(tmpFile);
  if (i + BATCH_SIZE < toCreate.length) {
    require("child_process").execSync("sleep 3");
  }
}

// Now generate EN versions
console.log('\n🇬🇧 Generating EN translations...\n');

const newDE = toCreate.map(p => p.slug).filter(s => fs.existsSync(path.join(PRODUCTS_DIR, s + '.mdx')));

for (let i = 0; i < newDE.length; i += BATCH_SIZE) {
  const batch = newDE.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;

  const contents = batch.map(slug => {
    const content = fs.readFileSync(path.join(PRODUCTS_DIR, slug + '.mdx'), 'utf-8');
    return `===FILE: ${slug}.mdx===\n${content}`;
  }).join('\n\n');

  const prompt = `Translate these German supplement product MDX files to English. Keep ALL frontmatter unchanged (including German verdictNote). Only translate:
- summary (max 200 chars)
- verdictNote
- Body text (## sections)
- Change "empfehlenswert" → "recommended", "bedingt empfehlenswert" → "conditionally recommended"
- Change ratings explanation texts to English

Output each file separated by ===FILE: filename.mdx===

${contents}`;

  const tmpFile = `/tmp/product-en-batch-${batchNum}.txt`;
  fs.writeFileSync(tmpFile, prompt);

  try {
    console.log(`  EN Batch ${batchNum}...`);
    const result = execSync(
      `cat "${tmpFile}" | claude --model haiku --print --permission-mode bypassPermissions -`,
      { timeout: 180000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf-8' }
    );

    const files = result.split(/===FILE:\s*([^\s=]+\.mdx)===/);
    for (let j = 1; j < files.length; j += 2) {
      const filename = files[j].trim();
      const content = files[j + 1].trim();
      if (content.startsWith('---')) {
        fs.writeFileSync(path.join(EN_PRODUCTS_DIR, filename), content + '\n');
        console.log(`    ✅ EN: ${filename}`);
      }
    }
  } catch (e) {
    console.log(`    ❌ EN Batch ${batchNum} failed: ${e.message.slice(0, 100)}`);
  }

  fs.unlinkSync(tmpFile);
  if (i + BATCH_SIZE < newDE.length) {
    require("child_process").execSync("sleep 3");
  }
}

console.log('\n✨ Done!');
console.log(`Check: ls -la ${PRODUCTS_DIR}/*{zeinpharma,orthomol,biogena}*`);
