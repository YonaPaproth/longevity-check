/**
 * Entity loading helpers for the MikroScore knowledge graph.
 *
 * Single source of truth for all entity file loading.
 * Works in Node.js contexts (scripts, build-time Astro).
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { EntityType, GraphEntity } from './types.ts';

// ── Directory mapping ─────────────────────────────────────────────────────────

/** Maps each entity type to its directory path relative to repo root */
const ENTITY_TYPE_DIRS: Record<EntityType, string> = {
  ingredient:  'data/entities/ingredients',
  mechanism:   'data/entities/mechanisms',
  biomarker:   'data/entities/biomarkers',
  symptom:     'data/entities/symptoms',
  regulatory:  'data/entities/regulatory',
  claim:       'data/entities/claims',
  study:       'data/entities/studies',
};

// ── Internal state ────────────────────────────────────────────────────────────

let _cache: Map<string, GraphEntity> | null = null;

function resolveRoot(): string {
  // Works whether called from scripts/ or src/lib/
  // Walks up from this file's location to find the repo root (contains package.json)
  let dir = new URL('.', import.meta.url).pathname;
  // Go up: src/lib/graph → src/lib → src → repo root
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = join(dir, '..');
  }
  // Fallback: assume cwd is repo root (used when running scripts from root)
  return process.cwd();
}

const REPO_ROOT = resolveRoot();

function loadAllEntities(): Map<string, GraphEntity> {
  const index = new Map<string, GraphEntity>();

  for (const [type, relDir] of Object.entries(ENTITY_TYPE_DIRS) as [EntityType, string][]) {
    const dir = join(REPO_ROOT, relDir);
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = join(dir, file);
      let entity: GraphEntity;
      try {
        entity = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch {
        continue;
      }

      // Enforce type from directory if missing
      if (!entity.type) {
        (entity as GraphEntity).type = type;
      }

      index.set(entity.id, entity);
    }
  }

  return index;
}

function getIndex(): Map<string, GraphEntity> {
  if (!_cache) _cache = loadAllEntities();
  return _cache;
}

/** Invalidate the in-memory cache (useful for testing) */
export function invalidateEntityCache(): void {
  _cache = null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getAllEntities(): GraphEntity[] {
  return Array.from(getIndex().values());
}

export function getEntityById(id: string): GraphEntity | undefined {
  return getIndex().get(id);
}

export function getEntitiesByType(type: EntityType): GraphEntity[] {
  return getAllEntities().filter(e => e.type === type);
}

export function hasEntity(id: string): boolean {
  return getIndex().has(id);
}

export function getEntityTypeDirectory(type: EntityType): string {
  return join(REPO_ROOT, ENTITY_TYPE_DIRS[type]);
}

/**
 * Returns all entity IDs that appear more than once across all entity dirs.
 * Useful for duplicate detection in validation.
 */
export function findDuplicateEntityIds(): string[] {
  const seen = new Map<string, number>();
  for (const [type, relDir] of Object.entries(ENTITY_TYPE_DIRS) as [EntityType, string][]) {
    const dir = join(REPO_ROOT, relDir);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const entity = JSON.parse(readFileSync(filePath, 'utf-8')) as GraphEntity;
        seen.set(entity.id, (seen.get(entity.id) ?? 0) + 1);
      } catch {
        // ignore parse errors — caught elsewhere
      }
    }
  }
  return Array.from(seen.entries()).filter(([, count]) => count > 1).map(([id]) => id);
}

/**
 * Returns entities with a mismatched filename vs id field.
 * e.g. file is `nmn.json` but entity.id is `nmn-supplement`.
 */
export function findFilenameMismatches(): Array<{ file: string; entityId: string }> {
  const mismatches: Array<{ file: string; entityId: string }> = [];
  for (const [, relDir] of Object.entries(ENTITY_TYPE_DIRS) as [EntityType, string][]) {
    const dir = join(REPO_ROOT, relDir);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const expectedId = file.replace(/\.json$/, '');
      const filePath = join(dir, file);
      try {
        const entity = JSON.parse(readFileSync(filePath, 'utf-8')) as GraphEntity;
        if (entity.id !== expectedId) {
          mismatches.push({ file: `${relDir}/${file}`, entityId: entity.id });
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return mismatches;
}
