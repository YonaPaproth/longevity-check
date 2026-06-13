/**
 * Label helpers for the MikroScore knowledge graph.
 *
 * Keep display label logic out of components/pages where possible.
 */

import type { GraphEntity, GraphLocale } from './types.ts';
import { readFileSync } from 'fs';
import { join } from 'path';

/** Lazy-loaded EN entity name overrides from data/i18n/kg-entities.en.json */
let _enLabels: Record<string, string> | null = null;

function getEnLabels(): Record<string, string> {
  if (_enLabels) return _enLabels;
  try {
    const p = join(import.meta.dirname, '../../../data/i18n/kg-entities.en.json');
    _enLabels = JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    _enLabels = {};
  }
  return _enLabels!;
}

export function getEntityLabel(entity: GraphEntity | undefined, locale: GraphLocale = 'de'): string | undefined {
  if (!entity) return undefined;
  if (entity.type === 'study') {
    return typeof entity.title === 'string' ? entity.title : entity.id;
  }
  // EN locale: check i18n override first
  if (locale === 'en') {
    const enLabel = getEnLabels()[entity.id];
    if (enLabel) return enLabel;
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
