/**
 * Label helpers for the MikroScore knowledge graph.
 *
 * Keep display label logic out of components/pages where possible.
 */

import type { GraphEntity, GraphLocale } from './types.ts';

export function getEntityLabel(entity: GraphEntity | undefined, _locale: GraphLocale = 'de'): string | undefined {
  if (!entity) return undefined;
  if (entity.type === 'study') {
    return typeof entity.title === 'string' ? entity.title : entity.id;
  }
  if (typeof entity.name === 'string' && entity.name.length > 0) return entity.name;
  return entity.id;
}

export function getEntityDescription(entity: GraphEntity | undefined, _locale: GraphLocale = 'de'): string | undefined {
  if (!entity) return undefined;
  if (typeof entity.summary === 'string' && entity.summary.length > 0) return entity.summary;
  if (typeof entity.description === 'string' && entity.description.length > 0) return entity.description;
  return undefined;
}
