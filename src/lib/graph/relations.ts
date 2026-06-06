/**
 * Relation loading helpers for the MikroScore knowledge graph.
 *
 * Single source of truth for all relation file loading.
 * Works in Node.js contexts (scripts, build-time Astro).
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { GraphRelation, GraphRelationFile } from './types.ts';

// ── Internal state ────────────────────────────────────────────────────────────

let _cache: Map<string, GraphRelationFile> | null = null;

function resolveRoot(): string {
  let dir = new URL('.', import.meta.url).pathname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = join(dir, '..');
  }
  return process.cwd();
}

const REPO_ROOT = resolveRoot();
const RELATIONS_DIR = join(REPO_ROOT, 'data/relations/by-entity');

function loadAllRelations(): Map<string, GraphRelationFile> {
  const index = new Map<string, GraphRelationFile>();

  if (!existsSync(RELATIONS_DIR)) return index;

  const files = readdirSync(RELATIONS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = join(RELATIONS_DIR, file);
    try {
      const data: GraphRelationFile = JSON.parse(readFileSync(filePath, 'utf-8'));
      index.set(data.entity, data);
    } catch {
      // ignore parse errors — caught by validator
    }
  }

  return index;
}

function getIndex(): Map<string, GraphRelationFile> {
  if (!_cache) _cache = loadAllRelations();
  return _cache;
}

/** Invalidate the in-memory cache (useful for testing) */
export function invalidateRelationsCache(): void {
  _cache = null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all relations stored for a given entity id (outgoing + incoming as stored) */
export function getRelationsForEntity(id: string): GraphRelation[] {
  return getIndex().get(id)?.relations ?? [];
}

/** Returns only outgoing relations for an entity */
export function getOutgoingRelations(id: string): GraphRelation[] {
  return getRelationsForEntity(id).filter(r => r.direction === 'outgoing');
}

/**
 * Returns incoming relations for an entity.
 * Checks the entity's own file first, then scans all entities for relations
 * pointing at this id.
 */
export function getIncomingRelations(id: string): GraphRelation[] {
  const fromFile = getRelationsForEntity(id).filter(r => r.direction === 'incoming');
  if (fromFile.length > 0) return fromFile;

  // Derive by scanning all entity relation files
  const derived: GraphRelation[] = [];
  for (const [entityId, file] of getIndex()) {
    if (entityId === id) continue;
    for (const rel of file.relations) {
      if (rel.target === id && rel.direction === 'outgoing') {
        derived.push({ ...rel, direction: 'incoming' });
      }
    }
  }
  return derived;
}

/** Returns all relations of a given type across all entities */
export function getRelationsByType(relationType: string): Array<{ entity: string; relation: GraphRelation }> {
  const results: Array<{ entity: string; relation: GraphRelation }> = [];
  for (const [entityId, file] of getIndex()) {
    for (const rel of file.relations) {
      if (rel.relation === relationType) {
        results.push({ entity: entityId, relation: rel });
      }
    }
  }
  return results;
}

export function hasRelationsFile(id: string): boolean {
  return getIndex().has(id);
}

/** Returns all loaded relation files */
export function getAllRelationFiles(): GraphRelationFile[] {
  return Array.from(getIndex().values());
}

/**
 * Returns relation files where the filename stem does not match entity field.
 * Used for validation.
 */
export function findEntityFieldMismatches(): Array<{ file: string; filenameStem: string; entityField: string }> {
  const mismatches: Array<{ file: string; filenameStem: string; entityField: string }> = [];

  if (!existsSync(RELATIONS_DIR)) return mismatches;

  const files = readdirSync(RELATIONS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filenameStem = file.replace(/\.json$/, '');
    const filePath = join(RELATIONS_DIR, file);
    try {
      const data: GraphRelationFile = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (data.entity !== filenameStem) {
        mismatches.push({
          file: `data/relations/by-entity/${file}`,
          filenameStem,
          entityField: data.entity,
        });
      }
    } catch {
      // ignore parse errors
    }
  }

  return mismatches;
}
