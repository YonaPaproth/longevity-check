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
 *   npx tsx data/scripts/generate-from-source.ts --changed   # only git-changed files
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

// ── Study registry ───────────────────────────────────────────────────────────

const STUDIES_DIR = join(ROOT, 'data/sources/studies');

interface StudyMeta {
  id: string;
  type: 'study';
  pmid: string;
  title: string;
  authors: string;
  year: number;
  url?: string;
  n?: number;
  coi?: string;
  effect_size?: string;
  study_type?: string;
  evidence_quality?: string;
}

const studyRegistry = new Map<string, StudyMeta>();

if (existsSync(STUDIES_DIR)) {
  for (const f of readdirSync(STUDIES_DIR).filter(f => f.endsWith('.yaml'))) {
    const raw = readFileSync(join(STUDIES_DIR, f), 'utf-8');
    const { data } = matter(raw);
    studyRegistry.set(data.id as string, data as StudyMeta);
  }
  if (studyRegistry.size > 0) {
    console.log(`Loaded ${studyRegistry.size} studies from registry\n`);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalisedString {
  de: string;
  en: string;
}

/** Inline study with full metadata (legacy format) */
interface KeyStudyInline {
  pmid?: string;
  title: string;
  authors: string;
  year: number;
  url?: string;
  finding: LocalisedString;
}

/** Ref-based study pointing to registry (new format) */
interface KeyStudyRef {
  ref: string;
  finding: LocalisedString;
}

type KeyStudy = KeyStudyInline | KeyStudyRef;

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
  if (studies.length > 10) throw new Error(`key_studies has ${studies.length} entries (max 10)`);

  return true;
}

// ── String helpers ────────────────────────────────────────────────────────────

/**
 * Escape < for JSX/MDX contexts. Does NOT escape > since Markdown uses > for
 * blockquotes. Already-escaped &lt; is left unchanged.
 */
function escapeMdx(str: string): string {
  // Escape all bare < that are not already part of an HTML entity.
  // We preserve only actual HTML/JSX tags like <div>, </div>, <br />.
  return str.replace(/(?<!&lt|&amp|&#\d{1,5})<(?!\/?\s*[a-zA-Z][a-zA-Z0-9]*[\s>\/])/g, '&lt;');
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

// ── Study resolution ─────────────────────────────────────────────────────────

interface ResolvedStudy {
  pmid?: string;
  title: string;
  authors: string;
  year: number;
  url?: string;
  n?: number;
  coi?: string;
  effect_size?: string;
}

function resolveStudy(study: KeyStudy, ingredientId: string): ResolvedStudy {
  if ('ref' in study) {
    const meta = studyRegistry.get(study.ref);
    if (!meta) {
      throw new Error(
        `Study ref "${study.ref}" not found in registry (referenced by ${ingredientId}). ` +
        `Run: npx tsx data/scripts/extract-studies.ts --extract-only`
      );
    }
    return {
      pmid: meta.pmid,
      title: meta.title,
      authors: meta.authors,
      year: meta.year,
      url: meta.url,
      n: meta.n,
      coi: meta.coi,
      effect_size: meta.effect_size,
    };
  }
  // Inline study — return as-is
  return {
    pmid: study.pmid,
    title: study.title,
    authors: study.authors,
    year: study.year,
    url: study.url,
    n: (study as KeyStudyInline & { n?: number }).n,
    coi: (study as KeyStudyInline & { coi?: string }).coi,
    effect_size: (study as KeyStudyInline & { effect_size?: string }).effect_size,
  };
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
      // Resolve study metadata: ref-based or inline
      const resolved = resolveStudy(study, source.id);
      const finding = escapeMdx(study.finding[locale]);
      lines.push(`  - title: "${resolved.title.replace(/"/g, '\\"')}"`);
      lines.push(`    authors: "${resolved.authors.replace(/"/g, '\\"')}"`);
      lines.push(`    year: ${resolved.year}`);
      if (resolved.pmid) lines.push(`    pmid: "${resolved.pmid}"`);
      if (resolved.url) lines.push(`    url: "${resolved.url}"`);
      if (resolved.n !== undefined) lines.push(`    n: ${resolved.n}`);
      if (resolved.coi) lines.push(`    coi: "${resolved.coi}"`);
      if (resolved.effect_size) lines.push(`    effect_size: "${resolved.effect_size.replace(/"/g, '\\"')}"`);
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
    updatedAt: new Date().toISOString().split('T')[0],
    ...(meta.typical_dose_mg !== undefined ? { typical_dose_mg: meta.typical_dose_mg } : {}),
  };
}

// ── KG relations generation ───────────────────────────────────────────────────

// ── Relation enrichment: source + evidence_level ────────────────────────────

const STUDY_TYPE_TO_EVIDENCE: Record<string, string> = {
  'Meta-Analysis': 'meta_analysis',
  'Systematic Review': 'meta_analysis',
  'RCT': 'human_rct',
  'Controlled Clinical Trial': 'human_rct',
  'Clinical Trial': 'human_rct',
  'Clinical Trial Phase I': 'human_rct',
  'Clinical Trial Phase II': 'human_rct',
  'Clinical Trial Phase III': 'human_rct',
  'Multicenter Study': 'human_rct',
  'Observational Study': 'human_observational',
  'Comparative Study': 'human_observational',
  'Evaluation Study': 'human_observational',
  'Validation Study': 'human_observational',
  'Twin Study': 'human_observational',
  'Case Report': 'human_observational',
  'Review': 'expert_review',
  'Preprint': 'expert_review',
  'Journal Article': 'expert_review',
};

function enrichRelations(relations: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return relations.map(rel => {
    const enriched = { ...rel };

    // Add source if missing
    if (!enriched.source) {
      if (rel.relation === 'hat_regulatorischen_status') {
        enriched.source = 'efsa-register';
      } else if (rel.relation === 'basiert_auf_studie') {
        // Should already have source, but fallback
        enriched.source = `pmid:${String(rel.target ?? '').replace('studie-', '')}`;
      } else {
        enriched.source = 'expert-review';
      }
    }

    // Add evidence_level for basiert_auf_studie from study registry
    if (rel.relation === 'basiert_auf_studie' && rel.target) {
      const targetId = String(rel.target);
      // Find study in registry by studie-XXXXX format
      for (const [studyId, meta] of studyRegistry) {
        const studieKey = `studie-${meta.pmid || studyId.replace('pmid-', '')}`;
        if (studieKey === targetId || studyId === targetId) {
          if (meta.study_type) {
            enriched.evidence_level = STUDY_TYPE_TO_EVIDENCE[meta.study_type] ?? 'expert_review';
          }
          break;
        }
      }
    }

    return enriched;
  });
}

function generateRelations(source: IngredientSource): object {
  return {
    entity: source.id,
    relations: enrichRelations(source.relations),
  };
}

// ── Study entity generation ──────────────────────────────────────────────────

const OUT_STUDY_ENTITIES = join(ROOT, 'data/entities/studies');
mkdirSync(OUT_STUDY_ENTITIES, { recursive: true });

function generateStudyEntities(): number {
  let count = 0;
  for (const [id, meta] of studyRegistry) {
    // Use studie-XXXXX as KG entity ID (matches relation target convention)
    const entityId = `studie-${meta.pmid}`;
    const entity = {
      id: entityId,
      type: 'study',
      title: meta.title,
      authors: meta.authors,
      year: meta.year,
      pmid: meta.pmid,
      ...(meta.url ? { url: meta.url } : {}),
    };
    writeFileSync(
      join(OUT_STUDY_ENTITIES, `${entityId}.json`),
      JSON.stringify(entity, null, 2) + '\n'
    );
    count++;
  }
  return count;
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

// ── Changed file detection ───────────────────────────────────────────────────

import { execSync } from 'child_process';

function getChangedSlugs(): string[] {
  const slugs = new Set<string>();

  // Detect changed ingredient YAMLs (staged + unstaged + untracked)
  const diff = execSync(
    'git diff --name-only HEAD -- data/sources/ingredients/ ; ' +
    'git diff --name-only --cached -- data/sources/ingredients/ ; ' +
    'git ls-files --others --exclude-standard -- data/sources/ingredients/',
    { cwd: ROOT, encoding: 'utf-8' }
  );
  for (const line of diff.split('\n').filter(Boolean)) {
    const match = line.match(/data\/sources\/ingredients\/([a-z0-9-]+)\.yaml$/);
    if (match) slugs.add(match[1]);
  }

  // Also detect changed study registry files → regenerate ingredients that ref them
  const studyDiff = execSync(
    'git diff --name-only HEAD -- data/sources/studies/ ; ' +
    'git diff --name-only --cached -- data/sources/studies/',
    { cwd: ROOT, encoding: 'utf-8' }
  );
  const changedStudyIds = new Set<string>();
  for (const line of studyDiff.split('\n').filter(Boolean)) {
    const match = line.match(/data\/sources\/studies\/(pmid-[a-z0-9-]+)\.yaml$/);
    if (match) changedStudyIds.add(match[1]);
  }

  // If any studies changed, find ingredients that reference them
  if (changedStudyIds.size > 0) {
    const ingredientFiles = readdirSync(SOURCES_DIR).filter(f => f.endsWith('.yaml'));
    for (const file of ingredientFiles) {
      const raw = readFileSync(join(SOURCES_DIR, file), 'utf-8');
      for (const studyId of changedStudyIds) {
        if (raw.includes(`ref: ${studyId}`)) {
          slugs.add(basename(file, '.yaml'));
          break;
        }
      }
    }
  }

  return [...slugs].sort();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const changedMode = args.includes('--changed');
const slugArgs = args.filter(a => !a.startsWith('--'));

if (changedMode) {
  // Process only changed files
  const slugs = getChangedSlugs();

  if (slugs.length === 0) {
    console.log('\nNo changed ingredient or study files detected.\n');
    process.exit(0);
  }

  console.log(`\nRegenerating ${slugs.length} changed source(s)...\n`);

  let ok = 0;
  let failed = 0;

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

  // Regenerate study entities if any study files changed
  if (studyRegistry.size > 0) {
    const studyCount = generateStudyEntities();
    console.log(`✓ ${studyCount} study entities generated\n`);
  }

  console.log(`✓ ${ok} succeeded, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
} else if (slugArgs.length > 0) {
  // Process a single slug
  const slug = slugArgs[0];
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

  // Generate study entities from registry
  if (studyRegistry.size > 0) {
    const studyCount = generateStudyEntities();
    console.log(`✓ ${studyCount} study entities generated\n`);
  }

  console.log(`✓ ${ok} succeeded, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}
