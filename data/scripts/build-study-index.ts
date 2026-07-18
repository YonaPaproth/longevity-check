/**
 * build-study-index.ts
 *
 * Generates a master study index by aggregating:
 *   - All study YAMLs from data/sources/studies/
 *   - KG relations: which ingredients link to each study (basiert_auf_studie)
 *   - Research reviews: which weekly edition mentions each PMID
 *
 * Output:
 *   data/study-index.json   — machine-readable
 *   data/study-index.csv    — spreadsheet-friendly
 *
 * Usage:
 *   npx tsx data/scripts/build-study-index.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '../..');

// ── 1. Load all study YAMLs ──────────────────────────────────────────────────

function parseSimpleYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*["']?(.+?)["']?\s*$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return result;
}

const studiesDir = join(ROOT, 'data/sources/studies');
const studyFiles = readdirSync(studiesDir).filter(f => f.endsWith('.yaml'));

interface StudyEntry {
  id: string;
  pmid: string;
  title: string;
  authors: string;
  year: string;
  url: string;
  study_type: string;
  evidence_quality: string;
  n: string;
  coi: string;
  effect_size: string;
  ingredients: string[];
  research_reviews: string[];
}

const studies = new Map<string, StudyEntry>();

for (const file of studyFiles) {
  const content = readFileSync(join(studiesDir, file), 'utf-8');
  const yaml = parseSimpleYaml(content);
  
  const id = yaml.id || file.replace('.yaml', '');
  studies.set(id, {
    id,
    pmid: yaml.pmid || '',
    title: yaml.title || '',
    authors: yaml.authors || '',
    year: yaml.year || '',
    url: yaml.url || '',
    study_type: yaml.study_type || '',
    evidence_quality: yaml.evidence_quality || '',
    n: yaml.n || '',
    coi: yaml.coi || '',
    effect_size: yaml.effect_size || '',
    ingredients: [],
    research_reviews: [],
  });
}

// ── 2. Cross-reference KG relations ─────────────────────────────────────────

const relationsDir = join(ROOT, 'data/relations/by-entity');
const relationFiles = readdirSync(relationsDir).filter(f => f.endsWith('.json'));

// Build lookup maps: studie-XXXXX → study entry, pmid → study entry
const byStudieId = new Map<string, StudyEntry>();
const byPmid = new Map<string, StudyEntry>();
for (const s of studies.values()) {
  // studie-XXXXX format used in KG
  const studieKey = `studie-${s.pmid || s.id.replace('pmid-', '')}`;
  byStudieId.set(studieKey, s);
  byStudieId.set(s.id, s); // also by direct id
  if (s.pmid) byPmid.set(s.pmid, s);
}

for (const file of relationFiles) {
  const ingredient = file.replace('.json', '');
  if (ingredient.startsWith('studie-')) continue; // skip study→study relations
  const json = JSON.parse(readFileSync(join(relationsDir, file), 'utf-8'));
  const relations = json.relations || [];
  
  for (const rel of relations) {
    if (rel.relation === 'basiert_auf_studie' && rel.target) {
      const study = byStudieId.get(rel.target);
      if (study && !study.ingredients.includes(ingredient)) {
        study.ingredients.push(ingredient);
      }
    }
  }
}

// ── 3. Cross-reference research reviews ─────────────────────────────────────

const reviewDirs = [
  join(ROOT, 'src/content/research-review'),
  join(ROOT, 'src/content/en/research-review'),
];

const reviewsByPmid = new Map<string, Set<string>>();

for (const dir of reviewDirs) {
  let files: string[];
  try { files = readdirSync(dir).filter(f => f.endsWith('.mdx')); }
  catch { continue; }
  
  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    const edition = file.replace('.mdx', '');
    // Find all PMIDs mentioned in the review content
    const pmidMatches = content.matchAll(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/g);
    for (const m of pmidMatches) {
      const pmid = m[1];
      if (!reviewsByPmid.has(pmid)) reviewsByPmid.set(pmid, new Set());
      reviewsByPmid.get(pmid)!.add(edition);
    }
  }
}

// Apply review cross-references
for (const study of studies.values()) {
  if (study.pmid && reviewsByPmid.has(study.pmid)) {
    study.research_reviews = [...reviewsByPmid.get(study.pmid)!]
      .filter((v, i, a) => a.indexOf(v) === i) // unique, filter DE/EN dupes
      .filter(v => !v.startsWith('en/') && !v.includes('en/'))
      .sort();
  }
}

// ── 4. Build output ──────────────────────────────────────────────────────────

const sortedStudies = [...studies.values()].sort((a, b) => {
  // Sort: used in reviews first, then by year desc, then by id
  if (a.research_reviews.length && !b.research_reviews.length) return -1;
  if (!a.research_reviews.length && b.research_reviews.length) return 1;
  return (b.year || '0').localeCompare(a.year || '0') || a.id.localeCompare(b.id);
});

// JSON output
const jsonOut = {
  generated: new Date().toISOString().split('T')[0],
  total: sortedStudies.length,
  with_type: sortedStudies.filter(s => s.study_type).length,
  with_reviews: sortedStudies.filter(s => s.research_reviews.length > 0).length,
  with_ingredients: sortedStudies.filter(s => s.ingredients.length > 0).length,
  studies: sortedStudies,
};
writeFileSync(join(ROOT, 'data/study-index.json'), JSON.stringify(jsonOut, null, 2));

// CSV output
const csvHeaders = ['id', 'pmid', 'year', 'study_type', 'evidence_quality', 'n', 'coi', 'effect_size', 'title', 'authors', 'url', 'ingredients', 'research_reviews'];
const csvRows = sortedStudies.map(s => [
  s.id,
  s.pmid,
  s.year,
  s.study_type,
  s.evidence_quality,
  s.n,
  s.coi,
  `"${(s.effect_size || '').replace(/"/g, '""')}"`,
  `"${s.title.replace(/"/g, '""')}"`,
  `"${s.authors.replace(/"/g, '""')}"`,
  s.url,
  s.ingredients.join('; '),
  s.research_reviews.join('; '),
].join(','));
writeFileSync(join(ROOT, 'data/study-index.csv'), [csvHeaders.join(','), ...csvRows].join('\n'));

// Summary
console.log(`\n✓ Study index built`);
console.log(`  Total studies: ${sortedStudies.length}`);
console.log(`  With study_type: ${jsonOut.with_type} / ${sortedStudies.length}`);
console.log(`  Used in research reviews: ${jsonOut.with_reviews}`);
console.log(`  Linked to ingredients: ${jsonOut.with_ingredients}`);
console.log(`  Output: data/study-index.json + data/study-index.csv`);
