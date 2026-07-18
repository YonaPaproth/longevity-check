/**
 * Graph builder helpers for the MikroScore knowledge graph.
 *
 * Produces graph-ready `GraphData` structures from raw KG entities and relations.
 * Deduplicates nodes and edges. Study nodes are excluded by default.
 */

import type {
  GraphData,
  GraphEdge,
  GraphLocale,
  GraphNode,
  GraphSubgraphOptions,
} from './types.ts';
import { getAllEntities, getEntityById } from './entities.ts';
import { getAllRelationFiles, getRelationsForEntity } from './relations.ts';
import { getEntityPath } from './paths.ts';
import { getEntityLabel } from './labels.ts';

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeNode(
  id: string,
  locale: GraphLocale,
): GraphNode | undefined {
  const entity = getEntityById(id);
  if (!entity) return undefined;
  return {
    id: entity.id,
    type: entity.type,
    label: getEntityLabel(entity, locale) ?? entity.id,
    path: getEntityPath(entity, locale),
  };
}

function edgeKey(source: string, target: string, relation: string): string {
  return `${source}::${relation}::${target}`;
}

// ── Public builders ───────────────────────────────────────────────────────────

/**
 * Builds a neighborhood subgraph centred on `entityId`.
 * Returns the entity itself plus all directly connected entities and the
 * relations between them.
 */
export function buildEntityNeighborhood(
  entityId: string,
  locale: GraphLocale = 'de',
  options: GraphSubgraphOptions = {},
): GraphData {
  const { includeStudies = false } = options;

  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  // Add the focal entity
  const focal = makeNode(entityId, locale);
  if (focal) {
    if (focal.type !== 'study' || includeStudies) {
      nodeMap.set(focal.id, focal);
    }
  }

  // Add neighbours from outgoing/stored relations
  const relations = getRelationsForEntity(entityId);
  for (const rel of relations) {
    const neighbour = makeNode(rel.target, locale);
    if (!neighbour) continue;
    if (neighbour.type === 'study' && !includeStudies) continue;

    nodeMap.set(neighbour.id, neighbour);

    const src = rel.direction === 'outgoing' ? entityId : rel.target;
    const tgt = rel.direction === 'outgoing' ? rel.target : entityId;
    const key = edgeKey(src, tgt, rel.relation);

    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        source: src,
        target: tgt,
        relation: rel.relation,
        confidence: rel.confidence ?? 1,
      });
    }
  }

  // Drop edges whose source or target is not in the node set
  for (const [key, edge] of edgeMap) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      edgeMap.delete(key);
    }
  }

  const nodes = Array.from(nodeMap.values());
  const edges = Array.from(edgeMap.values());

  return {
    meta: {
      locale,
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      includesStudies: includeStudies,
    },
    nodes,
    edges,
  };
}

/**
 * Builds the complete graph from all KG entities and relations.
 * Study nodes are excluded unless `options.includeStudies` is true.
 */
export function buildFullGraph(
  locale: GraphLocale = 'de',
  options: GraphSubgraphOptions = {},
): GraphData {
  const { includeStudies = false } = options;

  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  // Add all entities as nodes
  for (const entity of getAllEntities()) {
    if (entity.type === 'study' && !includeStudies) continue;
    const label = getEntityLabel(entity, locale) ?? entity.id;
    const path = getEntityPath(entity, locale);

    const node: GraphNode = { id: entity.id, type: entity.type, label, path };

    // Enrich with layout-relevant metadata where available
    if (entity.type === 'ingredient') {
      if (typeof entity.evidenceLevel === 'number') node.evidenceLevel = entity.evidenceLevel;
      if (typeof entity.efsa_approved === 'boolean') node.efsaApproved = entity.efsa_approved;
    } else if (entity.type === 'claim') {
      const evidence = entity.claimEvidence as Record<string, unknown> | undefined;
      if (typeof evidence?.human === 'string') node.claimHumanEvidence = evidence.human;
      const regulatory = entity.regulatory as Record<string, unknown> | undefined;
      if (typeof regulatory?.efsa === 'string') node.regulatoryEfsa = regulatory.efsa;
    }

    nodeMap.set(entity.id, node);
  }

  // Add all stored relations as edges
  for (const file of getAllRelationFiles()) {
    for (const rel of file.relations) {
      const src = rel.direction === 'outgoing' ? file.entity : rel.target;
      const tgt = rel.direction === 'outgoing' ? rel.target : file.entity;

      // Skip edges whose source or target is absent from the node set
      if (!nodeMap.has(src) || !nodeMap.has(tgt)) continue;

      const key = edgeKey(src, tgt, rel.relation);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          source: src,
          target: tgt,
          relation: rel.relation,
          confidence: rel.confidence ?? 1,
          ...(rel.source && { relationSource: rel.source }),
          ...(rel.evidence_level && { evidenceLevel: rel.evidence_level }),
        });
      }
    }
  }

  // ── Infer mechanism → symptom/contraindication edges ────────────────────
  // If ingredient A wirkt_ueber mechanism M AND wird_eingesetzt_fuer symptom S,
  // then infer M → beeinflusst → S (deduplicated, lower confidence)
  const mechToTargets = new Map<string, Set<string>>();

  for (const [, edge] of edgeMap) {
    if (edge.relation !== 'wirkt_ueber') continue;
    const ingredientId = edge.source;
    const mechanismId = edge.target;
    if (!nodeMap.has(mechanismId) || nodeMap.get(mechanismId)?.type !== 'mechanism') continue;

    for (const [, e2] of edgeMap) {
      if (e2.source !== ingredientId) continue;
      if (e2.relation !== 'wird_eingesetzt_fuer' && e2.relation !== 'kontraindiziert_bei') continue;
      if (!nodeMap.has(e2.target)) continue;

      if (!mechToTargets.has(mechanismId)) mechToTargets.set(mechanismId, new Set());
      mechToTargets.get(mechanismId)!.add(e2.target);
    }
  }

  for (const [mech, targets] of mechToTargets) {
    for (const target of targets) {
      const k = edgeKey(mech, target, 'beeinflusst');
      if (!edgeMap.has(k)) {
        edgeMap.set(k, { source: mech, target, relation: 'beeinflusst', confidence: 0.5 });
      }
    }
  }

  const nodes = Array.from(nodeMap.values());
  const edges = Array.from(edgeMap.values());

  return {
    meta: {
      locale,
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      includesStudies: includeStudies,
    },
    nodes,
    edges,
  };
}
