/**
 * scripts/validate-kg.ts
 *
 * KG validation CLI. Run via: pnpm validate:kg
 *
 * Checks:
 *   - every entity has a valid type
 *   - no duplicate entity IDs
 *   - entity filename matches id field
 *   - every relation type is allowed
 *   - every relation target exists (missing study targets are warnings)
 *   - every relation confidence is in [0, 1]
 *   - every relation direction is valid
 *   - every relation file's entity field matches its filename
 *   - every relation source entity exists
 *   - study entities have valid ID format and required fields
 *   - no duplicate study PMIDs or DOIs
 *
 * Exits nonzero on errors, zero on success (warnings are printed but do not block).
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { GraphEntity, GraphRelationFile, ValidationIssue } from '../src/lib/graph/types.ts';
import { validateGraph } from '../src/lib/graph/validate.ts';

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();
const ENTITIES_ROOT = join(REPO_ROOT, 'data/entities');
const RELATIONS_DIR = join(REPO_ROOT, 'data/relations/by-entity');

const ENTITY_TYPE_DIRS = [
  'ingredients',
  'mechanisms',
  'biomarkers',
  'symptoms',
  'regulatory',
  'claims',
  'studies',
];

// ── Load data ─────────────────────────────────────────────────────────────────

function loadEntities(): { entities: GraphEntity[]; loadIssues: ValidationIssue[] } {
  const entities: GraphEntity[] = [];
  const loadIssues: ValidationIssue[] = [];

  for (const subdir of ENTITY_TYPE_DIRS) {
    const dir = join(ENTITIES_ROOT, subdir);
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const entity: GraphEntity = JSON.parse(readFileSync(filePath, 'utf-8'));
        const expectedId = file.replace(/\.json$/, '');

        // Check filename ↔ id mismatch
        if (entity.id !== expectedId) {
          loadIssues.push({
            severity: 'error',
            code: 'ENTITY_FILENAME_MISMATCH',
            message: `File "data/entities/${subdir}/${file}" has id "${entity.id}" but filename suggests "${expectedId}"`,
            file: `data/entities/${subdir}/${file}`,
            entityId: entity.id,
          });
        }

        entities.push(entity);
      } catch (e) {
        loadIssues.push({
          severity: 'error',
          code: 'ENTITY_PARSE_ERROR',
          message: `Failed to parse "data/entities/${subdir}/${file}": ${(e as Error).message}`,
          file: `data/entities/${subdir}/${file}`,
        });
      }
    }
  }

  return { entities, loadIssues };
}

function loadRelationFiles(): { files: GraphRelationFile[]; loadIssues: ValidationIssue[] } {
  const files: GraphRelationFile[] = [];
  const loadIssues: ValidationIssue[] = [];

  if (!existsSync(RELATIONS_DIR)) return { files, loadIssues };

  const jsonFiles = readdirSync(RELATIONS_DIR).filter(f => f.endsWith('.json'));
  for (const file of jsonFiles) {
    const filePath = join(RELATIONS_DIR, file);
    const filenameStem = file.replace(/\.json$/, '');
    try {
      const data: GraphRelationFile = JSON.parse(readFileSync(filePath, 'utf-8'));

      // Check filename ↔ entity field mismatch
      if (data.entity !== filenameStem) {
        loadIssues.push({
          severity: 'error',
          code: 'RELATIONS_FILENAME_MISMATCH',
          message: `Relation file "data/relations/by-entity/${file}" has entity "${data.entity}" but filename stem is "${filenameStem}"`,
          file: `data/relations/by-entity/${file}`,
        });
      }

      files.push(data);
    } catch (e) {
      loadIssues.push({
        severity: 'error',
        code: 'RELATION_PARSE_ERROR',
        message: `Failed to parse "data/relations/by-entity/${file}": ${(e as Error).message}`,
        file: `data/relations/by-entity/${file}`,
      });
    }
  }

  return { files, loadIssues };
}

// ── Report helpers ────────────────────────────────────────────────────────────

function printIssue(issue: ValidationIssue): void {
  const prefix = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
  const loc = issue.file ? `  [${issue.file}]` : '';
  console.log(`  ${prefix} [${issue.code}] ${issue.message}${loc}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  MikroScore KG Validator');
  console.log('──────────────────────────────────────────────────────────────\n');

  // Load
  const { entities, loadIssues: entityLoadIssues } = loadEntities();
  const { files: relationFiles, loadIssues: relationLoadIssues } = loadRelationFiles();

  console.log(`  Loaded ${entities.length} entities from ${ENTITY_TYPE_DIRS.length} directories`);
  console.log(`  Loaded ${relationFiles.length} relation files\n`);

  // Validate
  const report = validateGraph(entities, relationFiles);

  // Combine all issues
  const allIssues: ValidationIssue[] = [
    ...entityLoadIssues,
    ...relationLoadIssues,
    ...report.issues,
  ];

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');

  // Print errors
  if (errors.length > 0) {
    console.log(`  ERRORS (${errors.length}):`);
    for (const issue of errors) printIssue(issue);
    console.log();
  }

  // Print warnings (grouped by code for readability when there are many)
  if (warnings.length > 0) {
    const byCode = new Map<string, ValidationIssue[]>();
    for (const w of warnings) {
      if (!byCode.has(w.code)) byCode.set(w.code, []);
      byCode.get(w.code)!.push(w);
    }

    console.log(`  WARNINGS (${warnings.length}):`);
    for (const [code, group] of byCode) {
      if (group.length === 1) {
        printIssue(group[0]);
      } else {
        console.log(`  ⚠ [${code}] ${group.length} issues — first: ${group[0].message}`);
        if (group.length <= 5) {
          for (const w of group.slice(1)) printIssue(w);
        } else {
          console.log(`    (${group.length - 1} more — run with --verbose to see all)`);
        }
      }
    }
    console.log();
  }

  // Summary
  console.log('──────────────────────────────────────────────────────────────');
  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✓ KG validation passed — no issues found\n');
  } else if (errors.length === 0) {
    console.log(`  ✓ KG validation passed with ${warnings.length} warning(s)\n`);
  } else {
    console.log(`  ✗ KG validation FAILED — ${errors.length} error(s), ${warnings.length} warning(s)\n`);
  }
  console.log('──────────────────────────────────────────────────────────────\n');

  if (errors.length > 0 || entityLoadIssues.some(i => i.severity === 'error') || relationLoadIssues.some(i => i.severity === 'error')) {
    process.exit(1);
  }
}

main();
