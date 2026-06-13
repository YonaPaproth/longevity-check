/**
 * generate-from-source.ts
 *
 * Reads YAML source files from data/sources/ingredients/ and generates:
 *   - src/content/ingredients/<slug>.mdx          (DE dossier)
 *   - src/content/en/ingredients/<slug>.mdx       (EN dossier)
 *   - data/entities/ingredients/<slug>.json       (KG entity)
 *   - data/relations/by-entity/<slug>.json        (KG relations)
 *
 * Usage:
 *   npx tsx data/scripts/generate-from-source.ts berberine   # single slug
 *   npx tsx data/scripts/generate-from-source.ts             # all sources
 *
 * Source format: data/schema/ingredient-source.schema.yaml
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';

const ROOT = join(import.meta.dirname, '../..');
const SOURCES_DIR = join(ROOT, 'data/sources/ingredients');
const OUT_DE = join(ROOT, 'src/content/ingredients');
const OUT_EN = join(ROOT, 'src/content/en/ingredients');
const OUT_ENTITIES = join(ROOT, 'data/entities/ingredients');
const OUT_RELATIONS = join(ROOT, 'data/relations/by-entity');

// Ensure output directories exist
for (const d of [OUT_DE, OUT_EN, OUT_ENTITIES, OUT_RELATIONS]) {
  mkdirSync(d, { recursive: true });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalisedString {
  de: string;
  en: string;
}

interface KeyStudy {
  pmid?: string;
  title: string;
  authors: string;
  year: number;
  url?: string;
  finding: LocalisedString;
}

interface LocaleContent {
  summary: string;
  evidenceSummary: string;
  body: string;
}

interface Relation {
  relation: string;
  target: string;
  direction: 'outgoing' | 'incoming';
  confidence?: number;
  evidence_strength?: string;
  source?: string;
  note?: string;
}

interface IngredientSource {
  id: string;
  type: 'ingredient';
  meta: {
    title: LocalisedString;
    aliases: string[];
    category: string;
    evidenceLevel: string;
    safety_rating: string;
    efsa_health_claims_allowed: boolean;
    typical_dose_mg?: number;
    publishedAt: string;
    updatedAt?: string;
  };
  efsa_notes: LocalisedString;
  key_studies: KeyStudy[];
  locales: {
    de: LocaleContent;
    en: LocaleContent;
  };
  relations: Relation[];
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(source: unknown, slug: string): source is IngredientSource {
  const s = source as Record<string, unknown>;

  const required = ['id', 'type', 'meta', 'efsa_notes', 'key_studies', 'locales', 'relations'];
  for (const field of required) {
    if (!(field in s)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (s.id !== slug) {
    throw new Error(`id "${s.id}" does not match filename slug "${slug}"`);
  }

  if (s.type !== 'ingredient') {
    throw new Error(`type must be "ingredient", got "${s.type}"`);
  }

  const meta = s.meta as Record<string, unknown>;
  if (!meta.title || !(meta.title as Record<string, unknown>).de || !(meta.title as Record<string, unknown>).en) {
    throw new Error('meta.title must have both "de" and "en" keys');
  }

  const locales = s.locales as Record<string, unknown>;
  for (const locale of ['de', 'en']) {
    const loc = locales[locale] as Record<string, unknown> | undefined;
    if (!loc) throw new Error(`Missing locales.${locale}`);
    if (!loc.summary) throw new Error(`Missing locales.${locale}.summary`);
    if (!loc.evidenceSummary) throw new Error(`Missing locales.${locale}.evidenceSummary`);
    if (!loc.body) throw new Error(`Missing locales.${locale}.body`);
    if (typeof loc.summary === 'string' && loc.summary.length > 200) {
      throw new Error(`locales.${locale}.summary exceeds 200 chars (${(loc.summary as string).length})`);
    }
  }

  const studies = s.key_studies as unknown[];
  if (!Array.isArray(studies)) throw new Error('key_studies must be an array');
  if (studies.length > 5) throw new Error(`key_studies has ${studies.length} entries (max 5)`);

  return true;
}

// ── String helpers ────────────────────────────────────────────────────────────

/**
 * Escape < for JSX/MDX contexts. Does NOT escape > since Markdown uses > for
 * blockquotes. Already-escaped &lt; is left unchanged.
 */
function escapeMdx(str: string): string {
  return str.replace(/(?<!&lt|&amp|&#\d{1,5})<(?!\/?\w)/g, '&lt;');
}

/**
 * Wrap a string value for YAML frontmatter. Uses block scalar | for multiline,
 * double-quoted with escape for strings containing special chars.
 */
function yamlScalar(key: string, value: string, indent = ''): string {
  if (!value.includes('\n')) {
    // Single line: escape for double-quoted YAML
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    return `${indent}${key}: "${escaped}"`;
  }
  // Multiline: use literal block scalar
  const lines = value.split('\n').map(l => `${indent}  ${l}`).join('\n');
  return `${indent}${key}: |\n${lines}`;
}

/** Format a date value that might be a string or a Date object to YYYY-MM-DD */
function formatDate(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'string') return val;
  return String(val);
}

// ── MDX generation ────────────────────────────────────────────────────────────

function buildMdxFrontmatter(source: IngredientSource, locale: 'de' | 'en'): string {
  const { meta, efsa_notes, key_studies, locales } = source;
  const lc = locales[locale];
  const title = meta.title[locale];
  const efsa = efsa_notes[locale];

  // Aliases as YAML inline array
  const aliasesYaml = JSON.stringify(meta.aliases);

  const lines: string[] = [
    `title: "${title.replace(/"/g, '\\"')}"`,
    `slug: "${source.id}"`,
    `aliases: ${aliasesYaml}`,
    `category: ${meta.category}`,
    yamlScalar('summary', lc.summary),
    `evidenceLevel: "${meta.evidenceLevel}"`,
    yamlScalar('evidenceSummary', escapeMdx(lc.evidenceSummary)),
    `efsa_health_claims_allowed: ${meta.efsa_health_claims_allowed}`,
    yamlScalar('efsa_notes', escapeMdx(efsa)),
    `safety_rating: ${meta.safety_rating}`,
  ];

  if (meta.typical_dose_mg !== undefined) {
    lines.push(`typical_dose_mg: ${meta.typical_dose_mg}`);
  }

  lines.push(`publishedAt: ${formatDate(meta.publishedAt)}`);
  if (meta.updatedAt) {
    lines.push(`updatedAt: ${formatDate(meta.updatedAt)}`);
  }

  if (key_studies.length > 0) {
    lines.push('key_studies:');
    for (const study of key_studies) {
      const finding = escapeMdx(study.finding[locale]);
      lines.push(`  - title: "${study.title.replace(/"/g, '\\"')}"`);
      lines.push(`    authors: "${study.authors.replace(/"/g, '\\"')}"`);
      lines.push(`    year: ${study.year}`);
      if (study.pmid) lines.push(`    pmid: "${study.pmid}"`);
      if (study.url) lines.push(`    url: "${study.url}"`);
      // finding: wrap as multiline if needed
      const escapedFinding = finding.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      lines.push(`    finding: "${escapedFinding}"`);
    }
  }

  return lines.join('\n');
}

function generateMdx(source: IngredientSource, locale: 'de' | 'en'): string {
  const frontmatter = buildMdxFrontmatter(source, locale);
  const body = escapeMdx(source.locales[locale].body);

  return [
    '---',
    frontmatter,
    '---',
    '',
    `{/* Generated from data/sources/ingredients/${source.id}.yaml — do not edit directly */}`,
    '',
    body.trimEnd(),
    '',
  ].join('\n');
}

// ── KG entity generation ──────────────────────────────────────────────────────

function generateEntity(source: IngredientSource): object {
  const { id, meta, locales } = source;
  return {
    id,
    type: 'ingredient',
    name: meta.title.de,
    summary: locales.de.summary,
    aliases: meta.aliases,
    category: meta.category,
    evidenceLevel: parseInt(meta.evidenceLevel, 10),
    safety: meta.safety_rating,
    efsa_approved: meta.efsa_health_claims_allowed,
    ...(meta.typical_dose_mg !== undefined ? { typical_dose_mg: meta.typical_dose_mg } : {}),
  };
}

// ── KG relations generation ───────────────────────────────────────────────────

function generateRelations(source: IngredientSource): object {
  return {
    entity: source.id,
    relations: source.relations,
  };
}

// ── Process one source file ───────────────────────────────────────────────────

function processSource(slug: string): void {
  const sourcePath = join(SOURCES_DIR, `${slug}.yaml`);

  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const raw = readFileSync(sourcePath, 'utf-8');
  const { data: source } = matter(raw);

  validate(source, slug);
  const s = source as IngredientSource;

  // DE MDX
  const deMdx = generateMdx(s, 'de');
  const deOut = join(OUT_DE, `${slug}.mdx`);
  writeFileSync(deOut, deMdx);
  console.log(`  ✓ DE MDX → ${deOut.replace(ROOT + '/', '')}`);

  // EN MDX
  const enMdx = generateMdx(s, 'en');
  const enOut = join(OUT_EN, `${slug}.mdx`);
  writeFileSync(enOut, enMdx);
  console.log(`  ✓ EN MDX → ${enOut.replace(ROOT + '/', '')}`);

  // KG entity
  const entity = generateEntity(s);
  const entityOut = join(OUT_ENTITIES, `${slug}.json`);
  writeFileSync(entityOut, JSON.stringify(entity, null, 2) + '\n');
  console.log(`  ✓ KG entity → ${entityOut.replace(ROOT + '/', '')}`);

  // KG relations
  const relations = generateRelations(s);
  const relOut = join(OUT_RELATIONS, `${slug}.json`);
  writeFileSync(relOut, JSON.stringify(relations, null, 2) + '\n');
  console.log(`  ✓ KG relations → ${relOut.replace(ROOT + '/', '')}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length > 0) {
  // Process a single slug
  const slug = args[0];
  console.log(`\nGenerating from source: ${slug}`);
  try {
    processSource(slug);
    console.log(`\n✓ Done: ${slug}\n`);
  } catch (err) {
    console.error(`\n✗ Failed: ${(err as Error).message}\n`);
    process.exit(1);
  }
} else {
  // Process all source files
  if (!existsSync(SOURCES_DIR)) {
    console.error(`Sources directory not found: ${SOURCES_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(SOURCES_DIR).filter(f => f.endsWith('.yaml'));
  if (files.length === 0) {
    console.log('No source files found in', SOURCES_DIR);
    process.exit(0);
  }

  console.log(`\nGenerating from ${files.length} source file(s)...\n`);

  let ok = 0;
  let failed = 0;

  for (const file of files) {
    const slug = basename(file, '.yaml');
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
