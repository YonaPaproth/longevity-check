/**
 * Client-side knowledge graph viewer using Cytoscape.js.
 * Reads locale from the `data-locale` attribute of `#ks-cy-container`.
 * Fetches graph data from /data/graph.json (DE) or /data/graph.en.json (EN).
 *
 * Layout modes:
 *   map        – COSE organic layout
 *   structured – Preset positions with Y lanes by node type and X buckets by
 *                regulatory/evidence status inferred from edges.
 */

import cytoscape from 'cytoscape';
import type { CollectionReturnValue, Core, EdgeSingular, NodeSingular } from 'cytoscape';

const ENTITY_COLORS: Record<string, string> = {
  ingredient:       '#0d9488',
  mechanism:        '#3b82f6',
  biomarker:        '#8b5cf6',
  symptom:          '#94a3b8',
  contraindication: '#1e293b',
  regulatory:       '#f59e0b',
  claim:            '#ef4444',
  study:            '#6366f1',
  'study-cluster':  '#6366f1',
};

const TYPE_LABELS: Record<string, Record<string, string>> = {
  de: {
    ingredient: 'Wirkstoff',
    mechanism: 'Mechanismus',
    biomarker: 'Biomarker',
    symptom: 'Symptom',
    contraindication: 'Kontraindikation',
    regulatory: 'Regulatorik',
    claim: 'Claim',
    study: 'Studie',
    'study-cluster': 'Studien',
    all: 'Alle',
  },
  en: {
    ingredient: 'Ingredient',
    mechanism: 'Mechanism',
    biomarker: 'Biomarker',
    symptom: 'Symptom',
    contraindication: 'Contraindication',
    regulatory: 'Regulatory',
    claim: 'Claim',
    study: 'Study',
    'study-cluster': 'Studies',
    all: 'All',
  },
};

const STRUCTURED_LANES: Array<{ type: string; yFrac: number }> = [
  { type: 'regulatory', yFrac: 0.06 },
  { type: 'ingredient', yFrac: 0.22 },
  { type: 'mechanism', yFrac: 0.40 },
  { type: 'symptom', yFrac: 0.54 },
  { type: 'contraindication', yFrac: 0.68 },
  { type: 'study', yFrac: 0.88 },
];

const LANE_ROWS: Record<string, { rows: number; span: number }> = {
  ingredient: { rows: 5, span: 0.20 },
  mechanism: { rows: 2, span: 0.08 },
  symptom: { rows: 2, span: 0.08 },
  contraindication: { rows: 2, span: 0.08 },
  study: { rows: 5, span: 0.18 },
};

const BUCKET_X_RANGE: [[number, number], [number, number], [number, number]] = [
  [0.04, 0.36],
  [0.40, 0.60],
  [0.64, 0.96],
];

type GraphNode = {
  id: string;
  type: string;
  label: string;
  path?: string;
  evidenceLevel?: number;
  efsaApproved?: boolean;
  claimHumanEvidence?: string;
  regulatoryEfsa?: string;
  degree?: number;
  parentIngredient?: string;
  studyIds?: string[];
  studyCount?: number;
  clusterId?: string;
};

type GraphEdge = {
  source: string;
  target: string;
  relation: string;
  confidence: number;
};

let searchQuery = '';
let activeTypes = new Set<string>();
let activeEvidenceLevel = '';  // '' = all, 'meta_analysis', 'human_rct', 'human_observational', 'expert_review'
let layoutMode: 'map' | 'structured' = 'structured';
let cy: Core | null = null;
let selectedNodeId: string | null = null;

const expandedClusters = new Set<string>();
const clusterStudyIds = new Map<string, string[]>();
const studyToClusterId = new Map<string, string>();

const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ANIMATION_MS = prefersReducedMotion ? 0 : 300;

let cachedNodes: GraphNode[] = [];
let cachedEdges: GraphEdge[] = [];

function isMobileViewport() {
  return window.innerWidth < 1024;
}

function fitElements(target = cy?.elements(), options?: { ingredientOnly?: boolean }) {
  if (!cy || !target || target.length === 0) return;
  cy.resize();

  if (options?.ingredientOnly) {
    // Ingredient-first view: fit to full container so lane position is preserved
    // Use generous padding and don't zoom in too aggressively
    cy.fit(target, 120);
    const maxZoom = 0.8; // Don't zoom in too much on ~119 nodes
    if (cy.zoom() > maxZoom) {
      cy.zoom(maxZoom);
      cy.center(target);
    }
    const minZoom = 0.3;
    if (cy.zoom() < minZoom) {
      cy.zoom(minZoom);
      cy.center(target);
    }
    return;
  }

  cy.fit(target, 64);
  const minUsefulZoom = 0.42;
  if (cy.zoom() < minUsefulZoom) {
    cy.zoom(minUsefulZoom);
    cy.center(target);
  }
}

function getLocalizedStrings(locale: string) {
  return {
    closePanel: locale === 'en' ? 'Close panel' : 'Panel schließen',
    openDossier: locale === 'en' ? 'Open dossier →' : 'Dossier öffnen →',
    backToOverview: locale === 'en' ? 'Back to overview' : 'Zurück zur Übersicht',
    noPage: locale === 'en' ? 'No dedicated page available yet.' : 'Keine eigene Seite vorhanden.',
    type: locale === 'en' ? 'Type' : 'Typ',
    connections: (count: number) => locale === 'en'
      ? `${count} connections`
      : `${count} Verbindungen`,
    related: locale === 'en' ? 'Related nodes' : 'Verwandte Knoten',
  };
}

function getNodePath(node: NodeSingular) {
  const data = node.data();
  let nodePath = data.path as string | undefined;
  if ((String(data.type) === 'symptom' || String(data.type) === 'contraindication') && !nodePath) {
    const catSlug = String(data.id);
    const loc = document.getElementById('ks-cy-container')?.dataset.locale ?? 'de';
    nodePath = loc === 'en'
      ? `/en/ingredients/category/${catSlug}`
      : `/wirkstoffe/kategorie/${catSlug}`;
  }

  const canOpenDossier = Boolean(nodePath)
    && ['ingredient', 'symptom', 'contraindication'].includes(String(data.type));

  return { nodePath, canOpenDossier };
}

function showNodeDetail(node: NodeSingular, locale: string) {
  if (isMobileViewport()) return;

  const panel = document.getElementById('ks-node-detail');
  if (!panel) return;

  const labels = TYPE_LABELS[locale] ?? TYPE_LABELS.de;
  const data = node.data();
  const typeLabel = labels[String(data.type)] ?? String(data.type);
  const color = ENTITY_COLORS[String(data.type)] ?? '#94a3b8';
  const strings = getLocalizedStrings(locale);

  const nameEl = panel.querySelector<HTMLElement>('[data-ks="name"]');
  const typeEl = panel.querySelector<HTMLElement>('[data-ks="type"]');
  const linkEl = panel.querySelector<HTMLAnchorElement>('[data-ks="link"]');
  const noLinkEl = panel.querySelector<HTMLElement>('[data-ks="no-link"]');
  const badgeEl = panel.querySelector<HTMLElement>('[data-ks="badge"]');
  const connEl = panel.querySelector<HTMLElement>('[data-ks="connections"]');
  const typeLabelEl = panel.querySelector<HTMLElement>('[data-ks="type-label"]');

  if (nameEl) nameEl.textContent = String(data.label ?? data.id);
  if (typeEl) typeEl.textContent = typeLabel;
  if (typeLabelEl) typeLabelEl.textContent = strings.type;
  if (connEl) connEl.textContent = strings.connections(node.connectedEdges().not('.ks-hidden').length);
  if (badgeEl) {
    badgeEl.textContent = typeLabel;
    badgeEl.style.backgroundColor = color;
  }

  const { nodePath, canOpenDossier } = getNodePath(node);
  if (linkEl) linkEl.textContent = strings.openDossier;
  if (canOpenDossier) {
    if (linkEl && nodePath) {
      linkEl.href = nodePath;
      linkEl.classList.remove('hidden');
    }
    if (noLinkEl) noLinkEl.classList.add('hidden');
  } else {
    if (linkEl) linkEl.classList.add('hidden');
    if (noLinkEl) {
      noLinkEl.textContent = strings.noPage;
      noLinkEl.classList.remove('hidden');
    }
  }

  panel.classList.remove('hidden');
}

function hideNodeDetail() {
  document.getElementById('ks-node-detail')?.classList.add('hidden');
}

function groupRelatedNodesByType(node: NodeSingular) {
  const grouped = new Map<string, string[]>();
  const related = node.neighborhood().nodes().filter(n => {
    const type = String(n.data('type'));
    return type !== 'study' && type !== 'study-cluster';
  });

  related.forEach(n => {
    const type = String(n.data('type'));
    if (!grouped.has(type)) grouped.set(type, []);
    const bucket = grouped.get(type)!;
    if (bucket.length < 5) bucket.push(String(n.data('label') ?? n.id()));
  });

  return grouped;
}

function openBottomSheet(node: NodeSingular, locale: string) {
  if (!isMobileViewport()) return;

  const sheet = document.getElementById('ks-bottom-sheet');
  const backdrop = document.getElementById('ks-sheet-backdrop');
  if (!sheet || !backdrop) return;

  const labels = TYPE_LABELS[locale] ?? TYPE_LABELS.de;
  const data = node.data();
  const typeLabel = labels[String(data.type)] ?? String(data.type);
  const color = ENTITY_COLORS[String(data.type)] ?? '#94a3b8';
  const strings = getLocalizedStrings(locale);

  const badgeEl = sheet.querySelector<HTMLElement>('[data-ks="sheet-badge"]');
  const nameEl = sheet.querySelector<HTMLElement>('[data-ks="sheet-name"]');
  const typeEl = sheet.querySelector<HTMLElement>('[data-ks="sheet-type"]');
  const connEl = sheet.querySelector<HTMLElement>('[data-ks="sheet-connections"]');
  const relatedEl = sheet.querySelector<HTMLElement>('[data-ks="sheet-related"]');
  const linkEl = sheet.querySelector<HTMLAnchorElement>('[data-ks="sheet-link"]');

  if (badgeEl) {
    badgeEl.textContent = typeLabel;
    badgeEl.style.backgroundColor = color;
  }
  if (nameEl) nameEl.textContent = String(data.label ?? data.id);
  if (typeEl) typeEl.textContent = typeLabel;
  if (connEl) connEl.textContent = strings.connections(node.connectedEdges().not('.ks-hidden').length);

  if (relatedEl) {
    const grouped = groupRelatedNodesByType(node);
    relatedEl.innerHTML = '';
    if (grouped.size > 0) {
      const title = document.createElement('p');
      title.className = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2';
      title.textContent = strings.related;
      relatedEl.appendChild(title);

      for (const [type, names] of grouped) {
        const wrap = document.createElement('div');
        wrap.className = 'mb-3';

        const heading = document.createElement('p');
        heading.className = 'text-[11px] font-medium text-slate-500 mb-1';
        heading.textContent = labels[type] ?? type;
        wrap.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'flex flex-wrap gap-1.5';
        names.forEach(name => {
          const chip = document.createElement('span');
          chip.className = 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600';
          chip.textContent = name;
          list.appendChild(chip);
        });
        wrap.appendChild(list);
        relatedEl.appendChild(wrap);
      }
    }
  }

  const { nodePath, canOpenDossier } = getNodePath(node);
  if (linkEl) {
    linkEl.textContent = strings.openDossier;
    if (canOpenDossier && nodePath) {
      linkEl.href = nodePath;
      linkEl.classList.remove('hidden');
    } else {
      linkEl.classList.add('hidden');
    }
  }

  sheet.classList.remove('translate-y-full');
  backdrop.classList.remove('hidden');
}

function closeBottomSheet() {
  const sheet = document.getElementById('ks-bottom-sheet');
  const backdrop = document.getElementById('ks-sheet-backdrop');
  if (!sheet || !backdrop) return;
  sheet.classList.add('translate-y-full');
  backdrop.classList.add('hidden');
}

function updateResetButton(locale: string) {
  const btn = document.getElementById('ks-reset-selection') as HTMLButtonElement | null;
  if (!btn) return;
  btn.textContent = getLocalizedStrings(locale).backToOverview;
  btn.classList.toggle('hidden', !selectedNodeId);
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  return h;
}

function assignXBuckets(
  nodes: Array<{
    id: string;
    type: string;
    evidenceLevel?: number;
    efsaApproved?: boolean;
    claimHumanEvidence?: string;
    regulatoryEfsa?: string;
  }>,
  edges: Array<{ source: string; target: string; relation: string }>,
): Map<string, number> {
  const buckets = new Map<string, number>();

  for (const node of nodes) {
    if (node.type !== 'regulatory') continue;
    const id = node.id.toLowerCase();
    if (id.includes('nicht') || id.includes('-not-') || id.includes('reject') || id.includes('ablehnt')) {
      buckets.set(node.id, 2);
    } else if (id.includes('zugelas') || id.includes('zulassung') || id.includes('approved') || id.includes('authoris')) {
      buckets.set(node.id, 0);
    } else {
      buckets.set(node.id, 1);
    }
  }

  const regEdges = edges.filter(e => e.relation === 'hat_regulatorischen_status');

  for (const node of nodes) {
    if (node.type !== 'ingredient') continue;
    const hasEfsa = node.efsaApproved !== undefined;
    const hasEvidence = node.evidenceLevel !== undefined;

    if (hasEfsa && node.efsaApproved === true) {
      buckets.set(node.id, 0);
    } else if (hasEfsa && node.efsaApproved === false && hasEvidence) {
      buckets.set(node.id, node.evidenceLevel! <= 2 ? 1 : 2);
    } else if (!hasEfsa && hasEvidence) {
      buckets.set(node.id, node.evidenceLevel! <= 2 ? 0 : 2);
    } else {
      const connBuckets = regEdges
        .filter(e => e.source === node.id)
        .map(e => buckets.get(e.target))
        .filter((b): b is number => b !== undefined);
      if (connBuckets.length === 0) {
        buckets.set(node.id, 1);
      } else {
        const avg = connBuckets.reduce((a, b) => a + b, 0) / connBuckets.length;
        buckets.set(node.id, avg < 0.7 ? 0 : avg > 1.3 ? 2 : 1);
      }
    }
  }

  for (const node of nodes) {
    if (node.type !== 'claim') continue;
    const regEfsa = node.regulatoryEfsa?.toLowerCase() ?? '';
    const humanEv = node.claimHumanEvidence ?? '';

    if (regEfsa.includes('nicht') || regEfsa.includes('not')) {
      buckets.set(node.id, 2);
    } else if (regEfsa.includes('zugelas') || regEfsa.includes('approved')) {
      buckets.set(node.id, 0);
    } else if (humanEv === 'stark') {
      buckets.set(node.id, 0);
    } else if (humanEv === 'moderat') {
      buckets.set(node.id, 1);
    } else if (humanEv === 'begrenzt' || humanEv === 'negativ' || humanEv === 'keine-daten') {
      buckets.set(node.id, 2);
    } else {
      const connBuckets = regEdges
        .filter(e => e.source === node.id)
        .map(e => buckets.get(e.target))
        .filter((b): b is number => b !== undefined);
      if (connBuckets.length === 0) {
        buckets.set(node.id, 1);
      } else {
        const avg = connBuckets.reduce((a, b) => a + b, 0) / connBuckets.length;
        buckets.set(node.id, avg < 0.7 ? 0 : avg > 1.3 ? 2 : 1);
      }
    }
  }

  for (const node of nodes) {
    if (!['mechanism', 'biomarker', 'symptom', 'contraindication', 'study-cluster'].includes(node.type)) continue;
    const neighborBuckets = edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => buckets.get(e.source === node.id ? e.target : e.source))
      .filter((b): b is number => b !== undefined);

    if (neighborBuckets.length === 0) {
      buckets.set(node.id, 1);
    } else {
      const avg = neighborBuckets.reduce((a, b) => a + b, 0) / neighborBuckets.length;
      buckets.set(node.id, avg < 0.7 ? 0 : avg > 1.3 ? 2 : 1);
    }
  }

  return buckets;
}

function computeStructuredPositions(
  nodes: GraphNode[],
  edges: Array<{ source: string; target: string; relation: string }>,
  containerWidth: number,
  containerHeight: number,
): Map<string, { x: number; y: number }> {
  const buckets = assignXBuckets(nodes, edges);
  const laneYByType = new Map(STRUCTURED_LANES.map(l => [l.type, l.yFrac]));
  const groups = new Map<string, string[]>();
  const symptomIds: string[] = [];
  const contraIds: string[] = [];
  const studyIds: string[] = [];
  const clusterNodes: GraphNode[] = [];

  for (const node of nodes) {
    const bucket = buckets.get(node.id) ?? 1;
    const layoutType = node.type === 'study-cluster'
      ? 'study'
      : (node.type === 'symptom' && (node.id.startsWith('kontra-') || node.id.startsWith('nw-')))
        ? 'contraindication'
        : node.type;

    if (node.type === 'study-cluster') {
      clusterNodes.push(node);
      continue;
    }

    if (layoutType === 'symptom') {
      symptomIds.push(node.id);
      continue;
    }
    if (layoutType === 'contraindication') {
      contraIds.push(node.id);
      continue;
    }
    if (layoutType === 'study') {
      studyIds.push(node.id);
      continue;
    }

    const key = `${layoutType}::${bucket}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node.id);
  }

  const positions = new Map<string, { x: number; y: number }>();

  function distributeEvenly(nodeIds: string[], laneType: string) {
    const yFrac = laneYByType.get(laneType) ?? 0.5;
    const laneConfig = LANE_ROWS[laneType];
    const numRows = laneConfig?.rows ?? 1;
    const spanFrac = laneConfig?.span ?? 0;
    const xPad = 0.04;

    nodeIds.sort();
    for (let i = 0; i < nodeIds.length; i++) {
      const row = i % numRows;
      const colInRow = Math.floor(i / numRows);
      const totalInRow = Math.ceil(nodeIds.length / numRows);
      const xFrac = totalInRow === 1 ? 0.5 : xPad + (1 - 2 * xPad) * (colInRow / Math.max(totalInRow - 1, 1));
      const rowOffset = numRows <= 1 ? 0 : (row / (numRows - 1) - 0.5) * spanFrac;
      const yJitter = (simpleHash(nodeIds[i]) % 9) - 4;

      positions.set(nodeIds[i], {
        x: xFrac * containerWidth,
        y: (yFrac + rowOffset) * containerHeight + yJitter,
      });
    }
  }

  distributeEvenly(symptomIds, 'symptom');
  distributeEvenly(contraIds, 'contraindication');
  distributeEvenly(studyIds, 'study');

  for (const [key, ids] of groups) {
    const [typeStr, bucketStr] = key.split('::');
    const bucket = Math.min(2, Math.max(0, parseInt(bucketStr, 10))) as 0 | 1 | 2;
    const [xMin, xMax] = BUCKET_X_RANGE[bucket];
    const yFrac = laneYByType.get(typeStr) ?? 0.5;
    const laneConfig = LANE_ROWS[typeStr];
    const numRows = laneConfig?.rows ?? 1;
    const spanFrac = laneConfig?.span ?? 0;

    ids.sort();
    for (let i = 0; i < ids.length; i++) {
      const row = i % numRows;
      const colInRow = Math.floor(i / numRows);
      const totalInRow = Math.ceil(ids.length / numRows);
      const xFrac = totalInRow === 1 ? (xMin + xMax) / 2 : xMin + (xMax - xMin) * (colInRow / Math.max(totalInRow - 1, 1));
      const rowOffset = numRows <= 1 ? 0 : (row / (numRows - 1) - 0.5) * spanFrac;
      const yJitter = (simpleHash(ids[i]) % 9) - 4;

      positions.set(ids[i], {
        x: xFrac * containerWidth,
        y: (yFrac + rowOffset) * containerHeight + yJitter,
      });
    }
  }

  const studyY = (laneYByType.get('study') ?? 0.88) * containerHeight;
  for (const cluster of clusterNodes) {
    const ingredientPos = cluster.parentIngredient ? positions.get(cluster.parentIngredient) : undefined;
    positions.set(cluster.id, {
      x: ingredientPos?.x ?? containerWidth / 2,
      y: studyY + ((simpleHash(cluster.id) % 7) - 3),
    });
  }

  return positions;
}

function buildLaneOverlay(container: HTMLElement, locale: string, labels: Record<string, string>) {
  const old = container.querySelector('#ks-lane-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ks-lane-overlay';
  overlay.className = 'absolute inset-0 pointer-events-none hidden z-10';

  const boundaries = STRUCTURED_LANES.map((lane, index) => {
    const prev = STRUCTURED_LANES[index - 1]?.yFrac ?? 0;
    const next = STRUCTURED_LANES[index + 1]?.yFrac ?? 1;
    return {
      type: lane.type,
      top: index === 0 ? 0 : ((prev + lane.yFrac) / 2),
      bottom: index === STRUCTURED_LANES.length - 1 ? 1 : ((lane.yFrac + next) / 2),
      center: lane.yFrac,
    };
  });

  boundaries.forEach(boundary => {
    const bg = document.createElement('div');
    bg.className = 'absolute inset-x-0';
    bg.style.top = `${boundary.top * 100}%`;
    bg.style.height = `${(boundary.bottom - boundary.top) * 100}%`;
    bg.style.background = `${ENTITY_COLORS[boundary.type] ?? '#94a3b8'}08`;
    overlay.appendChild(bg);

    const label = document.createElement('div');
    label.className = 'absolute left-2 text-[10px] font-semibold tracking-wide uppercase opacity-60 -translate-y-1/2 whitespace-nowrap';
    label.style.top = `${boundary.center * 100}%`;
    label.style.color = ENTITY_COLORS[boundary.type] ?? '#94a3b8';
    label.textContent = labels[boundary.type] ?? boundary.type;
    overlay.appendChild(label);
  });

  for (let i = 0; i < STRUCTURED_LANES.length - 1; i++) {
    const lineY = ((STRUCTURED_LANES[i].yFrac + STRUCTURED_LANES[i + 1].yFrac) / 2) * 100;
    const line = document.createElement('div');
    line.className = 'absolute inset-x-0 h-px bg-slate-300 opacity-20';
    line.style.top = `${lineY}%`;
    overlay.appendChild(line);
  }

  const xHeader = document.createElement('div');
  xHeader.className = 'absolute top-1 left-16 right-2 flex justify-between text-[9px] font-medium tracking-wide uppercase opacity-50 text-slate-500';
  xHeader.innerHTML = locale === 'en'
    ? '<span>EFSA approved</span><span>Mixed / unknown</span><span>EFSA not approved</span>'
    : '<span>EFSA zugelassen</span><span>Gemischt</span><span>EFSA abgelehnt</span>';
  overlay.appendChild(xHeader);

  container.appendChild(overlay);
  return overlay;
}

function collapseCluster(clusterId: string) {
  if (!cy || !expandedClusters.has(clusterId)) return;

  const studyIds = clusterStudyIds.get(clusterId) ?? [];
  expandedClusters.delete(clusterId);

  studyIds.forEach(studyId => {
    const studyNode = cy!.getElementById(studyId);
    studyNode.addClass('ks-hidden').removeClass('ks-expanded-study');
    studyNode.connectedEdges().forEach(edge => {
      const other = edge.source().id() === studyId ? edge.target() : edge.source();
      if (other.id() !== clusterId) edge.addClass('ks-hidden');
    });
  });
}

function collapseAllClusters() {
  Array.from(expandedClusters).forEach(collapseCluster);
}

function expandCluster(clusterNode: NodeSingular) {
  if (!cy) return;
  const clusterId = clusterNode.id();
  const studyIds = clusterStudyIds.get(clusterId) ?? [];
  if (studyIds.length === 0) return;

  expandedClusters.add(clusterId);
  const center = clusterNode.position();
  const radius = isMobileViewport() ? 86 : 96;

  studyIds.forEach((studyId, index) => {
    const studyNode = cy!.getElementById(studyId);
    if (!studyNode.nonempty()) return;
    const angle = (Math.PI * 2 * index) / Math.max(studyIds.length, 1);
    const targetPos = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };

    studyNode.removeClass('ks-hidden').addClass('ks-expanded-study');
    if (ANIMATION_MS > 0) {
      studyNode.animate({ position: targetPos }, { duration: ANIMATION_MS, easing: 'ease-out-cubic' });
    } else {
      studyNode.position(targetPos);
    }

    studyNode.connectedEdges().forEach(edge => edge.removeClass('ks-hidden'));
  });
}

function toggleCluster(clusterNode: NodeSingular) {
  const clusterId = clusterNode.id();
  if (expandedClusters.has(clusterId)) {
    collapseCluster(clusterId);
  } else {
    expandCluster(clusterNode);
  }
}

function updateStudyVisibility() {
  if (!cy) return;
  const studyFilterActive = activeTypes.has('study');

  cy.nodes().forEach(node => {
    const type = String(node.data('type'));
    if (type === 'study-cluster') {
      const visible = studyFilterActive || expandedClusters.has(node.id());
      node.toggleClass('ks-hidden', !visible);
    }
    if (type === 'study') {
      const clusterId = studyToClusterId.get(node.id());
      const visible = Boolean(clusterId && expandedClusters.has(clusterId));
      node.toggleClass('ks-hidden', !visible);
    }
  });

  cy.edges().forEach(edge => {
    const sType = String(edge.source().data('type'));
    const tType = String(edge.target().data('type'));

    if (sType === 'study-cluster' || tType === 'study-cluster') {
      const visible = studyFilterActive && !edge.source().hasClass('ks-hidden') && !edge.target().hasClass('ks-hidden');
      edge.toggleClass('ks-hidden', !visible);
      return;
    }

    if (sType === 'study' || tType === 'study') {
      const visible = !edge.source().hasClass('ks-hidden') && !edge.target().hasClass('ks-hidden');
      edge.toggleClass('ks-hidden', !visible);
    }
  });
}

function applyFilters() {
  if (!cy) return;

  clearSelection(false);
  const hasSearch = searchQuery.length > 0;
  const hasTypeFilter = activeTypes.size > 0;
  const studyFilterActive = activeTypes.has('study');

  collapseAllClusters();
  updateStudyVisibility();

  if (!hasSearch && !hasTypeFilter) {
    // Ingredient-first view: only show ingredient nodes by default
    cy.nodes().forEach(n => {
      const type = String(n.data('type'));
      if (type === 'ingredient') {
        n.removeClass('ks-hidden ks-faded ks-highlighted');
      } else {
        n.addClass('ks-hidden').removeClass('ks-faded ks-highlighted');
      }
    });

    // Hide ALL edges in ingredient-only view
    cy.edges().forEach(e => {
      e.addClass('ks-hidden').removeClass('ks-faded ks-active');
    });

    fitElements(cy.elements().filter(ele => !ele.hasClass('ks-hidden')), { ingredientOnly: true });
    return;
  }

  const directMatches = cy.nodes().filter(n => {
    const type = String(n.data('type'));
    if (type === 'study') return false;

    const effectiveType = type === 'study-cluster' ? 'study' : type;
    const matchesSearch = !hasSearch || String(n.data('label')).toLowerCase().includes(searchQuery);
    const matchesType = !hasTypeFilter || activeTypes.has(effectiveType);

    if (type === 'study-cluster' && !studyFilterActive) return false;
    return matchesSearch && matchesType;
  });

  let visibleNodes: CollectionReturnValue = directMatches;
  if (hasSearch && directMatches.length > 0) {
    visibleNodes = directMatches.union(directMatches.neighborhood().nodes().filter(n => String(n.data('type')) !== 'study'));
  }

  cy.nodes().forEach(n => {
    const type = String(n.data('type'));
    if (type === 'study') {
      n.addClass('ks-hidden').removeClass('ks-highlighted ks-faded');
      return;
    }
    if (directMatches.has(n)) {
      n.removeClass('ks-hidden ks-faded').addClass('ks-highlighted');
      return;
    }
    if (visibleNodes.has(n)) {
      if (type === 'study-cluster' && !studyFilterActive) {
        n.addClass('ks-hidden').removeClass('ks-highlighted ks-faded');
      } else {
        n.removeClass('ks-hidden ks-highlighted').addClass('ks-faded');
      }
      return;
    }
    n.removeClass('ks-highlighted ks-faded').addClass('ks-hidden');
  });

  cy.edges().forEach(e => {
    const sType = String(e.source().data('type'));
    const tType = String(e.target().data('type'));
    const srcVisible = !e.source().hasClass('ks-hidden');
    const tgtVisible = !e.target().hasClass('ks-hidden');

    if (sType === 'study' || tType === 'study') {
      e.addClass('ks-hidden').removeClass('ks-faded ks-active');
      return;
    }
    if ((sType === 'study-cluster' || tType === 'study-cluster') && !studyFilterActive) {
      e.addClass('ks-hidden').removeClass('ks-faded ks-active');
      return;
    }

    if (srcVisible && tgtVisible) {
      e.removeClass('ks-hidden ks-active');
      if (directMatches.has(e.source()) || directMatches.has(e.target())) {
        e.removeClass('ks-faded');
      } else {
        e.addClass('ks-faded');
      }
    } else {
      e.removeClass('ks-active').removeClass('ks-faded').addClass('ks-hidden');
    }
  });

  // Evidence level filter: hide edges that don't match
  if (activeEvidenceLevel) {
    cy.edges().forEach(e => {
      if (e.hasClass('ks-hidden')) return;
      const evLevel = String(e.data('evidenceLevel') ?? '');
      if (evLevel !== activeEvidenceLevel) {
        e.addClass('ks-faded').removeClass('ks-active');
      }
    });
  }

  const visibleElements = cy.elements().filter(ele => !ele.hasClass('ks-hidden'));
  fitElements(visibleElements);
}

function selectNode(node: NodeSingular, locale: string) {
  if (!cy) return;
  selectedNodeId = node.id();

  // Un-hide the selected node and its direct neighborhood
  const hood = node.closedNeighborhood();
  hood.nodes().removeClass('ks-hidden');
  hood.edges().removeClass('ks-hidden');

  // Also un-hide study neighbors (studies linked to this ingredient)
  const studies = hood.nodes().filter(n => String(n.data('type')) === 'study');
  studies.removeClass('ks-hidden');
  studies.connectedEdges().removeClass('ks-hidden');

  // Fade all other visible nodes
  cy.nodes().forEach(n => {
    if (n.hasClass('ks-hidden')) return;
    if (n.id() === node.id()) {
      n.removeClass('ks-faded ks-neighbor ks-highlighted').addClass('ks-selected');
    } else if (hood.nodes().has(n)) {
      n.removeClass('ks-faded ks-selected ks-highlighted').addClass('ks-neighbor');
    } else {
      n.removeClass('ks-selected ks-neighbor ks-highlighted').addClass('ks-faded');
    }
  });

  // Highlight connected edges, fade others
  cy.edges().forEach(e => {
    if (e.hasClass('ks-hidden')) return;
    if (hood.edges().has(e)) {
      e.removeClass('ks-faded').addClass('ks-active');
    } else {
      e.removeClass('ks-active').addClass('ks-faded');
    }
  });

  updateResetButton(locale);
}

function clearSelection(reapplyFilters = true) {
  if (!cy) return;
  selectedNodeId = null;
  cy.nodes().removeClass('ks-selected ks-neighbor ks-faded');
  cy.edges().removeClass('ks-active ks-faded');
  hideNodeDetail();
  closeBottomSheet();
  const locale = document.getElementById('ks-cy-container')?.dataset.locale ?? 'de';
  updateResetButton(locale);
  if (reapplyFilters) applyFilters();
}

function applyStructuredLayout() {
  if (!cy) return;
  const container = document.getElementById('ks-cy-container');
  if (!container) return;

  const w = container.offsetWidth || 800;
  const h = container.offsetHeight || 600;
  const positions = computeStructuredPositions(cachedNodes, cachedEdges, w, h);

  cy.layout({
    name: 'preset',
    positions: node => positions.get(node.id()) ?? { x: w / 2, y: h / 2 },
    fit: true,
    padding: 40,
    animate: !prefersReducedMotion,
    animationDuration: ANIMATION_MS,
  } as Parameters<Core['layout']>[0]).run();

  container.querySelector<HTMLElement>('#ks-lane-overlay')?.classList.remove('hidden');
}

function applyMapLayout() {
  if (!cy) return;
  const container = document.getElementById('ks-cy-container');
  container?.querySelector<HTMLElement>('#ks-lane-overlay')?.classList.add('hidden');

  cy.layout({
    name: 'cose',
    animate: false,
    fit: true,
    padding: 64,
    randomize: true,
    nodeRepulsion: () => 180000,
    idealEdgeLength: () => 90,
    edgeElasticity: () => 80,
    nodeOverlap: 8,
    gravity: 1,
    numIter: 900,
    componentSpacing: 120,
  } as Parameters<Core['layout']>[0]).run();
}

function setLayoutMode(mode: 'map' | 'structured', locale: string) {
  layoutMode = mode;
  const mapBtn = document.getElementById('ks-mode-map');
  const structuredBtn = document.getElementById('ks-mode-structured');

  const activeClass = 'h-11 px-3 text-xs font-medium border-y border-l rounded-l-lg transition-colors bg-teal-600 text-white border-teal-600';
  const activeRightClass = 'h-11 px-3 text-xs font-medium border rounded-r-lg transition-colors bg-teal-600 text-white border-teal-600';
  const inactiveLeftClass = 'h-11 px-3 text-xs font-medium border-y border-l rounded-l-lg transition-colors bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
  const inactiveRightClass = 'h-11 px-3 text-xs font-medium border rounded-r-lg transition-colors bg-white text-slate-600 border-slate-300 hover:bg-slate-50';

  if (mapBtn && structuredBtn) {
    mapBtn.className = mode === 'map' ? activeClass : inactiveLeftClass;
    structuredBtn.className = mode === 'structured' ? activeRightClass : inactiveRightClass;
  }

  if (mode === 'structured') applyStructuredLayout();
  else applyMapLayout();

  updateResetButton(locale);
}

function makeFilterChip(label: string, type: string, active: boolean, color?: string) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.type = type;
  btn.dataset.active = active ? 'true' : 'false';
  btn.setAttribute('aria-expanded', active ? 'true' : 'false');
  btn.textContent = label;
  if (color) btn.style.setProperty('--chip-color', color);
  syncChipStyle(btn);
  return btn;
}

function syncChipStyle(btn: HTMLButtonElement) {
  const active = btn.dataset.active === 'true';
  const color = btn.style.getPropertyValue('--chip-color');

  btn.setAttribute('aria-expanded', active ? 'true' : 'false');
  btn.className = [
    'flex-shrink-0 min-h-11 px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap',
    active
      ? color
        ? 'text-white border-transparent'
        : 'bg-teal-600 text-white border-teal-600'
      : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-700',
  ].join(' ');

  if (active && color) {
    btn.style.backgroundColor = color;
    btn.style.borderColor = color;
  } else if (!active) {
    btn.style.backgroundColor = '';
    btn.style.borderColor = '';
  }
}

async function initGraph() {
  const container = document.getElementById('ks-cy-container');
  if (!container) return;

  const locale = container.dataset.locale ?? 'de';
  const endpoint = locale === 'en' ? '/data/graph.en.json' : '/data/graph.json';
  const labels = TYPE_LABELS[locale] ?? TYPE_LABELS.de;
  const loadingEl = document.getElementById('ks-loading');
  const errorEl = document.getElementById('ks-error');
  const strings = getLocalizedStrings(locale);

  let graphData: { nodes: GraphNode[]; edges: GraphEdge[] };
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    graphData = await res.json();
  } catch {
    loadingEl?.classList.add('hidden');
    errorEl?.classList.remove('hidden');
    return;
  }

  loadingEl?.classList.add('hidden');

  if (!graphData.nodes?.length) {
    if (errorEl) {
      errorEl.textContent = locale === 'en' ? 'No graph data available yet.' : 'Noch keine Graphdaten vorhanden.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const permanentlyHidden = new Set(graphData.nodes.filter(n => n.type === 'claim' || n.type === 'biomarker').map(n => n.id));
  graphData.nodes = graphData.nodes.filter(n => n.type !== 'claim' && n.type !== 'biomarker');
  graphData.edges = graphData.edges.filter(e => !permanentlyHidden.has(e.source) && !permanentlyHidden.has(e.target));

  for (const n of graphData.nodes) {
    if (n.type === 'symptom' && n.id.startsWith('kontra-')) n.type = 'contraindication';
  }

  const degreeMap = new Map<string, number>();
  for (const edge of graphData.edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
  }

  const studyNodeIds = new Set(graphData.nodes.filter(n => n.type === 'study').map(n => n.id));
  const studyByIngredient = new Map<string, string[]>();

  for (const edge of graphData.edges) {
    const sourceIsStudy = studyNodeIds.has(edge.source);
    const targetIsStudy = studyNodeIds.has(edge.target);
    if (!sourceIsStudy && !targetIsStudy) continue;

    const studyId = sourceIsStudy ? edge.source : edge.target;
    const ingredientId = sourceIsStudy ? edge.target : edge.source;
    const ingredientNode = graphData.nodes.find(n => n.id === ingredientId);
    if (!ingredientNode || ingredientNode.type !== 'ingredient') continue;

    if (!studyByIngredient.has(ingredientId)) studyByIngredient.set(ingredientId, []);
    const list = studyByIngredient.get(ingredientId)!;
    if (!list.includes(studyId)) list.push(studyId);
  }

  const clusterNodes: GraphNode[] = [];
  const clusterEdges: GraphEdge[] = [];

  for (const [ingredientId, studyIds] of studyByIngredient.entries()) {
    const clusterId = `cluster-studies-${ingredientId}`;
    clusterNodes.push({
      id: clusterId,
      type: 'study-cluster',
      label: locale === 'en' ? `${studyIds.length} Studies` : `${studyIds.length} Studien`,
      parentIngredient: ingredientId,
      studyIds,
      studyCount: studyIds.length,
      degree: studyIds.length,
    });
    clusterEdges.push({
      source: clusterId,
      target: ingredientId,
      relation: 'cluster_of',
      confidence: 1,
    });
    clusterStudyIds.set(clusterId, studyIds);
    studyIds.forEach(studyId => studyToClusterId.set(studyId, clusterId));
  }

  graphData.nodes = graphData.nodes.map(node => ({
    ...node,
    degree: degreeMap.get(node.id) ?? 0,
    clusterId: node.type === 'study' ? studyToClusterId.get(node.id) : undefined,
  }));

  graphData.nodes.push(...clusterNodes);
  graphData.edges.push(...clusterEdges);

  cachedNodes = graphData.nodes;
  cachedEdges = graphData.edges;

  const degreeValues = graphData.nodes
    .filter(n => n.type !== 'study-cluster')
    .map(n => n.degree ?? 0);
  const minDegree = Math.min(...degreeValues, 0);
  const maxDegree = Math.max(...degreeValues, 1);

  buildLaneOverlay(container, locale, labels);

  cy = cytoscape({
    container,
    elements: [
      ...graphData.nodes.map(n => ({
        group: 'nodes' as const,
        data: {
          id: n.id,
          label: n.label ?? n.id,
          type: n.type,
          path: n.path,
          color: ENTITY_COLORS[n.type] ?? '#94a3b8',
          degree: n.degree ?? 0,
          parentIngredient: n.parentIngredient,
          studyIds: n.studyIds,
          studyCount: n.studyCount,
          clusterId: n.clusterId,
        },
      })),
      ...graphData.edges.map(e => ({
        group: 'edges' as const,
        data: {
          source: e.source,
          target: e.target,
          relation: e.relation,
          confidence: e.confidence ?? 1,
          evidenceLevel: (e as Record<string, unknown>).evidenceLevel ?? '',
          relationSource: (e as Record<string, unknown>).relationSource ?? '',
        },
      })),
    ],
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'label': '',
          'width': `mapData(degree, ${minDegree}, ${maxDegree}, 12, 28)`,
          'height': `mapData(degree, ${minDegree}, ${maxDegree}, 12, 28)`,
          'border-width': 1.5,
          'border-color': 'data(color)',
          'border-opacity': 0.35,
          'opacity': 0.95,
          'transition-property': 'opacity width height border-width border-opacity color text-outline-width text-margin-y z-index',
          'transition-duration': `${ANIMATION_MS}ms`,
          'transition-timing-function': 'ease-out',
        },
      },
      {
        selector: 'node[type = "study-cluster"]',
        style: {
          'shape': 'round-rectangle',
          'width': '56px',
          'height': '24px',
          'label': '',
          'font-size': '9px',
          'color': '#ffffff',
          'text-valign': 'center',
          'text-halign': 'center',
          'border-width': 2,
          'border-color': '#4f46e5',
          'border-opacity': 0.7,
        },
      },
      {
        selector: 'node.ks-highlighted',
        style: {
          'label': 'data(label)',
          'color': '#1e293b',
          'font-size': '10px',
          'font-weight': '500',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '120px',
          'text-margin-y': '-10px',
          'text-outline-width': 2,
          'text-outline-color': '#ffffff',
          'border-width': 3,
          'border-opacity': 1,
          'border-color': '#ffffff',
          'opacity': 1,
          'z-index': 10,
        },
      },
      {
        selector: 'node.ks-neighbor',
        style: {
          'label': 'data(label)',
          'color': '#1e293b',
          'font-size': '10px',
          'font-weight': '500',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '120px',
          'text-margin-y': '-10px',
          'text-outline-width': 2,
          'text-outline-color': '#ffffff',
          'border-width': 2.5,
          'border-opacity': 1,
          'border-color': '#ffffff',
          'opacity': 1,
          'z-index': 11,
        },
      },
      {
        selector: 'node.ks-selected',
        style: {
          'label': 'data(label)',
          'color': '#0f172a',
          'font-size': '11px',
          'font-weight': '600',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '140px',
          'text-margin-y': '-12px',
          'text-outline-width': 2,
          'text-outline-color': '#ffffff',
          'border-width': 3,
          'border-opacity': 1,
          'border-color': '#0f172a',
          'width': '28px',
          'height': '28px',
          'opacity': 1,
          'z-index': 20,
        },
      },
      {
        selector: 'node.ks-expanded-study',
        style: {
          'label': 'data(label)',
          'color': '#1e293b',
          'font-size': '9px',
          'font-weight': '500',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '100px',
          'text-margin-y': '-8px',
          'text-outline-width': 2,
          'text-outline-color': '#ffffff',
          'opacity': 1,
          'z-index': 14,
        },
      },
      {
        selector: 'node.ks-faded',
        style: { opacity: 0.06 },
      },
      {
        selector: 'node.ks-hidden',
        style: { display: 'none' },
      },
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': '#94a3b8',
          'curve-style': 'bezier',
          'opacity': 0.08,
          'target-arrow-shape': 'none',
          'transition-property': 'opacity width line-color',
          'transition-duration': `${ANIMATION_MS}ms`,
          'transition-timing-function': 'ease-out',
        },
      },
      {
        selector: 'edge.ks-active',
        style: {
          'opacity': 0.5,
          'width': 2,
          'line-color': '#64748b',
        },
      },
      {
        selector: 'edge.ks-faded',
        style: { opacity: 0.02 },
      },
      {
        selector: 'edge.ks-hidden',
        style: { display: 'none' },
      },
    ],
    layout: { name: 'null' } as Parameters<Core['layout']>[0],
    minZoom: 0.08,
    maxZoom: 3,
    wheelSensitivity: 0.25,
  });

  const fitGraph = () => fitElements(cy?.elements().filter(ele => !ele.hasClass('ks-hidden')));
  requestAnimationFrame(() => requestAnimationFrame(fitGraph));
  window.addEventListener('load', fitGraph, { once: true });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      if (layoutMode === 'structured') applyStructuredLayout();
      else fitGraph();
    });
    observer.observe(container);
  }

  const filterRow = document.getElementById('ks-type-filters');
  if (filterRow) {
    filterRow.innerHTML = '';
    filterRow.appendChild(makeFilterChip(labels.all ?? 'All', 'all', true));

    const typesInGraph = new Set(graphData.nodes.map(n => n.type));
    const typeOrder = ['ingredient', 'mechanism', 'symptom', 'contraindication', 'regulatory', 'study'];
    for (const type of typeOrder) {
      if (type === 'study' || typesInGraph.has(type)) {
        filterRow.appendChild(makeFilterChip(labels[type] ?? type, type, false, ENTITY_COLORS[type]));
      }
    }

    filterRow.addEventListener('click', event => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-type]');
      if (!btn) return;
      const type = btn.dataset.type ?? 'all';

      if (type === 'all') {
        activeTypes.clear();
        filterRow.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(chip => {
          chip.dataset.active = chip.dataset.type === 'all' ? 'true' : 'false';
          syncChipStyle(chip);
        });
      } else {
        if (activeTypes.has(type)) {
          activeTypes.delete(type);
          btn.dataset.active = 'false';
        } else {
          activeTypes.add(type);
          btn.dataset.active = 'true';
        }
        const allBtn = filterRow.querySelector<HTMLButtonElement>('[data-type="all"]');
        if (allBtn) {
          allBtn.dataset.active = activeTypes.size === 0 ? 'true' : 'false';
          syncChipStyle(allBtn);
        }
        syncChipStyle(btn);
      }

      applyFilters();
    });
  }

  // ── Evidence level filter chips ──────────────────────────────────────────
  const evFilterRow = document.getElementById('ks-evidence-filters');
  if (evFilterRow) {
    const evLevels = locale === 'en'
      ? [
          { key: '', label: 'All evidence' },
          { key: 'meta_analysis', label: 'Meta-Analysis' },
          { key: 'human_rct', label: 'RCT' },
          { key: 'human_observational', label: 'Observational' },
          { key: 'expert_review', label: 'Review' },
        ]
      : [
          { key: '', label: 'Alle Evidenz' },
          { key: 'meta_analysis', label: 'Meta-Analyse' },
          { key: 'human_rct', label: 'RCT' },
          { key: 'human_observational', label: 'Beobachtung' },
          { key: 'expert_review', label: 'Review' },
        ];

    const evColors: Record<string, string> = {
      meta_analysis: '#0d9488',
      human_rct: '#3b82f6',
      human_observational: '#f59e0b',
      expert_review: '#94a3b8',
    };

    for (const ev of evLevels) {
      const btn = document.createElement('button');
      btn.dataset.evidence = ev.key;
      btn.dataset.active = ev.key === '' ? 'true' : 'false';
      btn.textContent = ev.label;
      btn.className = 'ev-chip flex-shrink-0 text-[10px] rounded-full px-2.5 py-1 border font-medium transition-colors cursor-pointer ' +
        (ev.key === ''
          ? 'border-teal-500 bg-teal-500 text-white'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400');
      if (ev.key && evColors[ev.key]) {
        btn.style.setProperty('--ev-color', evColors[ev.key]);
      }
      evFilterRow.appendChild(btn);
    }

    evFilterRow.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-evidence]');
      if (!btn) return;
      const value = btn.dataset.evidence ?? '';
      activeEvidenceLevel = value;

      evFilterRow.querySelectorAll<HTMLButtonElement>('[data-evidence]').forEach(b => {
        const isActive = b.dataset.evidence === value;
        b.dataset.active = isActive ? 'true' : 'false';
        const evColor = b.style.getPropertyValue('--ev-color');
        b.className = 'ev-chip flex-shrink-0 text-[10px] rounded-full px-2.5 py-1 border font-medium transition-colors cursor-pointer ' +
          (isActive
            ? evColor
              ? 'border-transparent text-white'
              : 'border-teal-500 bg-teal-500 text-white'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400');
        if (isActive && evColor) {
          b.style.backgroundColor = evColor;
        } else {
          b.style.backgroundColor = '';
        }
      });

      applyFilters();
    });
  }

  const searchEl = document.getElementById('ks-search') as HTMLInputElement | null;
  searchEl?.addEventListener('input', () => {
    searchQuery = searchEl.value.trim().toLowerCase();
    applyFilters();
  });

  document.getElementById('ks-fit')?.addEventListener('click', () => fitGraph());
  document.getElementById('ks-mode-map')?.addEventListener('click', () => {
    if (layoutMode !== 'map') setLayoutMode('map', locale);
  });
  document.getElementById('ks-mode-structured')?.addEventListener('click', () => {
    if (layoutMode !== 'structured') setLayoutMode('structured', locale);
  });

  document.getElementById('ks-reset-selection')?.addEventListener('click', () => {
    collapseAllClusters();
    clearSelection();
  });
  document.getElementById('ks-sheet-close')?.addEventListener('click', () => {
    collapseAllClusters();
    clearSelection();
  });
  document.getElementById('ks-sheet-backdrop')?.addEventListener('click', () => {
    collapseAllClusters();
    clearSelection();
  });

  cy.on('tap', 'node', evt => {
    const node = evt.target as NodeSingular;
    const type = String(node.data('type'));

    if (type === 'study-cluster') {
      toggleCluster(node);
      if (activeTypes.has('study')) {
        selectNode(node, locale);
        if (isMobileViewport()) openBottomSheet(node, locale);
        else showNodeDetail(node, locale);
      }
      return;
    }

    selectNode(node, locale);
    if (isMobileViewport()) openBottomSheet(node, locale);
    else showNodeDetail(node, locale);
  });

  cy.on('tap', evt => {
    if (evt.target !== cy) return;
    collapseAllClusters();
    clearSelection();
  });

  // applyFilters handles initial visibility (ingredient-first view)
  setLayoutMode('structured', locale);
  applyFilters();
  updateResetButton(locale);

  const countEl = document.getElementById('ks-node-count');
  if (countEl) countEl.textContent = String(graphData.nodes.filter(n => n.type !== 'study-cluster').length);
  const edgeCountEl = document.getElementById('ks-edge-count');
  if (edgeCountEl) edgeCountEl.textContent = String(graphData.edges.filter(e => e.relation !== 'cluster_of').length);

  const typeLabelEl = document.querySelector<HTMLElement>('#ks-node-detail [data-ks="type-label"]');
  if (typeLabelEl) typeLabelEl.textContent = strings.type;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGraph);
} else {
  void initGraph();
}
