/**
 * validate.ts
 *
 * Validates all entity + relation JSONs against schemas.
 * Reports errors and warnings.
 *
 * Run: npx tsx data/scripts/validate.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';

const ROOT = join(import.meta.dirname, '../..');
const ENTITIES_DIR = join(ROOT, 'data/entities');
const RELATIONS_DIR = join(ROOT, 'data/relations/by-entity');
const SCHEMA_DIR = join(ROOT, 'data/schema');

const ajv = new Ajv({ allErrors: true });

const entitySchema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'entity.schema.json'), 'utf-8'));
const relationSchema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'relation.schema.json'), 'utf-8'));

const validateEntity = ajv.compile(entitySchema);
const validateRelation = ajv.compile(relationSchema);

let entityErrors = 0;
let relationErrors = 0;

// ── Validate all entities ─────────────────────────────────────────────────────

const entityDirs = readdirSync(ENTITIES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const dir of entityDirs) {
  const files = readdirSync(join(ENTITIES_DIR, dir)).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const path = join(ENTITIES_DIR, dir, file);
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      if (!validateEntity(data)) {
        console.error(`✗ ${dir}/${file}:`);
        console.error(`  ${ajv.errorsText(validateEntity.errors)}`);
        entityErrors++;
      }
    } catch (e) {
      console.error(`✗ ${dir}/${file}: Parse error - ${(e as Error).message}`);
      entityErrors++;
    }
  }
}

// ── Validate all relations ────────────────────────────────────────────────────

const relFiles = readdirSync(RELATIONS_DIR).filter(f => f.endsWith('.json'));
for (const file of relFiles) {
  const path = join(RELATIONS_DIR, file);
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (!validateRelation(data)) {
      console.error(`✗ ${file}:`);
      console.error(`  ${ajv.errorsText(validateRelation.errors)}`);
      relationErrors++;
    }
  } catch (e) {
    console.error(`✗ ${file}: Parse error - ${(e as Error).message}`);
    relationErrors++;
  }
}

console.log(`\n${ entityErrors === 0 && relationErrors === 0 ? '✓' : '✗'} Validation complete`);
console.log(`  Entity errors:    ${entityErrors}`);
console.log(`  Relation errors:  ${relationErrors}`);

process.exit(entityErrors + relationErrors > 0 ? 1 : 0);
