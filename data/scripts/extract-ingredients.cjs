#!/usr/bin/env node
// Extract containedIngredients from product MDX files using Claude Haiku
// Reads each product's frontmatter + body, asks Haiku to identify all ingredients

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PRODUCTS_DIR = path.join(__dirname, '../../src/content/products');
const VALID_SLUGS = fs.readdirSync(path.join(__dirname, '../../data/sources/ingredients'))
  .filter(f => f.endsWith('.yaml'))
  .map(f => f.replace('.yaml', ''))
  .sort();

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.mdx')).sort();
const results = {};
const BATCH_SIZE = 10;

console.log(`Processing ${files.length} products against ${VALID_SLUGS.length} valid slugs...\n`);

// Build batch prompt
function buildBatchPrompt(batch) {
  const entries = batch.map((file, i) => {
    const content = fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf-8');
    return `### PRODUCT ${i + 1}: ${file}\n${content}\n`;
  }).join('\n---\n\n');

  return `You are extracting ingredient data from supplement product descriptions.

VALID SLUGS (only use these):
${VALID_SLUGS.join(', ')}

For each product below, identify ALL ingredients it contains that match our valid slugs.
- Map common names: "Vitamin D" → vitamin-d3, "Zinc" → zink, "Selenium" → selen, "Iron" → eisen, "Iodine" → jod, "Potassium" → kalium, "Copper" → kupfer, "Manganese" → mangan, "Chromium" → chrom, "Boron" → bor, "Silicon" → silicium, "Phosphorus" → phosphor, "Molybdenum" → molybdaen, "Folic acid/Folate" → folsaeure, "Biotin" → vitamin-b7, "Thiamine" → vitamin-b1, "Riboflavin" → vitamin-b2, "Niacin/Niacinamide" → vitamin-b3, "Pantothenic acid" → vitamin-b5, "Pyridoxine" → vitamin-b6, "Cobalamin" → vitamin-b12, "Caffeine/Koffein" → koffein, "Creatine/Kreatin" → kreatin, "Collagen/Kollagen" → kollagen, "Turmeric/Kurkuma" → curcumin, "NAC/N-Acetylcysteine" → nac, "SAMe/S-Adenosylmethionine" → same, "TMG/Trimethylglycine" → tmg, "BioPerine/Piperine" → piperin, "Vitamin K2 MK-7" → vitamin-k2, "Vitamin D3+K2 combo" → vitamin-d3-k2, "GlyNAC" → glynac, "Alpha-GPC" → alpha-gpc, "CDP-Choline/Citicoline" → cdp-cholin, "Glycine/Glycin" → glycin, "Taurine/Taurin" → taurin, "L-Theanine" → l-theanin, "L-Tryptophan" → l-tryptophan, "L-Tyrosine" → l-tyrosin, "L-Citrulline" → l-citrullin, "L-Carnitine" → l-carnitin, "Acetyl-L-Carnitine/ALCAR" → acetyl-l-carnitin, "Beta-Alanine" → beta-alanin, "Betaine" → betain, "Hyaluronic acid" → hyaluronsaeure, "Inositol" → myo-inositol, "Lion's Mane" → lion-s-mane
- Most products are SINGLE-ingredient — that's fine, just list the one
- For D3+K2 combo products: use slug "vitamin-d3-k2"
- If a product contains piperine/bioperine as absorption enhancer, include "piperin"
- Only include ingredients where there's a meaningful dose, not trace amounts

Reply ONLY with valid JSON, no markdown:
{
  "filename1.mdx": ["slug1", "slug2"],
  "filename2.mdx": ["slug1"],
  ...
}

${entries}`;
}

async function processBatch(batch, batchNum) {
  const prompt = buildBatchPrompt(batch);
  const tmpFile = `/tmp/ingredient-batch-${batchNum}.txt`;
  fs.writeFileSync(tmpFile, prompt);

  try {
    const result = execSync(
      `cat "${tmpFile}" | claude --model haiku --print --permission-mode bypassPermissions -`,
      { timeout: 120000, maxBuffer: 1024 * 1024, encoding: 'utf-8' }
    );

    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      Object.assign(results, parsed);
      console.log(`  ✅ Batch ${batchNum}: ${Object.keys(parsed).length} products processed`);
    } else {
      console.log(`  ❌ Batch ${batchNum}: no JSON found`);
      console.log(result.slice(0, 200));
    }
  } catch (e) {
    console.log(`  ❌ Batch ${batchNum} failed: ${e.message.slice(0, 100)}`);
  }

  fs.unlinkSync(tmpFile);
}

async function main() {
  const batches = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    batches.push(files.slice(i, i + BATCH_SIZE));
  }

  console.log(`${batches.length} batches of ${BATCH_SIZE}\n`);

  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length}...`);
    await processBatch(batches[i], i + 1);
    // Small delay between batches
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  // Validate results
  let multiCount = 0;
  for (const [file, slugs] of Object.entries(results)) {
    const invalid = slugs.filter(s => !VALID_SLUGS.includes(s));
    if (invalid.length) console.log(`⚠️  ${file}: invalid slugs: ${invalid.join(', ')}`);
    if (slugs.length > 1) multiCount++;
  }

  console.log(`\n📊 Results: ${Object.keys(results).length}/${files.length} products processed`);
  console.log(`   ${multiCount} multi-ingredient products found`);

  // Save results
  const outPath = path.join(__dirname, '../extracted-ingredients.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`💾 Saved to ${outPath}`);
}

main().catch(console.error);
