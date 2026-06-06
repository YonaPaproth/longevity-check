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

function applyFilters() {
  if (!cy) return;

  const hasSearch = searchQuery.length > 0;
  const hasTypeFilter = activeTypes.size > 0;

  if (!hasSearch && !hasTypeFilter) {
    cy.nodes().removeClass('ks-faded ks-highlighted');
    cy.edges().removeClass('ks-faded');
    return;
  }

  cy.nodes().forEach(n => {
    const matchesSearch = !hasSearch || n.data('label').toLowerCase().includes(searchQuery);
    const matchesType   = !hasTypeFilter || activeTypes.has(n.data('type'));
    if (matchesSearch && matchesType) {
      n.removeClass('ks-faded').addClass('ks-highlighted');
    } else {
      n.removeClass('ks-highlighted').addClass('ks-faded');
    }
  });

  cy.edges().forEach(e => {
    const srcFaded = e.source().hasClass('ks-faded');
    const tgtFaded = e.target().hasClass('ks-faded');
    if (srcFaded || tgtFaded) {
      e.addClass('ks-faded');
    } else {
      e.removeClass('ks-faded');
    }
  });
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
    container: document.getElementById('ks-cy'),
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color':  'data(color)',
          'label':             'data(label)',
          'color':             '#ffffff',
          'font-size':         '10px',
          'font-weight':       '500',
          'text-valign':       'center',
          'text-halign':       'center',
          'text-wrap':         'wrap',
          'text-max-width':    '72px',
          'width':             '60px',
          'height':            '60px',
          'border-width':      2,
          'border-color':      'data(color)',
          'border-opacity':    0,
        },
      },
      {
        selector: 'node.ks-highlighted',
        style: {
          'border-opacity': 1,
          'border-color':   '#ffffff',
          'border-width':   3,
        },
      },
      {
        selector: 'node.ks-faded',
        style: { opacity: 0.12 },
      },
      {
        selector: 'node:selected',
        style: {
          'border-opacity': 1,
          'border-color':   '#ffffff',
          'border-width':   3,
        },
      },
      {
        selector: 'edge',
        style: {
          width:              1.5,
          'line-color':       '#cbd5e1',
          'curve-style':      'bezier',
          opacity:            0.55,
          'target-arrow-shape': 'none',
        },
      },
      {
        selector: 'edge.ks-faded',
        style: { opacity: 0.05 },
      },
    ],
    layout: {
      name:            'cose',
      animate:         false,
      randomize:       true,
      nodeRepulsion:   (_node: unknown) => 450000,
      nodeOverlap:     20,
      idealEdgeLength: (_edge: unknown) => 90,
      edgeElasticity:  (_edge: unknown) => 100,
      nestingFactor:   5,
      gravity:         80,
      numIter:         1200,
      initialTemp:     200,
      coolingFactor:   0.95,
      minTemp:         1.0,
    } as Parameters<Core['layout']>[0],
    minZoom:          0.08,
    maxZoom:          3,
    wheelSensitivity: 0.25,
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
