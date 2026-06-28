/**
 * extract-studies.ts
 *
 * Extracts study metadata from ingredient YAML source files into a
 * centralized study registry (data/sources/studies/), then rewrites
 * ingredient YAMLs to use ref-based study references.
 *
 * Usage:
 *   npx tsx data/scripts/extract-studies.ts --dry-run       # preview only
 *   npx tsx data/scripts/extract-studies.ts --extract-only   # create study files, don't rewrite YAMLs
 *   npx tsx data/scripts/extract-studies.ts                  # extract + rewrite
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';

const ROOT = join(import.meta.dirname, '../..');
const SOURCES_DIR = join(ROOT, 'data/sources/ingredients');
const STUDIES_DIR = join(ROOT, 'data/sources/studies');
const DRY_RUN = process.argv.includes('--dry-run');
const EXTRACT_ONLY = process.argv.includes('--extract-only');

mkdirSync(STUDIES_DIR, { recursive: true });

// ── Step 1: Collect all unique studies ────────────────────────────────────────

interface StudyMeta {
  pmid: string;
  title: string;
  authors: string;
  year: number;
  url?: string;
}

const studyMap = new Map<string, StudyMeta>();
const files = readdirSync(SOURCES_DIR).filter(f => f.endsWith('.yaml'));

for (const file of files) {
  const raw = readFileSync(join(SOURCES_DIR, file), 'utf-8');
  const { data } = matter(raw);

  if (!data.key_studies || !Array.isArray(data.key_studies)) continue;

  for (const study of data.key_studies) {
    // Skip entries that already use ref format
    if (study.ref) continue;

    const pmid = study.pmid?.toString().trim();
    if (!pmid) continue; // skip empty pmid — stays inline

    const id = `pmid-${pmid}`;
    if (!studyMap.has(id)) {
      studyMap.set(id, {
        pmid,
        title: study.title,
        authors: study.authors,
        year: study.year,
        ...(study.url ? { url: study.url } : {}),
      });
    }
  }
}

console.log(`Found ${studyMap.size} unique studies across ${files.length} ingredient files\n`);

// ── Step 2: Write study source files ─────────────────────────────────────────

let created = 0;
let skipped = 0;

for (const [id, study] of studyMap) {
  const outPath = join(STUDIES_DIR, `${id}.yaml`);

  if (existsSync(outPath)) {
    skipped++;
    continue;
  }

  // Escape double quotes in title/authors for YAML
  const escTitle = study.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escAuthors = study.authors.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const content = [
    '---',
    `id: ${id}`,
    `type: study`,
    `pmid: "${study.pmid}"`,
    `title: "${escTitle}"`,
    `authors: "${escAuthors}"`,
    `year: ${study.year}`,
    ...(study.url ? [`url: "${study.url}"`] : []),
    '---',
    '',
  ].join('\n');

  if (DRY_RUN) {
    console.log(`  Would create: ${id}.yaml`);
  } else {
    writeFileSync(outPath, content);
  }
  created++;
}

console.log(`${DRY_RUN ? 'Would create' : 'Created'} ${created} study files (${skipped} already existed)\n`);

if (EXTRACT_ONLY || DRY_RUN) {
  if (DRY_RUN) console.log('Dry run — no files written.');
  if (EXTRACT_ONLY) console.log('Extract-only — ingredient YAMLs not modified.');
  process.exit(0);
}

// ── Step 3: Rewrite ingredient YAMLs to use refs ─────────────────────────────

let modifiedCount = 0;

for (const file of files) {
  const filePath = join(SOURCES_DIR, file);
  const raw = readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);

  // Skip files with no studies or only ref/empty-pmid studies
  const inlineStudies = (data.key_studies || []).filter(
    (s: any) => !s.ref && s.pmid?.toString().trim()
  );
  if (inlineStudies.length === 0) continue;

  let modified = raw;

  for (const study of inlineStudies) {
    const pmid = study.pmid.toString().trim();
    const escapedPmid = pmid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match: `- pmid: "XXXXX"\n` followed by zero or more metadata lines
    // (title, authors, year, url) — stops before finding: or next entry
    const pattern = new RegExp(
      `([ \\t]*)- pmid: "${escapedPmid}"\\n` +
      `(?:[ \\t]+(?:title|authors|year|url): [^\\n]*\\n)*`
    );

    modified = modified.replace(pattern, (_, indent) => {
      return `${indent}- ref: pmid-${pmid}\n`;
    });
  }

  if (modified !== raw) {
    writeFileSync(filePath, modified);
    console.log(`  Modified: ${file}`);
    modifiedCount++;
  }
}

console.log(`\nModified ${modifiedCount} ingredient files`);
console.log('\nNext steps:');
console.log('  1. npx tsx data/scripts/generate-from-source.ts    # regenerate all MDX');
console.log('  2. pnpm build                                      # verify build');
