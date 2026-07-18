/**
 * generate-products.ts
 *
 * Reads YAML source files from data/sources/products/ and generates:
 *   - src/content/products/<slug>.mdx              (DE)
 *   - src/content/en/products/<slug>.mdx            (EN)
 *   - data/entities/products/<slug>.json            (KG entity)
 *   - data/relations/by-entity/<slug>.json          (KG relations)
 *
 * Usage:
 *   npx tsx data/scripts/generate-products.ts <slug>     # single
 *   npx tsx data/scripts/generate-products.ts             # all
 *   npx tsx data/scripts/generate-products.ts --changed   # only git-changed
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';

const ROOT = join(import.meta.dirname, '../..');
const SOURCES_DIR = join(ROOT, 'data/sources/products');
const OUT_DE = join(ROOT, 'src/content/products');
const OUT_EN = join(ROOT, 'src/content/en/products');
const OUT_ENTITIES = join(ROOT, 'data/entities/products');
const OUT_RELATIONS = join(ROOT, 'data/relations/by-entity');

for (const d of [OUT_DE, OUT_EN, OUT_ENTITIES, OUT_RELATIONS]) {
  mkdirSync(d, { recursive: true });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface BilingualString { de: string; en: string }

interface RatingDimension {
  score: number;
  explanation: BilingualString;
}

interface StructuredBody {
  description: string;
  pros: string[];
  cons: string[];
  usage: string;
}

interface LocaleContent {
  summary: string;
  verdictNote: string;
  body: StructuredBody;
}

interface FaqItem {
  question: BilingualString;
  answer: BilingualString;
}

interface ProductSource {
  id: string;
  type: 'product';
  meta: {
    title: string;
    ingredient: string;
    containedIngredients?: { slug: string }[];
    vendor: string;
    vendorUrl?: string;
    affiliateUrl?: string;
    priceEur: number;
    doseMg: number;
    servingsPerPack: number;
    pricePerDayEur: number;
    form: string;
    availableInDE: boolean;
    publishedAt: string;
    lastPriceCheck?: string;
    updatedAt?: string;
    featuredImage?: string;
    amazonAsin?: string;
    iherbId?: string;
    certifications: string[];
    verdict: string;
  };
  ratings: {
    evidenceForIngredient: RatingDimension;
    valueForMoney: RatingDimension;
    productQuality: RatingDimension;
    labelHonesty: RatingDimension;
    thirdPartyTesting: RatingDimension;
  };
  locales: { de: LocaleContent; en: LocaleContent };
  faq?: FaqItem[];
}

// ── Scoring (mirrors src/utils/scoring.ts) ───────────────────────────────────

const WEIGHTS = {
  evidenceForIngredient: 0.15,
  valueForMoney:         0.15,
  productQuality:        0.30,
  labelHonesty:          0.25,
  thirdPartyTesting:     0.15,
};

// Thresholds: ≥7.0 empfehlenswert, ≥5.5 akzeptabel, <5.5 nicht-empfehlenswert
function compositeScore(ratings: ProductSource['ratings']): number {
  return (
    ratings.evidenceForIngredient.score * WEIGHTS.evidenceForIngredient +
    ratings.valueForMoney.score         * WEIGHTS.valueForMoney +
    ratings.productQuality.score        * WEIGHTS.productQuality +
    ratings.labelHonesty.score          * WEIGHTS.labelHonesty +
    ratings.thirdPartyTesting.score     * WEIGHTS.thirdPartyTesting
  );
}

function autoVerdict(score: number): string {
  if (score >= 7.0) return 'empfehlenswert';
  if (score >= 5.5) return 'akzeptabel';
  return 'nicht-empfehlenswert';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') return val;
  return String(val);
}

function escapeMdx(str: string): string {
  return str.replace(/(?<!&lt|&amp|&#\d{1,5})<(?!\/?\s*[a-zA-Z][a-zA-Z0-9]*[\s>\/])/g, '&lt;');
}

function formatPrice(n: number): string {
  return n % 1 === 0 ? String(n) : Number(n).toFixed(2);
}

function yamlQuote(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// ── MDX generation ───────────────────────────────────────────────────────────

function buildFrontmatter(source: ProductSource, locale: 'de' | 'en'): string {
  const { meta, ratings, locales, faq } = source;
  const lc = locales[locale];
  const lines: string[] = [];

  lines.push(`title: ${yamlQuote(meta.title)}`);
  lines.push(`slug: "${source.id}"`);
  lines.push(`ingredient: "${meta.ingredient}"`);

  if (meta.containedIngredients?.length) {
    lines.push('containedIngredients:');
    for (const ci of meta.containedIngredients) {
      lines.push(`  - slug: "${ci.slug}"`);
    }
  }

  lines.push(`vendor: ${yamlQuote(meta.vendor)}`);
  if (meta.vendorUrl) lines.push(`vendorUrl: "${meta.vendorUrl}"`);
  if (meta.affiliateUrl) lines.push(`affiliateUrl: "${meta.affiliateUrl}"`);
  lines.push(`priceEur: ${formatPrice(meta.priceEur)}`);
  lines.push(`doseMg: ${meta.doseMg}`);
  lines.push(`servingsPerPack: ${meta.servingsPerPack}`);
  lines.push(`pricePerDayEur: ${formatPrice(meta.pricePerDayEur)}`);
  lines.push(`publishedAt: ${formatDate(meta.publishedAt)}`);
  if (meta.lastPriceCheck) lines.push(`lastPriceCheck: ${formatDate(meta.lastPriceCheck)}`);
  if (meta.updatedAt) lines.push(`updatedAt: ${formatDate(meta.updatedAt)}`);
  lines.push(`form: ${meta.form}`);
  lines.push(`availableInDE: ${meta.availableInDE}`);
  lines.push(`summary: ${yamlQuote(escapeMdx(lc.summary))}`);

  // Ratings
  lines.push('ratings:');
  for (const [key, dim] of Object.entries(ratings)) {
    lines.push(`  ${key}:`);
    lines.push(`    score: ${dim.score}`);
    lines.push(`    explanation: ${yamlQuote(escapeMdx(dim.explanation[locale]))}`);
  }

  // Certifications
  if (meta.certifications?.length) {
    lines.push(`certifications: ${JSON.stringify(meta.certifications)}`);
  } else {
    lines.push('certifications: []');
  }

  const score = compositeScore(source.ratings);
  const verdict = autoVerdict(score);
  lines.push(`verdict: "${verdict}"`);
  lines.push(`verdictNote: ${yamlQuote(escapeMdx(lc.verdictNote))}`);

  if (meta.featuredImage) lines.push(`featuredImage: "${meta.featuredImage}"`);
  if (meta.amazonAsin) lines.push(`amazonAsin: "${meta.amazonAsin}"`);
  if (meta.iherbId) lines.push(`iherbId: "${meta.iherbId}"`);

  // FAQ
  if (faq?.length) {
    lines.push('faq:');
    for (const item of faq) {
      lines.push(`  - question: ${yamlQuote(item.question[locale])}`);
      lines.push(`    answer: ${yamlQuote(item.answer[locale])}`);
    }
  }

  return lines.join('\n');
}

function buildBody(body: StructuredBody, locale: 'de' | 'en'): string {
  const headings = {
    de: { desc: 'Produktbeschreibung', pros: 'Was gefällt uns', cons: 'Was uns fehlt', usage: 'Einnahmeempfehlung' },
    en: { desc: 'Product Description', pros: 'What We Like', cons: "What We're Missing", usage: 'Usage Recommendation' },
  };
  const h = headings[locale];
  const sections: string[] = [];

  if (body.description) {
    sections.push(`## ${h.desc}\n\n${escapeMdx(body.description)}`);
  }
  if (body.pros.length) {
    sections.push(`## ${h.pros}\n\n${body.pros.map(p => `- ${escapeMdx(p)}`).join('\n')}`);
  }
  if (body.cons.length) {
    sections.push(`## ${h.cons}\n\n${body.cons.map(c => `- ${escapeMdx(c)}`).join('\n')}`);
  }
  if (body.usage) {
    sections.push(`## ${h.usage}\n\n${escapeMdx(body.usage)}`);
  }

  return sections.join('\n\n');
}

function generateMdx(source: ProductSource, locale: 'de' | 'en'): string {
  const frontmatter = buildFrontmatter(source, locale);
  const body = buildBody(source.locales[locale].body, locale);

  return [
    '---',
    frontmatter,
    '---',
    '',
    `{/* Generated from data/sources/products/${source.id}.yaml — do not edit directly */}`,
    '',
    body,
    '',
  ].join('\n');
}

// ── KG generation ────────────────────────────────────────────────────────────

function generateEntity(source: ProductSource): object {
  return {
    id: source.id,
    type: 'product',
    name: source.meta.title,
    vendor: source.meta.vendor,
    ingredient: source.meta.ingredient,
    form: source.meta.form,
    verdict: autoVerdict(compositeScore(source.ratings)),
    compositeScore: Math.round(compositeScore(source.ratings) * 100) / 100,
    updatedAt: new Date().toISOString().split('T')[0],
  };
}

function generateRelations(source: ProductSource): object {
  const ingredients = source.meta.containedIngredients || [{ slug: source.meta.ingredient }];
  return {
    entity: source.id,
    relations: ingredients.map(ci => ({
      relation: 'enthaelt',
      target: ci.slug,
      direction: 'outgoing',
      confidence: 1,
      source: 'product-yaml',
    })),
  };
}

// ── Process one source ───────────────────────────────────────────────────────

function processSource(slug: string): void {
  const sourcePath = join(SOURCES_DIR, `${slug}.yaml`);
  if (!existsSync(sourcePath)) throw new Error(`Source not found: ${sourcePath}`);

  const raw = readFileSync(sourcePath, 'utf-8');
  const { data } = matter(raw);
  const source = data as ProductSource;

  // DE MDX
  writeFileSync(join(OUT_DE, `${slug}.mdx`), generateMdx(source, 'de'));
  console.log(`  ✓ DE MDX`);

  // EN MDX
  writeFileSync(join(OUT_EN, `${slug}.mdx`), generateMdx(source, 'en'));
  console.log(`  ✓ EN MDX`);

  // KG entity
  writeFileSync(join(OUT_ENTITIES, `${slug}.json`), JSON.stringify(generateEntity(source), null, 2) + '\n');
  console.log(`  ✓ KG entity`);

  // KG relations
  const relPath = join(OUT_RELATIONS, `${slug}.json`);
  writeFileSync(relPath, JSON.stringify(generateRelations(source), null, 2) + '\n');
  console.log(`  ✓ KG relations`);
}

// ── Changed detection ────────────────────────────────────────────────────────

function getChangedSlugs(): string[] {
  const slugs = new Set<string>();
  const diff = execSync(
    'git diff --name-only HEAD -- data/sources/products/ ; ' +
    'git diff --name-only --cached -- data/sources/products/ ; ' +
    'git ls-files --others --exclude-standard -- data/sources/products/',
    { cwd: ROOT, encoding: 'utf-8' }
  );
  for (const line of diff.split('\n').filter(Boolean)) {
    const match = line.match(/data\/sources\/products\/([a-z0-9-]+)\.yaml$/);
    if (match) slugs.add(match[1]);
  }
  return [...slugs].sort();
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const changedMode = args.includes('--changed');
const slugArgs = args.filter(a => !a.startsWith('--'));

function runBatch(slugs: string[], label: string) {
  console.log(`\n${label} ${slugs.length} product(s)...\n`);
  let ok = 0, failed = 0;
  for (const slug of slugs) {
    console.log(`Processing: ${slug}`);
    try {
      processSource(slug);
      ok++;
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`);
      failed++;
    }
  }
  console.log(`\n✓ ${ok} succeeded, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

if (changedMode) {
  const slugs = getChangedSlugs();
  if (slugs.length === 0) {
    console.log('\nNo changed product files detected.\n');
    process.exit(0);
  }
  runBatch(slugs, 'Regenerating');
} else if (slugArgs.length > 0) {
  console.log(`\nGenerating: ${slugArgs[0]}`);
  try {
    processSource(slugArgs[0]);
    console.log(`\n✓ Done: ${slugArgs[0]}\n`);
  } catch (err) {
    console.error(`\n✗ Failed: ${(err as Error).message}\n`);
    process.exit(1);
  }
} else {
  const files = readdirSync(SOURCES_DIR).filter(f => f.endsWith('.yaml'));
  runBatch(files.map(f => basename(f, '.yaml')), 'Generating');
}
