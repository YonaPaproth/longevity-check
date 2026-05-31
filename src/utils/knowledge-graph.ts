/**
 * knowledge-graph.ts
 *
 * Runtime access to the Knowledge Graph.
 * Loads entities + relations on-demand for Astro pages.
 *
 * Usage:
 *   const kg = new KnowledgeGraph();
 *   const magnesium = kg.entity('magnesium');
 *   const relations = kg.relationsFor('magnesium');
 *   const byType = kg.relationsByType('wird_eingesetzt_fuer');
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = import.meta.env.ASTRO_ROOT || import.meta.dirname.replace('/src/utils', '');
const DATA_DIR = join(ROOT, 'data');

interface Entity {
  id: string;
  type: string;
  name: string;
  aliases?: string[];
  category?: string;
  evidenceLevel?: number;
  safety?: string;
  efsa_approved?: boolean;
  typical_dose_mg?: number;
  summary?: string;
  description?: string;
}

interface Relation {
  relation: string;
  target: string;
  direction: 'outgoing' | 'incoming';
  confidence?: number;
  evidence_strength?: string;
  source?: string;
  note?: string;
}

interface RelationsByEntity {
  entity: string;
  relations: Relation[];
}

interface RelationsByType {
  type: string;
  count: number;
  relations: Array<{
    subject: string;
    target: string;
    confidence?: number;
    evidence_strength?: string;
    source?: string;
    note?: string;
  }>;
}

interface Index {
  ingredients: string[];
  mechanisms: string[];
  biomarkers: string[];
  symptoms: string[];
  regulatory: string[];
  stats: {
    entities: number;
    relations: number;
    relationTypes: number;
    lastUpdated: string;
  };
}

export class KnowledgeGraph {
  private cache: Map<string, any> = new Map();
  private index: Index | null = null;

  getIndex(): Index {
    if (this.index) return this.index;
    const data = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf-8'));
    this.index = data;
    return data;
  }

  entity(id: string): Entity | null {
    if (this.cache.has(`entity:${id}`)) return this.cache.get(`entity:${id}`);

    // Infer type from index
    const idx = this.getIndex();
    let type = 'unknown';
    for (const [key, ids] of Object.entries(idx)) {
      if (key === 'stats') continue;
      if ((ids as string[]).includes(id)) {
        type = key.slice(0, -1); // Remove trailing 's' for singular
        break;
      }
    }

    try {
      const data = JSON.parse(
        readFileSync(join(DATA_DIR, 'entities', type, `${id}.json`), 'utf-8')
      );
      this.cache.set(`entity:${id}`, data);
      return data;
    } catch {
      return null;
    }
  }

  relationsFor(entityId: string): Relation[] {
    if (this.cache.has(`relations:${entityId}`)) {
      return this.cache.get(`relations:${entityId}`);
    }

    try {
      const data = JSON.parse(
        readFileSync(join(DATA_DIR, 'relations/by-entity', `${entityId}.json`), 'utf-8')
      ) as RelationsByEntity;
      this.cache.set(`relations:${entityId}`, data.relations);
      return data.relations;
    } catch {
      return [];
    }
  }

  relationsByType(type: string): RelationsByType | null {
    if (this.cache.has(`by-type:${type}`)) {
      return this.cache.get(`by-type:${type}`);
    }

    try {
      const data = JSON.parse(
        readFileSync(join(DATA_DIR, 'relations/by-type', `${type}.json`), 'utf-8')
      ) as RelationsByType;
      this.cache.set(`by-type:${type}`, data);
      return data;
    } catch {
      return null;
    }
  }

  // Query helpers

  usesFor(ingredientId: string): Array<{ id: string; name: string }> {
    const rels = this.relationsFor(ingredientId);
    return rels
      .filter(r => r.relation === 'wird_eingesetzt_fuer' && r.direction === 'outgoing')
      .map(r => {
        const entity = this.entity(r.target);
        return { id: r.target, name: entity?.name || r.target };
      });
  }

  mechanisms(ingredientId: string): Array<{ id: string; name: string }> {
    const rels = this.relationsFor(ingredientId);
    return rels
      .filter(r => r.relation === 'wirkt_ueber' && r.direction === 'outgoing')
      .map(r => {
        const entity = this.entity(r.target);
        return { id: r.target, name: entity?.name || r.target };
      });
  }

  biomarkers(ingredientId: string): Array<{ id: string; name: string }> {
    const rels = this.relationsFor(ingredientId);
    return rels
      .filter(r => r.relation === 'benoetigt_biomarker_check' && r.direction === 'outgoing')
      .map(r => {
        const entity = this.entity(r.target);
        return { id: r.target, name: entity?.name || r.target };
      });
  }

  interactions(ingredientId: string): Array<{ id: string; name: string; note?: string }> {
    const rels = this.relationsFor(ingredientId);
    return rels
      .filter(r => r.relation === 'hat_interaktion_mit')
      .map(r => {
        const entity = this.entity(r.target);
        return { id: r.target, name: entity?.name || r.target, note: r.note };
      });
  }

  ingredientsForSymptom(symptomId: string): Array<{ id: string; name: string }> {
    const byType = this.relationsByType('wird_eingesetzt_fuer');
    if (!byType) return [];

    return byType.relations
      .filter(r => r.target === symptomId)
      .map(r => {
        const entity = this.entity(r.subject);
        return { id: r.subject, name: entity?.name || r.subject };
      });
  }

  allIngredients(): Entity[] {
    const idx = this.getIndex();
    return idx.ingredients
      .map(id => this.entity(id))
      .filter(Boolean) as Entity[];
  }

  allSymptoms(): Entity[] {
    const idx = this.getIndex();
    return idx.symptoms
      .map(id => this.entity(id))
      .filter(Boolean) as Entity[];
  }
}

// Singleton
let kg: KnowledgeGraph | null = null;

export function getKG(): KnowledgeGraph {
  if (!kg) kg = new KnowledgeGraph();
  return kg;
}
