/**
 * Reusable KG validation helpers.
 *
 * Returns machine-readable ValidationIssue objects.
 * Used by scripts/validate-kg.ts and any future test infrastructure.
 */

import type {
  EntityType,
  GraphEntity,
  GraphRelationFile,
  ValidationIssue,
  ValidationReport,
} from './types.ts';
import { ENTITY_TYPES, RELATION_TYPES } from './types.ts';

// ── Study ID patterns ─────────────────────────────────────────────────────────

/**
 * Valid study ID patterns:
 *   pmid-{digits}          preferred new format
 *   studie-{digits}        legacy format (still valid)
 *   doi-{non-empty-string} DOI-based id
 */
const STUDY_ID_RE = /^(pmid-\d+|studie-\d+|doi-.+)$/;

/**
 * Returns true if `target` looks like a study reference.
 * Used to classify missing targets as warnings vs errors.
 */
function isStudyLikeTarget(target: string): boolean {
  return /^(studie-|pmid-|doi-)/.test(target);
}

// ── Individual checks ─────────────────────────────────────────────────────────

export function checkEntityType(entity: GraphEntity, file: string): ValidationIssue | null {
  if (!ENTITY_TYPES.includes(entity.type as EntityType)) {
    return {
      severity: 'error',
      code: 'INVALID_ENTITY_TYPE',
      message: `Entity "${entity.id}" has unknown type "${entity.type}". Allowed: ${ENTITY_TYPES.join(', ')}`,
      file,
      entityId: entity.id,
    };
  }
  return null;
}

export function checkStudyEntityFields(entity: GraphEntity, file: string): ValidationIssue[] {
  if (entity.type !== 'study') return [];
  const issues: ValidationIssue[] = [];

  const required: Array<keyof GraphEntity> = ['id', 'type', 'title', 'authors', 'year', 'url'] as any;
  for (const field of required) {
    if (!entity[field]) {
      issues.push({
        severity: 'error',
        code: 'STUDY_MISSING_REQUIRED_FIELD',
        message: `Study "${entity.id}" is missing required field "${field}"`,
        file,
        entityId: entity.id,
      });
    }
  }

  const idIssue = checkStudyIdFormat(entity, file);
  if (idIssue) issues.push(idIssue);

  return issues;
}

export function checkStudyIdFormat(entity: GraphEntity, file: string): ValidationIssue | null {
  if (entity.type !== 'study') return null;
  if (!STUDY_ID_RE.test(entity.id)) {
    return {
      severity: 'error',
      code: 'INVALID_STUDY_ID_FORMAT',
      message: `Study "${entity.id}" does not match required ID format. Use "pmid-{PMID}", "doi-{doi}", or legacy "studie-{PMID}"`,
      file,
      entityId: entity.id,
    };
  }
  return null;
}

export function checkRelationType(
  entityId: string,
  relationType: string,
  file: string,
): ValidationIssue | null {
  if (!(RELATION_TYPES as readonly string[]).includes(relationType)) {
    return {
      severity: 'error',
      code: 'INVALID_RELATION_TYPE',
      message: `Entity "${entityId}" uses unknown relation type "${relationType}". Allowed: ${RELATION_TYPES.join(', ')}`,
      file,
      entityId,
    };
  }
  return null;
}

export function checkRelationTarget(
  entityId: string,
  target: string,
  relationType: string,
  file: string,
  entityExists: (id: string) => boolean,
): ValidationIssue | null {
  if (!entityExists(target)) {
    // Missing study targets are warnings — migration batch 2 will populate them
    if (relationType === 'basiert_auf_studie' && isStudyLikeTarget(target)) {
      return {
        severity: 'warning',
        code: 'MISSING_STUDY_ENTITY',
        message: `Entity "${entityId}" references study target "${target}" which has no entity file yet (migration pending)`,
        file,
        entityId,
      };
    }
    return {
      severity: 'error',
      code: 'MISSING_RELATION_TARGET',
      message: `Entity "${entityId}" relation "${relationType}" references unknown target "${target}"`,
      file,
      entityId,
    };
  }
  return null;
}

export function checkRelationConfidence(
  entityId: string,
  confidence: number | undefined,
  relationType: string,
  file: string,
): ValidationIssue | null {
  if (confidence === undefined) return null; // optional field
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return {
      severity: 'error',
      code: 'INVALID_CONFIDENCE',
      message: `Entity "${entityId}" relation "${relationType}" has confidence "${confidence}" outside [0, 1]`,
      file,
      entityId,
    };
  }
  return null;
}

export function checkRelationDirection(
  entityId: string,
  direction: string | undefined,
  relationType: string,
  file: string,
): ValidationIssue | null {
  if (direction !== 'outgoing' && direction !== 'incoming') {
    return {
      severity: 'error',
      code: 'INVALID_RELATION_DIRECTION',
      message: `Entity "${entityId}" relation "${relationType}" has invalid direction "${direction}". Use "outgoing" or "incoming"`,
      file,
      entityId,
    };
  }
  return null;
}

export function checkEntityFilenameMismatch(
  entityId: string,
  expectedId: string,
  file: string,
): ValidationIssue | null {
  if (entityId !== expectedId) {
    return {
      severity: 'error',
      code: 'ENTITY_FILENAME_MISMATCH',
      message: `File "${file}" has id "${entityId}" but filename suggests "${expectedId}"`,
      file,
      entityId,
    };
  }
  return null;
}

export function checkRelationsFilenameMismatch(
  entityField: string,
  filenameStem: string,
  file: string,
): ValidationIssue | null {
  if (entityField !== filenameStem) {
    return {
      severity: 'error',
      code: 'RELATIONS_FILENAME_MISMATCH',
      message: `Relation file "${file}" has entity "${entityField}" but filename stem is "${filenameStem}"`,
      file,
    };
  }
  return null;
}

export function checkRelationSourceEntity(
  entityField: string,
  file: string,
  entityExists: (id: string) => boolean,
): ValidationIssue | null {
  if (!entityExists(entityField)) {
    return {
      severity: 'error',
      code: 'MISSING_RELATION_SOURCE',
      message: `Relation file "${file}" references source entity "${entityField}" which has no entity file`,
      file,
      entityId: entityField,
    };
  }
  return null;
}

// ── Duplicate detection ───────────────────────────────────────────────────────

export function checkDuplicateEntityIds(
  entities: GraphEntity[],
): ValidationIssue[] {
  const seen = new Map<string, number>();
  for (const e of entities) {
    seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
  }
  return Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => ({
      severity: 'error' as const,
      code: 'DUPLICATE_ENTITY_ID',
      message: `Entity id "${id}" appears ${seen.get(id)} times across entity directories`,
      entityId: id,
    }));
}

export function checkDuplicateStudyPmids(entities: GraphEntity[]): ValidationIssue[] {
  const pmidSeen = new Map<string, string[]>();
  for (const e of entities) {
    if (e.type !== 'study') continue;
    const pmid = (e as { pmid?: string }).pmid;
    if (pmid) {
      if (!pmidSeen.has(pmid)) pmidSeen.set(pmid, []);
      pmidSeen.get(pmid)!.push(e.id);
    }
  }
  return Array.from(pmidSeen.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([pmid, ids]) => ({
      severity: 'error' as const,
      code: 'DUPLICATE_STUDY_PMID',
      message: `PMID "${pmid}" is referenced by multiple study entities: ${ids.join(', ')}`,
    }));
}

export function checkDuplicateStudyDois(entities: GraphEntity[]): ValidationIssue[] {
  const doiSeen = new Map<string, string[]>();
  for (const e of entities) {
    if (e.type !== 'study') continue;
    const doi = (e as { doi?: string }).doi;
    if (doi) {
      const normalized = doi.toLowerCase().trim();
      if (!doiSeen.has(normalized)) doiSeen.set(normalized, []);
      doiSeen.get(normalized)!.push(e.id);
    }
  }
  return Array.from(doiSeen.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([doi, ids]) => ({
      severity: 'error' as const,
      code: 'DUPLICATE_STUDY_DOI',
      message: `DOI "${doi}" is referenced by multiple study entities: ${ids.join(', ')}`,
    }));
}

// ── Full graph validation ─────────────────────────────────────────────────────

export function validateGraph(
  entities: GraphEntity[],
  relationFiles: GraphRelationFile[],
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Duplicate entity ids
  issues.push(...checkDuplicateEntityIds(entities));

  // Per-entity checks
  for (const entity of entities) {
    const file = `data/entities/${entity.type}s/${entity.id}.json`;
    const typeIssue = checkEntityType(entity, file);
    if (typeIssue) issues.push(typeIssue);
    issues.push(...checkStudyEntityFields(entity, file));
  }

  // Duplicate study PMIDs / DOIs
  issues.push(...checkDuplicateStudyPmids(entities));
  issues.push(...checkDuplicateStudyDois(entities));

  const entityIds = new Set(entities.map(e => e.id));
  const entityExists = (id: string) => entityIds.has(id);

  // Per-relation-file checks
  for (const relFile of relationFiles) {
    const filenameStem = relFile.entity;
    const file = `data/relations/by-entity/${filenameStem}.json`;

    // Relation source entity must exist
    const sourceIssue = checkRelationSourceEntity(relFile.entity, file, entityExists);
    if (sourceIssue) issues.push(sourceIssue);

    for (const rel of relFile.relations) {
      const typeIssue = checkRelationType(relFile.entity, rel.relation, file);
      if (typeIssue) issues.push(typeIssue);

      const targetIssue = checkRelationTarget(relFile.entity, rel.target, rel.relation, file, entityExists);
      if (targetIssue) issues.push(targetIssue);

      const confIssue = checkRelationConfidence(relFile.entity, rel.confidence, rel.relation, file);
      if (confIssue) issues.push(confIssue);

      const dirIssue = checkRelationDirection(relFile.entity, rel.direction, rel.relation, file);
      if (dirIssue) issues.push(dirIssue);
    }
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  return { errors, warnings, issues, passed: errors === 0 };
}
