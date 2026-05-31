/**
 * build-index.ts
 *
 * Reads all entity + relation files and generates:
 *   - data/index.json              (compact lookup of all entity IDs)
 *   - data/relations/by-type/*.json (one file per relation type)
 *
 * Run: npx tsx data/scripts/build-index.ts
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '../..');
const ENTITIES_DIR = join(ROOT, 'data/entities');
const RELATIONS_DIR = join(ROOT, 'data/relations/by-entity');
const BY_TYPE_DIR = join(ROOT, 'data/relations/by-type');

mkdirSync(BY_TYPE_DIR, { recursive: true });

// ── Collect all entities ──────────────────────────────────────────────────────

const index: Record<string, string[]> = {};

const entityDirs = readdirSync(ENTITIES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

let totalEntities = 0;

for (const dir of entityDirs) {
  const files = readdirSync(join(ENTITIES_DIR, dir)).filter(f => f.endsWith('.json'));
  index[dir] = files.map(f => f.replace('.json', '')).sort();
  totalEntities += files.length;
}

// ── Collect all relations by type ─────────────────────────────────────────────

const byType: Record<string, Array<{subject: string; target: string; confidence?: number; evidence_strength?: string; source?: string; note?: string}>> = {};

const relFiles = readdirSync(RELATIONS_DIR).filter(f => f.endsWith('.json'));
let totalRelations = 0;

for (const file of relFiles) {
  const data = JSON.parse(readFileSync(join(RELATIONS_DIR, file), 'utf-8'));
  for (const rel of data.relations) {
    if (rel.direction === 'incoming') continue; // only outgoing to avoid dupes in by-type

    if (!byType[rel.relation]) byType[rel.relation] = [];
    byType[rel.relation].push({
      subject: data.entity,
      target: rel.target,
      ...(rel.confidence !== undefined && { confidence: rel.confidence }),
      ...(rel.evidence_strength && { evidence_strength: rel.evidence_strength }),
      ...(rel.source && { source: rel.source }),
      ...(rel.note && { note: rel.note }),
    });
    totalRelations++;
  }
}

// ── Write by-type files ───────────────────────────────────────────────────────

for (const [type, rels] of Object.entries(byType)) {
  writeFileSync(join(BY_TYPE_DIR, `${type}.json`), JSON.stringify({
    type,
    count: rels.length,
    relations: rels
  }, null, 2) + '\n');
}

// ── Write index ───────────────────────────────────────────────────────────────

const indexData = {
  ...index,
  stats: {
    entities: totalEntities,
    relations: totalRelations,
    relationTypes: Object.keys(byType).length,
    lastUpdated: new Date().toISOString().split('T')[0]
  }
};

writeFileSync(join(ROOT, 'data/index.json'), JSON.stringify(indexData, null, 2) + '\n');

console.log('Index:');
for (const [type, ids] of Object.entries(index)) {
  console.log(`  ${type}: ${ids.length}`);
}
console.log(`\nRelation types: ${Object.keys(byType).length}`);
for (const [type, rels] of Object.entries(byType)) {
  console.log(`  ${type}: ${rels.length}`);
}
console.log(`\nTotal entities:  ${totalEntities}`);
console.log(`Total relations: ${totalRelations}`);
console.log('\n✓ Index built');
