/**
 * Core TypeScript types for the MikroScore knowledge graph.
 *
 * All graph code (components, pages, scripts) should import from here.
 * Do not define local copies of these types.
 */

// ── Locale ────────────────────────────────────────────────────────────────────

export type GraphLocale = 'de' | 'en';

// ── Entity types ──────────────────────────────────────────────────────────────

/**
 * All supported KG entity types.
 * `study` is first-class but hidden from default public graph visualization.
 */
export type EntityType =
  | 'ingredient'
  | 'mechanism'
  | 'biomarker'
  | 'symptom'
  | 'regulatory'
  | 'claim'
  | 'study';

export const ENTITY_TYPES: readonly EntityType[] = [
  'ingredient',
  'mechanism',
  'biomarker',
  'symptom',
  'regulatory',
  'claim',
  'study',
];

// ── Relation types ────────────────────────────────────────────────────────────

/**
 * All allowed relation types. Canonical list lives in data/schema/relation-types.json.
 * Keep in sync.
 */
export type RelationType =
  | 'wird_eingesetzt_fuer'
  | 'basiert_auf_studie'
  | 'benoetigt_biomarker_check'
  | 'wirkt_ueber'
  | 'hat_interaktion_mit'
  | 'hat_regulatorischen_status'
  | 'kontraindiziert_bei'
  | 'hat_nebenwirkung'
  | 'zielt_auf'
  | 'bezieht_sich_auf'
  | 'verwandter_wirkstoff';

export const RELATION_TYPES: readonly RelationType[] = [
  'wird_eingesetzt_fuer',
  'basiert_auf_studie',
  'benoetigt_biomarker_check',
  'wirkt_ueber',
  'hat_interaktion_mit',
  'hat_regulatorischen_status',
  'kontraindiziert_bei',
  'hat_nebenwirkung',
  'zielt_auf',
  'bezieht_sich_auf',
  'verwandter_wirkstoff',
];

export type RelationDirection = 'outgoing' | 'incoming';

// ── Raw file types ────────────────────────────────────────────────────────────

/** A raw KG entity as stored in data/entities/{type}/*.json */
export interface GraphEntity {
  id: string;
  type: EntityType;
  /** Human-readable name (DE). Studies use `title` instead. */
  name?: string;
  aliases?: string[];
  summary?: string;
  description?: string;
  [key: string]: unknown;
}

/** A study entity as stored in data/entities/studies/*.json.
 *
 * Canonical study ID rules (in order of preference):
 *   1. pmid-{PMID}   when PMID exists
 *   2. doi-{normalized-doi}   when DOI exists (slashes replaced with dashes)
 *   3. studie-{PMID}  legacy format — still accepted, prefer pmid-{PMID} for new entries
 */
export interface StudyEntity extends GraphEntity {
  type: 'study';
  title: string;
  authors: string;
  year: number;
  url: string;
  pmid?: string;
  doi?: string;
  journal?: string;
  studyType?: string;
  /** Neutral data summary (not page-specific editorial framing) */
  summary?: string;
}

/** A single relation as stored inside a by-entity file */
export interface GraphRelation {
  relation: string;
  target: string;
  direction: RelationDirection;
  confidence?: number;
  evidence_strength?: string;
  source?: string;
  note?: string;
}

/** The full by-entity relation file shape (data/relations/by-entity/*.json) */
export interface GraphRelationFile {
  entity: string;
  relations: GraphRelation[];
}

// ── Derived UI/API types ──────────────────────────────────────────────────────

/** A graph node ready for UI rendering or JSON API output */
export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  /** Internal site path, or undefined when no public page exists yet */
  path: string | undefined;
  /** Evidence level 1 (strongest) – 5 (weakest). Ingredients only. */
  evidenceLevel?: number;
  /** Whether EFSA has approved health claims for this ingredient. Ingredients only. */
  efsaApproved?: boolean;
  /** Human evidence strength for this claim ('stark'|'moderat'|'begrenzt'|'negativ'|'keine-daten'). Claims only. */
  claimHumanEvidence?: string;
  /** Regulatory EFSA reference id (e.g. 'efsa-nicht-zugelassen'). Claims only. */
  regulatoryEfsa?: string;
}

/** A graph edge ready for UI rendering or JSON API output */
export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: number;
}

/** Full graph data shape (matches /data/graph*.json endpoint contract) */
export interface GraphData {
  meta: {
    locale: GraphLocale;
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    includesStudies: boolean;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSubgraphOptions {
  includeStudies?: boolean;
  includeExternalOnlyNodes?: boolean;
  depth?: number;
}

// ── Validation result types ───────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  file?: string;
  entityId?: string;
}

export interface ValidationReport {
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
  passed: boolean;
}
