/**
 * migrate-products-to-yaml.ts
 *
 * Reads product MDX files and creates YAML source files at
 * data/sources/products/<slug>.yaml
 *
 * Usage:
 *   npx tsx data/scripts/migrate-products-to-yaml.ts --dry-run   # preview
 *   npx tsx data/scripts/migrate-products-to-yaml.ts              # migrate all
 *   npx tsx data/scripts/migrate-products-to-yaml.ts <slug>       # single product
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';

const ROOT = join(import.meta.dirname, '../..');
const DE_DIR = join(ROOT, 'src/content/products');
const EN_DIR = join(ROOT, 'src/content/en/products');
const OUT_DIR = join(ROOT, 'data/sources/products');
const DRY_RUN = process.argv.includes('--dry-run');

mkdirSync(OUT_DIR, { recursive: true });

// ── Body parsing ─────────────────────────────────────────────────────────────

interface StructuredBody {
  description: string;
  pros: string[];
  cons: string[];
  usage: string;
}

const DE_HEADINGS: Record<string, keyof StructuredBody> = {
  'Produktbeschreibung': 'description',
  'Was gefällt uns': 'pros',
  'Was uns fehlt': 'cons',
  'Einnahmeempfehlung': 'usage',
};

const EN_HEADINGS: Record<string, keyof StructuredBody> = {
  'Product Description': 'description',
  'What We Like': 'pros',
  "What We're Missing": 'cons',
  'Usage Recommendation': 'usage',
  'Recommended Dosage': 'usage',
};

function parseBody(body: string, headings: Record<string, keyof StructuredBody>): StructuredBody {
  const result: StructuredBody = { description: '', pros: [], cons: [], usage: '' };

  // Split on ## headings
  const sections = body.split(/^## /m);

  for (const section of sections) {
    if (!section.trim()) continue;
    const firstNewline = section.indexOf('\n');
    if (firstNewline === -1) continue;

    const heading = section.substring(0, firstNewline).trim();
    const content = section.substring(firstNewline + 1).trim();
    const field = headings[heading];
    if (!field) continue;

    if (field === 'pros' || field === 'cons') {
      result[field] = content
        .split('\n')
        .filter(l => l.trim().startsWith('- '))
        .map(l => l.trim().replace(/^- /, ''));
    } else {
      result[field] = content;
    }
  }

  return result;
}

// ── YAML serialization helpers ───────────────────────────────────────────────

function esc(s: string): string {
  if (!s) return '""';
  // Use double-quoted YAML for strings with special chars
  if (/[":{}[\],&*?|><!%@`#]/.test(s) || s.includes('\n') || s !== s.trim()) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  return '"' + s + '"';
}

function formatDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') return val;
  return String(val);
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => pad + l).join('\n');
}

// ── Build YAML for a product ─────────────────────────────────────────────────

interface ProductData {
  frontmatter: Record<string, any>;
  deBody: StructuredBody;
  enBody: StructuredBody | null;
  enFrontmatter: Record<string, any> | null;
}

function buildYaml(data: ProductData): string {
  const fm = data.frontmatter;
  const enFm = data.enFrontmatter;

  const lines: string[] = ['---'];

  // id & type
  lines.push(`id: ${fm.slug}`);
  lines.push(`type: product`);
  lines.push('');

  // meta
  lines.push('meta:');
  lines.push(`  title: ${esc(fm.title)}`);
  lines.push(`  ingredient: ${fm.ingredient}`);

  if (fm.containedIngredients?.length) {
    lines.push('  containedIngredients:');
    for (const ci of fm.containedIngredients) {
      lines.push(`    - slug: ${ci.slug}`);
    }
  }

  lines.push(`  vendor: ${esc(fm.vendor)}`);
  lines.push(`  vendorUrl: ${esc(fm.vendorUrl || '')}`);
  lines.push(`  affiliateUrl: ${esc(fm.affiliateUrl || '')}`);
  lines.push(`  priceEur: ${fm.priceEur}`);
  lines.push(`  doseMg: ${fm.doseMg}`);
  lines.push(`  servingsPerPack: ${fm.servingsPerPack}`);
  lines.push(`  pricePerDayEur: ${fm.pricePerDayEur}`);
  lines.push(`  form: ${fm.form || 'capsule'}`);
  lines.push(`  availableInDE: ${fm.availableInDE ?? true}`);
  lines.push(`  publishedAt: "${formatDate(fm.publishedAt)}"`);
  if (fm.lastPriceCheck) lines.push(`  lastPriceCheck: "${formatDate(fm.lastPriceCheck)}"`);
  if (fm.updatedAt) lines.push(`  updatedAt: "${formatDate(fm.updatedAt)}"`);
  lines.push(`  featuredImage: ${esc(fm.featuredImage || '')}`);
  lines.push(`  amazonAsin: ${esc(fm.amazonAsin || '')}`);
  lines.push(`  iherbId: ${esc(fm.iherbId || '')}`);

  // certifications
  if (fm.certifications?.length) {
    lines.push(`  certifications: ${JSON.stringify(fm.certifications)}`);
  } else {
    lines.push('  certifications: []');
  }

  lines.push(`  verdict: ${fm.verdict}`);
  lines.push('');

  // ratings
  lines.push('ratings:');
  const ratingKeys = ['evidenceForIngredient', 'valueForMoney', 'productQuality', 'labelHonesty', 'thirdPartyTesting'];
  for (const key of ratingKeys) {
    const r = fm.ratings[key];
    const deExpl = r?.explanation || '';
    const enExpl = enFm?.ratings?.[key]?.explanation || deExpl;
    lines.push(`  ${key}:`);
    lines.push(`    score: ${r?.score ?? 0}`);
    lines.push('    explanation:');
    lines.push(`      de: ${esc(deExpl)}`);
    lines.push(`      en: ${esc(enExpl)}`);
  }
  lines.push('');

  // locales
  lines.push('locales:');

  // DE locale
  lines.push('  de:');
  lines.push(`    summary: ${esc(fm.summary)}`);
  lines.push(`    verdictNote: ${esc(fm.verdictNote)}`);
  lines.push('    body:');
  lines.push(`      description: ${esc(data.deBody.description)}`);
  lines.push('      pros:');
  for (const p of data.deBody.pros) {
    lines.push(`        - ${esc(p)}`);
  }
  lines.push('      cons:');
  for (const c of data.deBody.cons) {
    lines.push(`        - ${esc(c)}`);
  }
  lines.push(`      usage: ${esc(data.deBody.usage)}`);

  // EN locale
  lines.push('  en:');
  const enSummary = enFm?.summary || fm.summary;
  const enVerdictNote = enFm?.verdictNote || fm.verdictNote;
  const enBody = data.enBody || data.deBody;
  lines.push(`    summary: ${esc(enSummary)}`);
  lines.push(`    verdictNote: ${esc(enVerdictNote)}`);
  lines.push('    body:');
  lines.push(`      description: ${esc(enBody.description)}`);
  lines.push('      pros:');
  for (const p of enBody.pros) {
    lines.push(`        - ${esc(p)}`);
  }
  lines.push('      cons:');
  for (const c of enBody.cons) {
    lines.push(`        - ${esc(c)}`);
  }
  lines.push(`      usage: ${esc(enBody.usage)}`);

  // FAQ (bilingual)
  if (fm.faq?.length) {
    lines.push('');
    lines.push('faq:');
    for (const item of fm.faq) {
      const enQ = item.question; // currently monolingual in DE
      const enA = item.answer;
      lines.push('  - question:');
      lines.push(`      de: ${esc(item.question)}`);
      lines.push(`      en: ${esc(enQ)}`);
      lines.push('    answer:');
      lines.push(`      de: ${esc(item.answer)}`);
      lines.push(`      en: ${esc(enA)}`);
    }
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

const slugArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const deFiles = readdirSync(DE_DIR).filter(f => f.endsWith('.mdx'));

let processed = 0;
let skipped = 0;
let failed = 0;

for (const file of deFiles) {
  const slug = basename(file, '.mdx');
  if (slugArg && slug !== slugArg) continue;

  const outPath = join(OUT_DIR, `${slug}.yaml`);
  if (existsSync(outPath) && !slugArg) {
    skipped++;
    continue;
  }

  try {
    // Read DE
    const deRaw = readFileSync(join(DE_DIR, file), 'utf-8');
    const { data: deFm, content: deContent } = matter(deRaw);
    const deBody = parseBody(deContent, DE_HEADINGS);

    // Read EN (if exists)
    const enPath = join(EN_DIR, file);
    let enFm: Record<string, any> | null = null;
    let enBody: StructuredBody | null = null;
    if (existsSync(enPath)) {
      const enRaw = readFileSync(enPath, 'utf-8');
      const parsed = matter(enRaw);
      enFm = parsed.data;
      enBody = parseBody(parsed.content, EN_HEADINGS);
    }

    const yaml = buildYaml({ frontmatter: deFm, deBody, enBody, enFrontmatter: enFm });

    if (DRY_RUN) {
      console.log(`Would create: ${slug}.yaml`);
    } else {
      writeFileSync(outPath, yaml);
      console.log(`  ✓ ${slug}.yaml`);
    }
    processed++;
  } catch (err) {
    console.error(`  ✗ ${slug}: ${(err as Error).message}`);
    failed++;
  }
}

console.log(`\n${DRY_RUN ? 'Would create' : 'Created'} ${processed}, skipped ${skipped}, failed ${failed}`);
