/**
 * Client-side knowledge graph viewer using Cytoscape.js.
 * Reads locale from the `data-locale` attribute of `#cy-container`.
 * Fetches graph data from /data/graph.json (DE) or /data/graph.en.json (EN).
 *
 * Layout modes:
 *   map        – COSE organic layout (default)
 *   structured – Preset positions with Y lanes by node type and X buckets by
 *                regulatory/evidence status inferred from edges.
 */

import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';

// ── Entity type colours (aligned with site palette) ──────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  ingredient:      '#0d9488',   // teal-600
  mechanism:       '#3b82f6',   // blue-500
  biomarker:       '#8b5cf6',   // violet-500
  symptom:         '#f97316',   // orange-500
  contraindication:'#ef4444',   // red-500
  regulatory:      '#f59e0b',   // amber-500
  claim:           '#ef4444',   // red-500
  study:           '#94a3b8',   // slate-400
};

const TYPE_LABELS: Record<string, Record<string, string>> = {
  de: {
    ingredient: 'Wirkstoff',
    mechanism:  'Mechanismus',
    biomarker:  'Biomarker',
    symptom:         'Symptom',
    contraindication:'Kontraindikation',
    regulatory:      'Regulatorik',
    claim:           'Claim',
    study:           'Studie',
    all:             'Alle',
  },
  en: {
    ingredient:      'Ingredient',
    mechanism:       'Mechanism',
    biomarker:       'Biomarker',
    symptom:         'Symptom',
    contraindication:'Contraindication',
    regulatory:      'Regulatory',
    claim:           'Claim',
    study:           'Study',
    all:             'All',
  },
};

// ── Structured layout constants ───────────────────────────────────────────────

/** Y position (as fraction of container height) for each node type lane. */
const STRUCTURED_LANES: Array<{ type: string; yFrac: number }> = [
  { type: 'regulatory',       yFrac: 0.08 },
  { type: 'ingredient',       yFrac: 0.28 },
  { type: 'mechanism',        yFrac: 0.48 },
  { type: 'symptom',          yFrac: 0.65 },
  { type: 'contraindication', yFrac: 0.85 },
];

/**
 * How many sub-rows a lane gets and how much vertical space (fraction) it spans.
 * Nodes are distributed across sub-rows to avoid overlap in crowded lanes.
 */
const LANE_ROWS: Record<string, { rows: number; span: number }> = {
  ingredient:       { rows: 3, span: 0.16 },
  mechanism:        { rows: 2, span: 0.08 },
  symptom:          { rows: 2, span: 0.10 },
  contraindication: { rows: 2, span: 0.10 },
};

/** X range [min, max] as fraction of width for each bucket.
 *  Bucket 0 = strong/approved (left), 1 = unknown/mixed (centre), 2 = not-approved/weak (right). */
const BUCKET_X_RANGE: [[number, number], [number, number], [number, number]] = [
  [0.04, 0.36],
  [0.40, 0.60],
  [0.64, 0.96],
];

// ── Filter + layout state ─────────────────────────────────────────────────────

let searchQuery  = '';
let activeTypes  = new Set<string>();
let layoutMode: 'map' | 'structured' = 'structured';
let cy: Core | null = null;

// Cached graph data (needed to re-compute structured positions after filter)
let cachedNodes: Array<{
  id: string; type: string; label: string; path?: string;
  evidenceLevel?: number; efsaApproved?: boolean;
  claimHumanEvidence?: string; regulatoryEfsa?: string;
}> = [];
let cachedEdges: Array<{ source: string; target: string; relation: string; confidence: number }> = [];

// ── Fit helpers ───────────────────────────────────────────────────────────────

function fitElements(target = cy?.elements()) {
  if (!cy || !target || target.length === 0) return;
  cy.resize();
  cy.fit(target, 64);
  const minUsefulZoom = 0.42;
  if (cy.zoom() < minUsefulZoom) {
    cy.zoom(minUsefulZoom);
    cy.center(target);
  }
}

// ── Filter logic ──────────────────────────────────────────────────────────────

function applyFilters() {
  if (!cy) return;

  const hasSearch     = searchQuery.length > 0;
  const hasTypeFilter = activeTypes.size > 0;

  if (!hasSearch && !hasTypeFilter) {
    cy.nodes().removeClass('ks-faded ks-highlighted ks-hidden');
    cy.edges().removeClass('ks-faded ks-hidden');
    fitElements(cy.elements());
    return;
  }

  const directMatches = cy.nodes().filter((n) => {
    const matchesSearch = !hasSearch || String(n.data('label')).toLowerCase().includes(searchQuery);
    const matchesType   = !hasTypeFilter || activeTypes.has(String(n.data('type')));
    return matchesSearch && matchesType;
  });

  let visibleNodes = directMatches;

  if (hasSearch && directMatches.length > 0) {
    visibleNodes = directMatches.union(directMatches.neighborhood().nodes());
  }

  cy.nodes().forEach((n) => {
    if (directMatches.has(n)) {
      n.removeClass('ks-hidden ks-faded').addClass('ks-highlighted');
    } else if (visibleNodes.has(n)) {
      n.removeClass('ks-hidden ks-highlighted').addClass('ks-faded');
    } else {
      n.removeClass('ks-highlighted ks-faded').addClass('ks-hidden');
    }
  });

  cy.edges().forEach((e) => {
    const srcVisible = !e.source().hasClass('ks-hidden');
    const tgtVisible = !e.target().hasClass('ks-hidden');
    if (srcVisible && tgtVisible) {
      e.removeClass('ks-hidden');
      if (directMatches.has(e.source()) || directMatches.has(e.target())) {
        e.removeClass('ks-faded');
      } else {
        e.addClass('ks-faded');
      }
    } else {
      e.removeClass('ks-faded').addClass('ks-hidden');
    }
  });

  const visibleElements = visibleNodes.union(
    visibleNodes.connectedEdges().filter((e) => !e.hasClass('ks-hidden')),
  );
  fitElements(visibleElements);
}

// ── Node detail panel ─────────────────────────────────────────────────────────

function showNodeDetail(node: NodeSingular, locale: string) {
  const panel = document.getElementById('ks-node-detail');
  if (!panel) return;

  const labels   = TYPE_LABELS[locale] ?? TYPE_LABELS.de;
  const data     = node.data();
  const typeLabel = labels[data.type as string] ?? data.type;
  const color     = ENTITY_COLORS[data.type as string] ?? '#94a3b8';

  const nameEl   = panel.querySelector<HTMLElement>('[data-ks="name"]');
  const typeEl   = panel.querySelector<HTMLElement>('[data-ks="type"]');
  const linkEl   = panel.querySelector<HTMLAnchorElement>('[data-ks="link"]');
  const noLinkEl = panel.querySelector<HTMLElement>('[data-ks="no-link"]');
  const badgeEl  = panel.querySelector<HTMLElement>('[data-ks="badge"]');

  if (nameEl)  nameEl.textContent  = data.label ?? data.id;
  if (typeEl)  typeEl.textContent  = typeLabel;
  if (badgeEl) {
    badgeEl.textContent = typeLabel;
    badgeEl.style.backgroundColor = color;
  }

  // Determine link: ingredients get dossier path, symptoms get category page
  let nodePath = data.path;
  if ((String(data.type) === 'symptom' || String(data.type) === 'contraindication') && !nodePath) {
    const catSlug = String(data.id);
    const loc = document.getElementById('ks-cy-container')?.dataset.locale ?? 'de';
    nodePath = loc === 'en'
      ? `/en/ingredients/category/${catSlug}`
      : `/wirkstoffe/kategorie/${catSlug}`;
  }

  const canOpenDossier = Boolean(nodePath) && ['ingredient', 'symptom', 'contraindication'].includes(String(data.type));

  if (canOpenDossier) {
    if (linkEl)   { linkEl.href = nodePath; linkEl.classList.remove('hidden'); }
    if (noLinkEl) noLinkEl.classList.add('hidden');
  } else {
    if (linkEl)   linkEl.classList.add('hidden');
    if (noLinkEl) noLinkEl.classList.remove('hidden');
  }

  panel.classList.remove('hidden');
}

function hideNodeDetail() {
  document.getElementById('ks-node-detail')?.classList.add('hidden');
}

// ── Structured layout helpers ─────────────────────────────────────────────────

/** Simple deterministic hash of a string → non-negative int */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

/**
 * Assign every node an X bucket (0=approved/strong, 1=mixed, 2=not-approved/weak).
 *
 * Priority order per type:
 *
 *  1. Regulatory nodes: by node id substring
 *     – contains "nicht" / "not" / "reject" / "ablehnt"  → bucket 2
 *     – contains "zulassung" / "zugelas" / "approved" / "authoris"  → bucket 0
 *     – otherwise → bucket 1
 *
 *  2. Ingredient nodes: metadata-first, then regulatory-edge fallback
 *     a) efsaApproved === true  → bucket 0 (EFSA approved)
 *     b) efsaApproved === false, evidenceLevel 1–2 → bucket 1 (strong evidence, no EFSA claim)
 *     c) efsaApproved === false, evidenceLevel 3–5 → bucket 2 (weak evidence, not approved)
 *     d) efsaApproved undefined, evidenceLevel 1–2 → bucket 0 (strong evidence)
 *     e) efsaApproved undefined, evidenceLevel 3–5 → bucket 2 (weak evidence)
 *     f) No metadata → average bucket of regulatory neighbours; fallback bucket 1
 *
 *  3. Claim nodes: metadata-first, then regulatory-edge fallback
 *     a) regulatoryEfsa contains "nicht" / "not" → bucket 2
 *     b) regulatoryEfsa contains "zugelas" / "approved" → bucket 0
 *     c) claimHumanEvidence "stark" → bucket 0; "moderat" → bucket 1; else → bucket 2
 *     d) No metadata → average bucket of regulatory neighbours; fallback bucket 1
 *
 *  4. Mechanism / Biomarker / Symptom: average bucket of ALL neighbours; fallback bucket 1
 */
function assignXBuckets(
  nodes: Array<{
    id: string; type: string;
    evidenceLevel?: number; efsaApproved?: boolean;
    claimHumanEvidence?: string; regulatoryEfsa?: string;
  }>,
  edges: Array<{ source: string; target: string; relation: string }>,
): Map<string, number> {
  const buckets = new Map<string, number>();

  // Pass 1 – regulatory (id-name heuristic, unchanged)
  for (const node of nodes) {
    if (node.type !== 'regulatory') continue;
    const id = node.id.toLowerCase();
    if (id.includes('nicht') || id.includes('-not-') || id.includes('reject') || id.includes('ablehnt')) {
      buckets.set(node.id, 2);
    } else if (
      id.includes('zugelas') || id.includes('zulassung') ||
      id.includes('approved') || id.includes('authoris')
    ) {
      buckets.set(node.id, 0);
    } else {
      buckets.set(node.id, 1);
    }
  }

  const regEdges = edges.filter(e => e.relation === 'hat_regulatorischen_status');

  // Pass 2 – ingredients: metadata signals first, edge-based fallback
  for (const node of nodes) {
    if (node.type !== 'ingredient') continue;

    const hasEfsa    = node.efsaApproved !== undefined;
    const hasEvidence = node.evidenceLevel !== undefined;

    if (hasEfsa && node.efsaApproved === true) {
      // EFSA approved → left column
      buckets.set(node.id, 0);
    } else if (hasEfsa && node.efsaApproved === false && hasEvidence) {
      // Not EFSA approved: position by evidence strength
      buckets.set(node.id, node.evidenceLevel! <= 2 ? 1 : 2);
    } else if (!hasEfsa && hasEvidence) {
      // No EFSA data: use evidence level alone
      buckets.set(node.id, node.evidenceLevel! <= 2 ? 0 : 2);
    } else {
      // Fallback: regulatory-edge neighbours
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

  // Pass 3 – claims: metadata signals first, edge-based fallback
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
      // Fallback: regulatory-edge neighbours
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

  // Pass 4 – mechanism / biomarker / symptom (use already-resolved neighbour buckets)
  for (const node of nodes) {
    if (!['mechanism', 'biomarker', 'symptom'].includes(node.type)) continue;
    const neighborBuckets = edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => {
        const neighborId = e.source === node.id ? e.target : e.source;
        return buckets.get(neighborId);
      })
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

/**
 * Compute preset {x, y} positions for all nodes for the structured layout.
 * Nodes are placed in Y-lanes by type and spread horizontally within their
 * X bucket.  A small deterministic vertical jitter (±18px) prevents exact
 * overlaps in crowded lanes.
 */
function computeStructuredPositions(
  nodes: Array<{ id: string; type: string }>,
  edges: Array<{ source: string; target: string; relation: string }>,
  containerWidth: number,
  containerHeight: number,
): Map<string, { x: number; y: number }> {
  const buckets     = assignXBuckets(nodes, edges);
  const laneYByType = new Map(STRUCTURED_LANES.map(l => [l.type, l.yFrac]));

  // Group nodes by (type, bucket) for even horizontal spread
  // Treat kontra-* and nw-* symptom nodes as contraindications for layout
  const groups = new Map<string, string[]>();
  // Separate list for symptom nodes (distributed evenly, ignoring buckets)
  const symptomIds: string[] = [];

  for (const node of nodes) {
    const bucket = buckets.get(node.id) ?? 1;
    const layoutType = (node.type === 'symptom' && (node.id.startsWith('kontra-') || node.id.startsWith('nw-')))
      ? 'contraindication'
      : node.type;

    // Symptoms get equal distribution instead of bucket grouping
    if (layoutType === 'symptom') {
      symptomIds.push(node.id);
      continue;
    }

    const key    = `${layoutType}::${bucket}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node.id);
  }

  const positions = new Map<string, { x: number; y: number }>();

  // Position symptom nodes: equally spaced left to right across full width
  {
    const yFrac = laneYByType.get('symptom') ?? 0.65;
    const laneConfig = LANE_ROWS['symptom'];
    const numRows = laneConfig?.rows ?? 1;
    const spanFrac = laneConfig?.span ?? 0;
    const xPad = 0.04; // padding from edges

    symptomIds.sort();
    for (let i = 0; i < symptomIds.length; i++) {
      const row = i % numRows;
      const colInRow = Math.floor(i / numRows);
      const totalInRow = Math.ceil(symptomIds.length / numRows);

      const xFrac = totalInRow === 1
        ? 0.5
        : xPad + (1 - 2 * xPad) * (colInRow / (totalInRow - 1));

      const rowOffset = numRows <= 1
        ? 0
        : (row / (numRows - 1) - 0.5) * spanFrac;

      const yJitter = ((simpleHash(symptomIds[i]) % 9) - 4);

      positions.set(symptomIds[i], {
        x: xFrac * containerWidth,
        y: (yFrac + rowOffset) * containerHeight + yJitter,
      });
    }
  }

  // Position all other node types using bucket-based X ranges
  for (const [key, ids] of groups) {
    const [typeStr, bucketStr] = key.split('::');
    const bucket = Math.min(2, Math.max(0, parseInt(bucketStr, 10))) as 0 | 1 | 2;
    const [xMin, xMax] = BUCKET_X_RANGE[bucket];
    const yFrac         = laneYByType.get(typeStr) ?? 0.5;

    // Sort alphabetically for stable, repeatable ordering across modes
    ids.sort();

    // Multi-row layout: distribute nodes across sub-rows for crowded lanes
    const laneConfig = LANE_ROWS[typeStr];
    const numRows = laneConfig?.rows ?? 1;
    const spanFrac = laneConfig?.span ?? 0;

    for (let i = 0; i < ids.length; i++) {
      const row = i % numRows;
      const colInRow = Math.floor(i / numRows);
      const totalInRow = Math.ceil(ids.length / numRows);

      const xFrac = totalInRow === 1
        ? (xMin + xMax) / 2
        : xMin + (xMax - xMin) * (colInRow / (totalInRow - 1));

      // Spread rows evenly around the lane center
      const rowOffset = numRows <= 1
        ? 0
        : (row / (numRows - 1) - 0.5) * spanFrac;

      // Tiny deterministic jitter to prevent exact overlaps
      const yJitter = ((simpleHash(ids[i]) % 9) - 4); // ±4 px

      positions.set(ids[i], {
        x: xFrac * containerWidth,
        y: (yFrac + rowOffset) * containerHeight + yJitter,
      });
    }
  }

  return positions;
}

// ── Lane label overlay ────────────────────────────────────────────────────────

function buildLaneOverlay(
  container: HTMLElement,
  locale: string,
  labels: Record<string, string>,
): HTMLElement {
  const old = container.querySelector('#ks-lane-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'ks-lane-overlay';
  overlay.className = 'absolute inset-0 pointer-events-none hidden z-10';

  // Y lane labels on the left edge
  for (const { type, yFrac } of STRUCTURED_LANES) {
    const label = labels[type] ?? type;
    const div   = document.createElement('div');
    div.className = 'absolute left-2 text-[10px] font-semibold tracking-wide uppercase opacity-40 -translate-y-1/2 whitespace-nowrap';
    div.style.cssText = `top:${yFrac * 100}%; color:${ENTITY_COLORS[type] ?? '#94a3b8'}`;
    div.textContent   = label;
    overlay.appendChild(div);
  }

  // Faint horizontal separator lines at each lane boundary
  const laneMidpoints = STRUCTURED_LANES.map(l => l.yFrac);
  for (let i = 0; i < laneMidpoints.length - 1; i++) {
    const lineY = (laneMidpoints[i] + laneMidpoints[i + 1]) / 2;
    const line  = document.createElement('div');
    line.className = 'absolute inset-x-0 h-px opacity-10 bg-slate-400';
    line.style.top = `${lineY * 100}%`;
    overlay.appendChild(line);
  }

  // X-axis bucket headers at the very top
  const xHeader = document.createElement('div');
  xHeader.className = 'absolute top-1 left-16 right-2 flex justify-between text-[9px] font-medium tracking-wide uppercase opacity-30 text-slate-300';
  const leftLabel  = locale === 'en' ? 'EFSA approved'     : 'EFSA zugelassen';
  const midLabel   = locale === 'en' ? 'Mixed / unknown'   : 'Gemischt';
  const rightLabel = locale === 'en' ? 'EFSA not approved' : 'EFSA abgelehnt';
  xHeader.innerHTML = `<span>${leftLabel}</span><span>${midLabel}</span><span>${rightLabel}</span>`;
  overlay.appendChild(xHeader);

  container.appendChild(overlay);
  return overlay;
}

// ── Layout mode switching ─────────────────────────────────────────────────────

function applyStructuredLayout() {
  if (!cy) return;

  const container = document.getElementById('ks-cy-container');
  if (!container) return;

  const w = container.offsetWidth  || 800;
  const h = container.offsetHeight || 600;

  const positions = computeStructuredPositions(cachedNodes, cachedEdges, w, h);

  const presetLayout = cy.layout({
    name: 'preset',
    positions: (node) => {
      const pos = positions.get(node.id());
      return pos ?? { x: w / 2, y: h / 2 };
    },
    fit:     true,
    padding: 40,
  } as Parameters<Core['layout']>[0]);

  presetLayout.run();

  // Show lane overlay
  const overlay = container.querySelector<HTMLElement>('#ks-lane-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function applyMapLayout() {
  if (!cy) return;

  // Hide lane overlay
  const container = document.getElementById('ks-cy-container');
  const overlay   = container?.querySelector<HTMLElement>('#ks-lane-overlay');
  if (overlay) overlay.classList.add('hidden');

  cy.layout({
    name:            'cose',
    animate:         false,
    fit:             true,
    padding:         64,
    randomize:       true,
    nodeRepulsion:   (_node: unknown) => 180000,
    idealEdgeLength: (_edge: unknown) => 90,
    edgeElasticity:  (_edge: unknown) => 80,
    nodeOverlap:     8,
    gravity:         1,
    numIter:         900,
    componentSpacing: 120,
  } as Parameters<Core['layout']>[0]).run();
}

function setLayoutMode(mode: 'map' | 'structured', locale: string) {
  layoutMode = mode;

  const mapBtn        = document.getElementById('ks-mode-map');
  const structuredBtn = document.getElementById('ks-mode-structured');

  const activeClass   = 'bg-teal-600 text-white border-teal-600';
  const inactiveClass = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';

  if (mapBtn && structuredBtn) {
    if (mode === 'map') {
      mapBtn.className        = `px-3 py-2 text-xs font-medium border-y border-l rounded-l-lg transition-colors ${activeClass}`;
      structuredBtn.className = `px-3 py-2 text-xs font-medium border rounded-r-lg transition-colors ${inactiveClass}`;
    } else {
      mapBtn.className        = `px-3 py-2 text-xs font-medium border-y border-l rounded-l-lg transition-colors ${inactiveClass}`;
      structuredBtn.className = `px-3 py-2 text-xs font-medium border rounded-r-lg transition-colors ${activeClass}`;
    }
  }

  if (mode === 'structured') {
    applyStructuredLayout();
  } else {
    applyMapLayout();
  }
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function initGraph() {
  const container = document.getElementById('ks-cy-container');
  if (!container) return;

  const locale   = container.dataset.locale ?? 'de';
  const endpoint = locale === 'en' ? '/data/graph.en.json' : '/data/graph.json';
  const labels   = TYPE_LABELS[locale] ?? TYPE_LABELS.de;

  const loadingEl = document.getElementById('ks-loading');
  const errorEl   = document.getElementById('ks-error');

  // ── Fetch graph data ─────────────────────────────────────────────────────
  let graphData: {
    nodes: Array<{
      id: string; type: string; label: string; path?: string;
      evidenceLevel?: number; efsaApproved?: boolean;
      claimHumanEvidence?: string; regulatoryEfsa?: string;
    }>;
    edges: Array<{ source: string; target: string; relation: string; confidence: number }>;
  };

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    graphData = await res.json();
  } catch {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl)   errorEl.classList.remove('hidden');
    return;
  }

  if (loadingEl) loadingEl.classList.add('hidden');

  if (!graphData.nodes?.length) {
    if (errorEl) {
      errorEl.textContent = locale === 'en'
        ? 'No graph data available yet.'
        : 'Noch keine Graphdaten vorhanden.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  // Filter out claim and biomarker nodes and their edges
  const hiddenIds = new Set(graphData.nodes.filter(n => n.type === 'claim' || n.type === 'biomarker').map(n => n.id));
  graphData.nodes = graphData.nodes.filter(n => n.type !== 'claim' && n.type !== 'biomarker');
  graphData.edges = graphData.edges.filter(e => !hiddenIds.has(e.source) && !hiddenIds.has(e.target));

  // Reclassify kontra-* symptom nodes as contraindication type
  for (const n of graphData.nodes) {
    if (n.type === 'symptom' && n.id.startsWith('kontra-')) {
      n.type = 'contraindication';
    }
  }

  // Cache data for structured layout re-computation
  cachedNodes = graphData.nodes;
  cachedEdges = graphData.edges;

  // ── Build Cytoscape elements ──────────────────────────────────────────────
  const elements = [
    ...graphData.nodes.map(n => ({
      group: 'nodes' as const,
      data: {
        id:    n.id,
        label: n.label ?? n.id,
        type:  n.type,
        path:  n.path,
        color: ENTITY_COLORS[n.type] ?? '#94a3b8',
      },
    })),
    ...graphData.edges.map(e => ({
      group: 'edges' as const,
      data: {
        source:     e.source,
        target:     e.target,
        relation:   e.relation,
        confidence: e.confidence ?? 1,
      },
    })),
  ];

  // ── Build lane overlay (hidden initially) ─────────────────────────────────
  buildLaneOverlay(container, locale, labels);

  // ── Initialise Cytoscape ──────────────────────────────────────────────────
  // Use null layout on init; setLayoutMode below applies the actual layout
  cy = cytoscape({
    container,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'label':            '',
          'width':            '18px',
          'height':           '18px',
          'border-width':     1.5,
          'border-color':     'data(color)',
          'border-opacity':   0.35,
          'opacity':          0.95,
        },
      },
      {
        selector: 'node.ks-highlighted',
        style: {
          'label':              'data(label)',
          'color':              '#e2e8f0',
          'font-size':          '10px',
          'font-weight':        '500',
          'text-valign':        'bottom',
          'text-halign':        'center',
          'text-wrap':          'wrap',
          'text-max-width':     '120px',
          'text-margin-y':      '-10px',
          'text-outline-width': 2,
          'text-outline-color': '#0f172a',
          'border-opacity':     1,
          'border-color':       '#ffffff',
          'border-width':       3,
          'width':              '24px',
          'height':             '24px',
          'z-index':            10,
        },
      },
      {
        selector: 'node.ks-faded',
        style: { opacity: 0.1 },
      },
      {
        selector: 'node.ks-hidden',
        style: { display: 'none' },
      },
      {
        selector: 'node:selected',
        style: {
          'label':              'data(label)',
          'color':              '#ffffff',
          'text-outline-width': 2,
          'text-outline-color': '#0f172a',
          'border-opacity':     1,
          'border-color':       '#ffffff',
          'border-width':       3,
          'width':              '26px',
          'height':             '26px',
          'z-index':            12,
        },
      },
      {
        selector: 'edge',
        style: {
          width:                1,
          'line-color':         '#94a3b8',
          'curve-style':        'bezier',
          'opacity':            0.18,
          'target-arrow-shape': 'none',
        },
      },
      {
        selector: 'edge.ks-faded',
        style: { opacity: 0.04 },
      },
      {
        selector: 'edge.ks-hidden',
        style: { display: 'none' },
      },
    ],
    layout: { name: 'null' } as Parameters<Core['layout']>[0],
    minZoom:          0.08,
    maxZoom:          3,
    wheelSensitivity: 0.25,
  });

  const fitGraph = () => {
    if (!cy) return;
    fitElements(cy.elements());
  };

  requestAnimationFrame(() => requestAnimationFrame(fitGraph));
  window.addEventListener('load', fitGraph, { once: true });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => { fitGraph(); });
    observer.observe(container);
  }

  cy.one('layoutstop', () => { fitGraph(); });

  // ── Node click: show neighbourhood ───────────────────────────────────────
  cy.on('tap', 'node', evt => {
    const node = evt.target as NodeSingular;
    const hood = node.closedNeighborhood();

    cy!.nodes().addClass('ks-faded').removeClass('ks-highlighted');
    cy!.edges().addClass('ks-faded');
    hood.nodes().removeClass('ks-faded').addClass('ks-highlighted');
    hood.edges().removeClass('ks-faded');

    showNodeDetail(node, locale);
  });

  // ── Background tap: reset ────────────────────────────────────────────────
  cy.on('tap', evt => {
    if (evt.target !== cy) return;
    cy!.nodes().removeClass('ks-faded ks-highlighted');
    cy!.edges().removeClass('ks-faded');
    searchQuery = '';
    const searchEl = document.getElementById('ks-search') as HTMLInputElement | null;
    if (searchEl) searchEl.value = '';
    hideNodeDetail();
  });

  // ── Search ───────────────────────────────────────────────────────────────
  const searchEl = document.getElementById('ks-search') as HTMLInputElement | null;
  searchEl?.addEventListener('input', () => {
    searchQuery = searchEl.value.trim().toLowerCase();
    applyFilters();
  });

  // ── Type filter chips ────────────────────────────────────────────────────
  const typesInGraph = new Set(graphData.nodes.map(n => n.type));
  const filterRow    = document.getElementById('ks-type-filters');

  if (filterRow) {
    const allChip = makeFilterChip(labels.all ?? 'All', 'all', true);
    filterRow.appendChild(allChip);

    const typeOrder = ['ingredient', 'mechanism', 'symptom', 'contraindication', 'regulatory'];
    for (const type of typeOrder) {
      if (!typesInGraph.has(type)) continue;
      const chip = makeFilterChip(labels[type] ?? type, type, false, ENTITY_COLORS[type]);
      filterRow.appendChild(chip);
    }

    filterRow.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-type]');
      if (!btn) return;

      const type = btn.dataset.type!;

      if (type === 'all') {
        activeTypes.clear();
        filterRow.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(b => {
          b.dataset.active = b.dataset.type === 'all' ? 'true' : 'false';
          syncChipStyle(b);
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
      }
      syncChipStyle(btn);
      applyFilters();
    });
  }

  // ── Fit button ───────────────────────────────────────────────────────────
  document.getElementById('ks-fit')?.addEventListener('click', () => {
    cy!.fit(undefined, 40);
  });

  // ── Layout mode toggle ───────────────────────────────────────────────────
  document.getElementById('ks-mode-map')?.addEventListener('click', () => {
    if (layoutMode !== 'map') setLayoutMode('map', locale);
  });

  document.getElementById('ks-mode-structured')?.addEventListener('click', () => {
    if (layoutMode !== 'structured') setLayoutMode('structured', locale);
  });

  // Initialise with structured layout as default
  setLayoutMode('structured', locale);

  // ── Node count display ───────────────────────────────────────────────────
  const countEl = document.getElementById('ks-node-count');
  if (countEl) countEl.textContent = String(graphData.nodes.length);

  const edgeCountEl = document.getElementById('ks-edge-count');
  if (edgeCountEl) edgeCountEl.textContent = String(graphData.edges.length);
}

// ── Helper: filter chip DOM builder ──────────────────────────────────────────

function makeFilterChip(label: string, type: string, active: boolean, color?: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.dataset.type   = type;
  btn.dataset.active = active ? 'true' : 'false';
  btn.textContent    = label;
  if (color) btn.style.setProperty('--chip-color', color);
  syncChipStyle(btn);
  return btn;
}

function syncChipStyle(btn: HTMLButtonElement) {
  const active = btn.dataset.active === 'true';
  const color  = btn.style.getPropertyValue('--chip-color');

  btn.className = [
    'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
    active
      ? color
        ? 'text-white border-transparent'
        : 'bg-teal-600 text-white border-teal-600'
      : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-700',
  ].join(' ');

  if (active && color) {
    btn.style.backgroundColor = color;
    btn.style.borderColor     = color;
  } else if (!active) {
    btn.style.backgroundColor = '';
    btn.style.borderColor     = '';
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGraph);
} else {
  void initGraph();
}
