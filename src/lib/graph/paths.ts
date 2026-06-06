/**
 * Route/path resolution for the MikroScore knowledge graph.
 *
 * Returns internal site paths only.
 * Study entities expose externalUrl separately — no internal site path in v1.
 * Returns undefined for entity types that do not yet have public pages.
 */

import type { GraphEntity, GraphLocale } from './types.ts';

/**
 * Returns the internal site path for a graph entity, or undefined when no
 * public page exists for this entity type and locale yet.
 *
 * Routes are based on current Astro page structure:
 *   DE ingredient  → /wirkstoffe/[slug]
 *   DE symptom     → /wirkstoffe/nach-wirkung/[id]
 *   DE claim       → /claims/[id]
 *   EN ingredient  → /en/ingredients/[slug]
 *   EN claim       → /en/claims/[id]
 *
 * No public pages yet for: mechanism, biomarker, regulatory, study
 */
export function getEntityPath(entity: GraphEntity, locale: GraphLocale = 'de'): string | undefined {
  const { id, type } = entity;

  if (locale === 'de') {
    switch (type) {
      case 'ingredient': return `/wirkstoffe/${id}`;
      case 'symptom':    return `/wirkstoffe/nach-wirkung/${id}`;
      case 'claim':      return `/claims/${id}`;
      // No public DE pages yet:
      case 'mechanism':
      case 'biomarker':
      case 'regulatory':
      case 'study':
        return undefined;
    }
  }

  if (locale === 'en') {
    switch (type) {
      case 'ingredient': return `/en/ingredients/${id}`;
      case 'claim':      return `/en/claims/${id}`;
      // No public EN pages yet for these types:
      case 'symptom':
      case 'mechanism':
      case 'biomarker':
      case 'regulatory':
      case 'study':
        return undefined;
    }
  }

  return undefined;
}

/**
 * Returns the external URL for a study entity (PubMed or DOI), if derivable.
 * Prefers PubMed when pmid is available.
 */
export function getStudyExternalUrl(entity: GraphEntity): string | undefined {
  const pmid = (entity as { pmid?: string }).pmid;
  const doi = (entity as { doi?: string }).doi;
  const url = (entity as { url?: string }).url;

  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  if (doi) return `https://doi.org/${doi}`;
  if (url) return url as string;

  // Derive from legacy studie-{PMID} id pattern
  const legacyMatch = entity.id.match(/^studie-(\d+)$/);
  if (legacyMatch) return `https://pubmed.ncbi.nlm.nih.gov/${legacyMatch[1]}/`;

  // Derive from pmid-{PMID} id pattern
  const pmidMatch = entity.id.match(/^pmid-(\d+)$/);
  if (pmidMatch) return `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`;

  return undefined;
}
