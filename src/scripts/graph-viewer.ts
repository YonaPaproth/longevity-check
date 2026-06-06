/**
 * Client-side knowledge graph viewer using Cytoscape.js.
 * Reads locale from the `data-locale` attribute of `#cy-container`.
 * Fetches graph data from /data/graph.json (DE) or /data/graph.en.json (EN).
 */

import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';

// ── Entity type colours (aligned with site palette) ──────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  ingredient: '#0d9488',   // teal-600
  mechanism:  '#3b82f6',   // blue-500
  biomarker:  '#8b5cf6',   // violet-500
  symptom:    '#f97316',   // orange-500
  regulatory: '#f59e0b',   // amber-500
  claim:      '#ef4444',   // red-500
  study:      '#94a3b8',   // slate-400
};

const TYPE_LABELS: Record<string, Record<string, string>> = {
  de: {
    ingredient: 'Wirkstoff',
    mechanism:  'Mechanismus',
    biomarker:  'Biomarker',
    symptom:    'Symptom',
    regulatory: 'Regulatorik',
    claim:      'Claim',
    study:      'Studie',
    all:        'Alle',
  },
  en: {
    ingredient: 'Ingredient',
    mechanism:  'Mechanism',
    biomarker:  'Biomarker',
    symptom:    'Symptom',
    regulatory: 'Regulatory',
    claim:      'Claim',
    study:      'Study',
    all:        'All',
  },
};

// ── Filter state ──────────────────────────────────────────────────────────────

let searchQuery = '';
let activeTypes = new Set<string>();
let cy: Core | null = null;

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

function applyFilters() {
  if (!cy) return;

  const hasSearch = searchQuery.length > 0;
  const hasTypeFilter = activeTypes.size > 0;

  if (!hasSearch && !hasTypeFilter) {
    cy.nodes().removeClass('ks-faded ks-highlighted ks-hidden');
    cy.edges().removeClass('ks-faded ks-hidden');
    fitElements(cy.elements());
    return;
  }

  const directMatches = cy.nodes().filter((n) => {
    const matchesSearch = !hasSearch || String(n.data('label')).toLowerCase().includes(searchQuery);
    const matchesType = !hasTypeFilter || activeTypes.has(String(n.data('type')));
    return matchesSearch && matchesType;
  });

  let visibleNodes = directMatches;

  // For search, keep the immediate neighborhood visible so users can see
  // connected ingredients/claims/mechanisms instead of an isolated hit.
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

  const visibleElements = visibleNodes.union(visibleNodes.connectedEdges().filter((e) => !e.hasClass('ks-hidden')));
  fitElements(visibleElements);
}

// ── Node detail panel ─────────────────────────────────────────────────────────

function showNodeDetail(node: NodeSingular, locale: string) {
  const panel = document.getElementById('ks-node-detail');
  if (!panel) return;

  const labels = TYPE_LABELS[locale] ?? TYPE_LABELS.de;
  const data = node.data();
  const typeLabel = labels[data.type as string] ?? data.type;
  const color = ENTITY_COLORS[data.type as string] ?? '#94a3b8';

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

  if (data.path) {
    if (linkEl)   { linkEl.href = data.path; linkEl.classList.remove('hidden'); }
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
  let graphData: { nodes: Array<{ id: string; type: string; label: string; path?: string }>; edges: Array<{ source: string; target: string; relation: string; confidence: number }> };

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    graphData = await res.json();
  } catch (err) {
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

  // ── Initialise Cytoscape ──────────────────────────────────────────────────
  cy = cytoscape({
    container,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color':  'data(color)',
          'label':             '',
          'width':             '18px',
          'height':            '18px',
          'border-width':      1.5,
          'border-color':      'data(color)',
          'border-opacity':    0.35,
          'opacity':           0.95,
        },
      },
      {
        selector: 'node.ks-highlighted',
        style: {
          'label':             'data(label)',
          'color':             '#e2e8f0',
          'font-size':         '10px',
          'font-weight':       '500',
          'text-valign':       'bottom',
          'text-halign':       'center',
          'text-wrap':         'wrap',
          'text-max-width':    '120px',
          'text-margin-y':     '-10px',
          'text-outline-width': 2,
          'text-outline-color': '#0f172a',
          'border-opacity':    1,
          'border-color':      '#ffffff',
          'border-width':      3,
          'width':             '24px',
          'height':            '24px',
          'z-index':           10,
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
          'label':             'data(label)',
          'color':             '#ffffff',
          'text-outline-width': 2,
          'text-outline-color': '#0f172a',
          'border-opacity':    1,
          'border-color':      '#ffffff',
          'border-width':      3,
          'width':             '26px',
          'height':            '26px',
          'z-index':           12,
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
    // Now that the renderer mounts into a stable-height container, COSE gives
    // a much more readable "obsidian-like" spread than the compressed fallback.
    layout: {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 64,
      randomize: true,
      nodeRepulsion: (_node: unknown) => 180000,
      idealEdgeLength: (_edge: unknown) => 90,
      edgeElasticity: (_edge: unknown) => 80,
      nodeOverlap: 8,
      gravity: 1,
      numIter: 900,
      componentSpacing: 120,
    } as Parameters<Core['layout']>[0],
    minZoom:          0.08,
    maxZoom:          3,
    wheelSensitivity: 0.25,
  });

  const fitGraph = () => {
    if (!cy) return;
    fitElements(cy.elements());
  };

  // Cytoscape can occasionally initialise before the mount has a stable size,
  // which leaves the canvas visually blank even though the data loaded.
  // Re-fit after the next paint, after load, and on container resize.
  requestAnimationFrame(() => requestAnimationFrame(fitGraph));
  window.addEventListener('load', fitGraph, { once: true });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      fitGraph();
    });
    observer.observe(container);
  }

  cy.one('layoutstop', () => {
    fitGraph();
  });

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
  const filterRow = document.getElementById('ks-type-filters');

  if (filterRow) {
    // "All" chip
    const allChip = makeFilterChip(labels.all ?? 'All', 'all', true);
    filterRow.appendChild(allChip);

    // One chip per entity type present in the graph
    const typeOrder = ['ingredient', 'claim', 'mechanism', 'biomarker', 'symptom', 'regulatory'];
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
        // Toggle
        if (activeTypes.has(type)) {
          activeTypes.delete(type);
          btn.dataset.active = 'false';
        } else {
          activeTypes.add(type);
          btn.dataset.active = 'true';
        }
        // Update "All" chip
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

  // ── Node count display ───────────────────────────────────────────────────
  const countEl = document.getElementById('ks-node-count');
  if (countEl) {
    countEl.textContent = String(graphData.nodes.length);
  }
  const edgeCountEl = document.getElementById('ks-edge-count');
  if (edgeCountEl) {
    edgeCountEl.textContent = String(graphData.edges.length);
  }
}

// ── Helper: filter chip DOM builder ──────────────────────────────────────────

function makeFilterChip(label: string, type: string, active: boolean, color?: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.dataset.type   = type;
  btn.dataset.active = active ? 'true' : 'false';
  btn.textContent    = label;

  if (color) {
    btn.style.setProperty('--chip-color', color);
  }

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
