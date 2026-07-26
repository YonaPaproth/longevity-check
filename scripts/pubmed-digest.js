#!/usr/bin/env node
/**
 * MikroScore Weekly Research Digest
 * Sources: PubMed, EFSA Journal, ClinicalTrials.gov
 * Runs every Saturday 08:00 via OpenClaw cron.
 *
 * KG-enhanced (v2):
 * - PMID deduplication against data/sources/studies/
 * - Study-type classification from PubMed pubtypelist
 * - Relevance scoring with study count from data/study-index.json
 * - Auto YAML stub generation for HIGH relevance new hits
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ingredients from JSON file (replaces hardcoded array)
// Fallback: includes any YAML slugs not present in queries.json
function loadIngredients() {
  const queriesPath = path.join(__dirname, '..', 'data', 'ingredient-queries.json');
  const ingredientsDir = path.join(__dirname, '..', 'data', 'sources', 'ingredients');

  let queries = {};
  try {
    queries = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
  } catch {
    console.warn('⚠ Could not load ingredient-queries.json, using empty base');
  }

  // Build array from queries.json
  const ingredients = Object.entries(queries).map(([slug, q]) => ({
    slug,
    pubmed: q.pubmed,
    efsa: q.efsa,
    ct: q.ct,
  }));

  // Add any YAML slugs not already covered
  try {
    const yamlSlugs = fs.readdirSync(ingredientsDir)
      .filter(f => /\.ya?ml$/i.test(f))
      .map(f => path.basename(f).replace(/\.ya?ml$/i, ''));

    const knownSlugs = new Set(ingredients.map(i => i.slug));
    for (const slug of yamlSlugs) {
      if (!knownSlugs.has(slug)) {
        ingredients.push({
          slug,
          pubmed: `"${slug.replace(/-/g, ' ')} supplementation"`,
          efsa: slug.replace(/-/g, ' '),
          ct: `${slug.replace(/-/g, ' ')} supplement`,
        });
      }
    }
  } catch { /* skip if dir missing */ }

  return ingredients;
}

const INGREDIENTS = loadIngredients();

const DAYS_BACK = 8;
const DRAFT_DIR = path.join(__dirname, '..', 'backlog', 'research-review-drafts');
const STUDY_INDEX_PATH = path.join(__dirname, '..', 'data', 'study-index.json');
const STUDIES_DIR = path.join(__dirname, '..', 'data', 'sources', 'studies');
const MAX_PUBMED = 3;
const MAX_CT = 2;
const MAX_BSKY = 3;

const BSKY_ACCOUNTS = [
  'biorxiv-pharma.bsky.social',
];

const STRONG_PUBMED_PATTERNS = [
  /meta-analysis/i,
  /systematic review/i,
  /umbrella review/i,
  /randomized/i,
  /randomised/i,
  /placebo/i,
  /trial/i,
  /supplementation/i,
  /human/i,
  /adults?/i,
];

const WEAK_PUBMED_PATTERNS = [
  /mice/i,
  /mouse/i,
  /murine/i,
  /rat/i,
  /zebrafish/i,
  /drosophila/i,
  /c\.? elegans/i,
  /nanoparticle/i,
  /in vitro/i,
  /cell line/i,
  /biosynthesis/i,
  /transition-state/i,
  /cultivars?/i,
  /wound healing/i,
];

const STRONG_CT_PATTERNS = [
  /supplement/i,
  /oral/i,
  /randomized/i,
  /randomised/i,
  /double blind/i,
  /placebo/i,
  /adults?/i,
  /healthy/i,
  /patients?/i,
];

const WEAK_CT_PATTERNS = [
  /validation/i,
  /nail and hair/i,
  /surgery/i,
  /labor induction/i,
  /cardiac amyloidosis/i,
  /moderate to severe asthma/i,
  /extremely preterm/i,
];

const TYPE_META = new Map([
  ['meta_analysis', { badge: 'Meta-Analysis', label: 'Meta-Analysis', evidence: 'high', rank: 5 }],
  ['systematic_review', { badge: 'Systematic Review', label: 'Systematic Review', evidence: 'moderate', rank: 4 }],
  ['human_rct', { badge: 'RCT', label: 'RCT', evidence: 'high', rank: 4 }],
  ['human_observational', { badge: 'Observational', label: 'Observational', evidence: 'moderate', rank: 3 }],
  ['expert_review', { badge: 'Review', label: 'Review', evidence: 'low', rank: 2 }],
  ['preclinical', { badge: 'Preclinical', label: 'Preclinical', evidence: 'low', rank: 1 }],
  ['journal_article', { badge: 'Journal Article', label: 'Journal Article', evidence: 'low', rank: 2 }],
  ['unknown', { badge: 'Study', label: 'Study', evidence: 'low', rank: 0 }],
]);

function getDateRange() {
  const to = new Date();
  const from = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '/');
  const isoFmt = d => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to), fromIso: isoFmt(from), toIso: isoFmt(to) };
}

function esc(str) {
  return String(str ?? '').replace(/"/g, '\\"');
}

function truncate(str, max = 180) {
  const s = String(str ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function yamlQuote(str) {
  return `'${String(str ?? '').replace(/'/g, "''")}'`;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function registryPmidsFromDir() {
  try {
    return new Set(
      fs.readdirSync(STUDIES_DIR)
        .filter(name => /^pmid-\d+\.ya?ml$/i.test(name))
        .map(name => name.match(/pmid-(\d+)/i)?.[1])
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function normalizeStoredStudyType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (raw === 'rct' || raw.includes('randomized') || raw.includes('randomised') || raw.includes('clinical trial')) return 'human_rct';
  if (raw.includes('meta-analysis')) return 'meta_analysis';
  if (raw.includes('systematic review')) return 'systematic_review';
  if (raw.includes('observational') || raw.includes('comparative') || raw.includes('evaluation study') || raw.includes('validation study') || raw.includes('case report') || raw.includes('twin study')) return 'human_observational';
  if (raw.includes('review')) return 'expert_review';
  if (raw.includes('journal article')) return 'journal_article';
  return 'unknown';
}

function normalizePubTypes(pubtypes = [], title = '') {
  const joined = `${pubtypes.join(' | ')} | ${title}`.toLowerCase();
  const preclinical = /(mice|mouse|murine|rat|zebrafish|drosophila|c\.? elegans|in vitro|cell line)/i.test(title);
  if (joined.includes('meta-analysis')) return 'meta_analysis';
  if (joined.includes('systematic review')) return 'systematic_review';
  if (joined.includes('randomized controlled trial') || joined.includes('controlled clinical trial') || joined.includes('clinical trial') || joined.includes('multicenter study')) return 'human_rct';
  if (joined.includes('observational study') || joined.includes('comparative study') || joined.includes('evaluation study') || joined.includes('validation study') || joined.includes('case reports') || joined.includes('case report') || joined.includes('twin study')) return 'human_observational';
  if (preclinical) return 'preclinical';
  if (joined.includes('review')) return 'expert_review';
  if (joined.includes('journal article')) return 'journal_article';
  return 'unknown';
}

function typeMeta(typeKey) {
  return TYPE_META.get(typeKey) ?? TYPE_META.get('unknown');
}

function isAnimalOrInVitro(text) {
  return /(mice|mouse|murine|rat|zebrafish|drosophila|c\.? elegans|in vitro|cell line)/i.test(text);
}

function loadRegistryContext() {
  const index = readJson(STUDY_INDEX_PATH, { studies: [] });
  const registryPmids = registryPmidsFromDir();
  const ingredientStats = new Map();

  for (const study of index.studies ?? []) {
    const typeKey = normalizeStoredStudyType(study.study_type);
    const rank = typeMeta(typeKey).rank;
    for (const slug of study.ingredients ?? []) {
      const current = ingredientStats.get(slug) ?? { count: 0, bestRank: 0 };
      current.count += 1;
      current.bestRank = Math.max(current.bestRank, rank);
      ingredientStats.set(slug, current);
    }
    if (study.pmid) registryPmids.add(String(study.pmid));
  }

  return { registryPmids, ingredientStats };
}

function computeRelevance(record, ingredientStat) {
  const count = ingredientStat?.count ?? 0;
  const bestRank = ingredientStat?.bestRank ?? 0;
  const typeKey = record.typeKey;
  const meta = typeMeta(typeKey);
  const animal = isAnimalOrInVitro(`${record.title} ${record.journal} ${record.pubtypes?.join(' ')}`);
  let level = 'LOW';
  let reason = 'Existing registry for this ingredient is already broad.';

  if (animal || typeKey === 'preclinical') {
    level = 'LOW';
    reason = 'Animal / in-vitro signal — keep an eye on it, but no urgent dossier change.';
  } else if ((typeKey === 'human_rct' || typeKey === 'meta_analysis') && count <= 5) {
    level = 'HIGH';
    reason = 'Strong study design for an ingredient with a still-thin study registry.';
  } else if (meta.rank > bestRank) {
    level = 'HIGH';
    reason = 'Study type is stronger than the current best evidence stored for this ingredient.';
  } else if ((typeKey === 'expert_review' || typeKey === 'systematic_review' || typeKey === 'human_observational') && count < 8) {
    level = 'MEDIUM';
    reason = 'Potentially useful context because the ingredient still has limited tracked studies.';
  } else if (count >= 8) {
    level = 'LOW';
    reason = 'Ingredient already has a deeper registry; this is less likely to change the dossier.';
  }

  return {
    level,
    reason,
    action: level === 'HIGH' ? `Update dossier ${record.slug} — add to key_studies` : '',
  };
}

function authorsToShort(authors = []) {
  const first = authors.find(a => a?.name)?.name ?? '';
  return first ? `${first} et al.` : '';
}

function createStudyYamlStub(record) {
  const filePath = path.join(STUDIES_DIR, `pmid-${record.pmid}.yaml`);
  if (fs.existsSync(filePath)) return false;
  const meta = typeMeta(record.typeKey);
  const year = String(record.year ?? '').match(/\d{4}/)?.[0] ?? '';
  const yaml = [
    '---',
    `id: pmid-${record.pmid}`,
    'type: study',
    `pmid: ${yamlQuote(record.pmid)}`,
    `title: ${yamlQuote(record.title)}`,
    `authors: ${yamlQuote(record.authorsShort || '')}`,
    `year: ${year || 'null'}`,
    `url: https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`,
    `study_type: ${meta.label}`,
    `evidence_quality: ${meta.evidence}`,
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(filePath, yaml, 'utf8');
  return true;
}

function buildAutoExtractedSection(autoExtracted) {
  if (!autoExtracted || !autoExtracted.length) return '';
  let out = `## Auto-Extrahierte Studien (KG Auto-Extractor)\n\n`;
  out += `${autoExtracted.length} neue YAML-Stubs wurden automatisch via Claude Sonnet geschrieben (confidence ≥ 0.90):\n\n`;
  for (const s of autoExtracted) {
    out += `- **[${s.study_type}] ${s.title}**  \n`;
    out += `  Wirkstoff: ${s.ingredient} · PMID: ${s.pmid} · Confidence: ${s.confidence}  \n`;
    out += `  Datei: \`${s.filePath}\`  \n`;
    out += `  Link: https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/\n`;
  }
  out += '\n';
  return out;
}

function buildDraft(results, fromIso, toIso, autoExtracted = []) {
  const title = `Neue Forschung der Woche (${toIso})`;
  const touched = results.map(r => r.slug);
  const summary = truncate(
    results.length === 0
      ? 'Diese Woche wurden keine relevanten neuen Papers oder Trials für die beobachteten MikroScore-Wirkstoffe gefunden.'
      : `Wöchentliche MikroScore-Research-Review mit KG-Scoring, Registry-Check und neuen Papers für ${results.length} beobachtete Wirkstoffe.`
  , 200);

  const highTotal = results.reduce((sum, r) => sum + r.pubmed.filter(p => p.relevance.level === 'HIGH').length, 0);
  const newRegistryTotal = results.reduce((sum, r) => sum + r.pubmed.filter(p => !p.existsInRegistry).length, 0);
  const stubTotal = results.reduce((sum, r) => sum + r.pubmed.filter(p => p.stubCreated).length, 0);

  const topHighlights = results.slice(0, 5).map(r => {
    const count = r.pubmed.length + r.efsa.length + r.ct.length + (r.bsky?.length ?? 0);
    const high = r.pubmed.filter(p => p.relevance.level === 'HIGH').length;
    const parts = [`${r.pubmed.length} PubMed`, `${r.efsa.length} EFSA`, `${r.ct.length} Trials`];
    if (r.bsky?.length) parts.push(`${r.bsky.length} Preprints`);
    if (high) parts.push(`${high} HIGH`);
    return `- **${r.slug}**: ${count} neue Treffer (${parts.join(', ')})`;
  }).join('\n');

  const sections = results.map(r => {
    const total = r.pubmed.length + r.efsa.length + r.ct.length + (r.bsky?.length ?? 0);
    let out = `## ${r.slug}\n\n`;
    out += `**Neue Treffer gesamt:** ${total}  \n`;
    out += `**KG-Studien im Registry:** ${r.registryCount}\n\n`;

    if (r.pubmed.length) {
      out += `### PubMed\n\n`;
      for (const p of r.pubmed) {
        const registryNote = p.existsInRegistry ? ' (already in registry)' : ' (new)';
        const stubNote = p.stubCreated ? ' (stub created)' : '';
        out += `- **[${p.badge}] ${p.title}** ${p.relevance.level === 'HIGH' ? '🔴 HIGH' : p.relevance.level === 'MEDIUM' ? '🟡 MEDIUM' : '⚪ LOW'}${registryNote}${stubNote}  \n`;
        out += `  Journal: ${p.journal || 'n/a'} · Datum: ${p.date || 'n/a'} · PMID: ${p.pmid}  \n`;
        out += `  PubType: ${p.pubtypes?.join(', ') || 'n/a'}  \n`;
        out += `  Link: https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/  \n`;
        out += `  Einordnung: ${p.relevance.reason}  \n`;
        if (p.relevance.action) out += `  → Suggested action: ${p.relevance.action}  \n`;
      }
      out += `\n`;
    }

    if (r.efsa.length) {
      out += `### EFSA\n\n`;
      for (const e of r.efsa) {
        out += `- **${e.title}**  \n`;
        out += `  Link: ${e.url}\n`;
      }
      out += `\n`;
    }

    if (r.ct.length) {
      out += `### ClinicalTrials.gov\n\n`;
      for (const c of r.ct) {
        out += `- **${c.title}**  \n`;
        out += `  Status: ${c.status || 'n/a'}${c.phase ? ` · Phase: ${c.phase}` : ''}${c.startDate ? ` · Start: ${c.startDate}` : ''}  \n`;
        out += `  Link: https://clinicaltrials.gov/study/${c.nctId}\n`;
      }
      out += `\n`;
    }

    if (r.bsky?.length) {
      out += `### bioRxiv / Preprints (via Bluesky)\n\n`;
      for (const b of r.bsky) {
        out += `- **${b.title}**  \n`;
        out += `  Datum: ${b.date || 'n/a'}  \n`;
        if (b.url) out += `  Link: ${b.url}\n`;
      }
      out += `\n`;
    }

    out += `### MikroScore-Einordnung\n\n`;
    out += `- HIGH-Treffer zuerst prüfen und nur dann ins öffentliche Review ziehen, wenn sie wirklich das Dossier verändern.\n`;
    out += `- Registry-Status gegen bestehende key_studies abgleichen, bevor neue PMIDs übernommen werden.\n`;
    out += `- EFSA-/Claim-Relevanz separat gegen bestehende Claims prüfen.\n\n`;
    return out;
  }).join('\n');

  return `---
title: "${esc(title)}"
slug: "${toIso}"
publishedAt: ${toIso}
summary: "${esc(summary)}"
status: "draft"
tags:
${touched.map(tag => `  - ${tag}`).join('\n')}
---

# ${title}

## Kurzfazit

${results.length === 0 ? 'Diese Woche gab es keine relevanten neuen Papers oder Trial-Updates für die beobachteten MikroScore-Wirkstoffe.' : topHighlights}

## KG-Check

- **HIGH-Relevance PubMed-Treffer:** ${highTotal}
- **Neue PMIDs außerhalb des Registry:** ${newRegistryTotal}
- **Auto-erzeugte Study-Stubs:** ${stubTotal}

## Rohentwurf

Dieser Entwurf wurde automatisch aus dem wöchentlichen Research-Run erzeugt und **muss vor Veröffentlichung manuell geprüft** werden.

- Zeitraum: **${fromIso} bis ${toIso}**
- Quellen: **PubMed, EFSA Journal, ClinicalTrials.gov, Bluesky/bioRxiv**
- Zusatzlogik: **KG-Registry-Check, Study-Type-Badges, Relevance-Scoring**
- Status: **Draft / nicht veröffentlicht**

${buildAutoExtractedSection(autoExtracted)}${sections || '## Keine relevanten Treffer\n'}## Nächste Schritte

- HIGH-Treffer auf echte Dossier-Relevanz prüfen
- ggf. neue PMIDs in \`key_studies\` + \`targets\` übernehmen
- nur hochwertige Signale in einen öffentlichen Research-Review übernehmen
`;
}

function writeDraft(results, fromIso, toIso, autoExtracted = []) {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  const filePath = path.join(DRAFT_DIR, `${toIso}.mdx`);
  fs.writeFileSync(filePath, buildDraft(results, fromIso, toIso, autoExtracted), 'utf8');
  return filePath;
}

function scoreByPatterns(text, positive, negative) {
  let score = 0;
  for (const pattern of positive) if (pattern.test(text)) score += 2;
  for (const pattern of negative) if (pattern.test(text)) score -= 3;
  return score;
}

function filterPubMedRecords(records) {
  return records
    .map(r => ({
      ...r,
      _score: scoreByPatterns(`${r.title} ${r.journal} ${r.date} ${r.pubtypes?.join(' ') || ''}`, STRONG_PUBMED_PATTERNS, WEAK_PUBMED_PATTERNS),
    }))
    .filter(r => r._score >= 1)
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_PUBMED)
    .map(({ _score, ...rest }) => rest);
}

function filterClinicalTrials(records) {
  return records
    .map(r => ({
      ...r,
      _score: scoreByPatterns(`${r.title} ${r.status} ${r.phase} ${r.startDate}`, STRONG_CT_PATTERNS, WEAK_CT_PATTERNS),
    }))
    .filter(r => r._score >= 1)
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_CT)
    .map(({ _score, ...rest }) => rest);
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── PubMed ──────────────────────────────────────────────────────────────────

async function searchPubMed(query, from, to) {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: `(${query}) AND ("${from}"[PDAT]:"${to}"[PDAT])`,
    retmax: '5',
    sort: 'relevance',
    retmode: 'json',
  });
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`);
  if (!res.ok) throw new Error(`PubMed search ${res.status}`);
  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

async function fetchPubMedTitles(ids) {
  if (!ids.length) return [];
  const params = new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json' });
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params}`);
  if (!res.ok) throw new Error(`PubMed summary ${res.status}`);
  const data = await res.json();
  return ids.map(id => {
    const rec = data.result?.[id];
    if (!rec) return null;
    return {
      pmid: id,
      title: rec.title ?? '(no title)',
      journal: rec.source ?? '',
      date: rec.pubdate ?? '',
      year: rec.pubdate?.match(/\d{4}/)?.[0] ?? '',
      pubtypes: rec.pubtype ?? [],
      authors: rec.authors ?? [],
      authorsShort: authorsToShort(rec.authors ?? []),
    };
  }).filter(Boolean);
}

// ── EFSA ─────────────────────────────────────────────────────────────────────
// Uses the EFSA Journal RSS feed (public, no auth needed) and filters by keyword + date

let _efsaCache = null;

async function getEfsaFeed() {
  if (_efsaCache) return _efsaCache;
  const res = await fetch('https://efsa.onlinelibrary.wiley.com/feed/18314732/most-recent', {
    headers: { 'User-Agent': 'MikroScore-Digest/1.0' }
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of itemBlocks) {
    const link = block.match(/<link>(https?[^<]+)<\/link>/)?.[1] ?? '';
    const title = block.match(/<dc:title>([\s\S]*?)<\/dc:title>/)?.[1]?.trim()
                ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? '';
    const desc = block.match(/<dc:description>([\s\S]*?)<\/dc:description>/)?.[1]?.trim() ?? '';
    items.push({ title: title.replace(/<[^>]+>/g, ''), link, pubDate, desc: desc.replace(/<[^>]+>/g, '') });
  }
  _efsaCache = items;
  return items;
}

async function searchEFSA(term, fromIso) {
  try {
    const items = await getEfsaFeed();
    const cutoff = new Date(fromIso).getTime();
    const termLower = term.toLowerCase();
    return items
      .filter(item => {
        const dateMs = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        const textMatch = item.title.toLowerCase().includes(termLower)
                       || item.desc.toLowerCase().includes(termLower);
        return textMatch && dateMs >= cutoff;
      })
      .slice(0, 2)
      .map(item => ({ title: item.title, url: item.link }));
  } catch {
    return [];
  }
}

// ── ClinicalTrials.gov ───────────────────────────────────────────────────────

async function searchClinicalTrials(term, fromIso) {
  const params = new URLSearchParams({
    'query.term': term,
    'filter.advanced': `AREA[StartDate]RANGE[${fromIso}, MAX]`,
    'fields': 'NCTId,BriefTitle,OverallStatus,StartDate,Phase',
    'pageSize': '5',
    'format': 'json',
  });
  try {
    const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
      headers: { 'User-Agent': 'MikroScore-Digest/1.0' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const studies = data.studies ?? [];
    return studies.map(s => {
      const p = s.protocolSection;
      return {
        nctId: p?.identificationModule?.nctId ?? '',
        title: p?.identificationModule?.briefTitle ?? '(no title)',
        status: p?.statusModule?.overallStatus ?? '',
        phase: p?.designModule?.phases?.join(', ') ?? '',
        startDate: p?.statusModule?.startDateStruct?.date ?? '',
      };
    }).filter(s => s.nctId);
  } catch {
    return [];
  }
}

// ── Bluesky / bioRxiv ────────────────────────────────────────────────────────

let _bskyCache = null;

async function getBskyPosts(fromIso) {
  if (_bskyCache) return _bskyCache;
  const posts = [];
  for (const actor of BSKY_ACCOUNTS) {
    try {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${actor}&limit=50`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const cutoff = new Date(fromIso).getTime();
      for (const item of data.feed ?? []) {
        const post = item.post;
        const text = post.record?.text ?? '';
        const createdAt = post.record?.createdAt ?? '';
        if (new Date(createdAt).getTime() < cutoff) continue;
        const urls = [];
        for (const facet of post.record?.facets ?? []) {
          for (const feat of facet.features ?? []) {
            if (feat.uri) urls.push(feat.uri);
          }
        }
        if (!urls.length) {
          const urlMatch = text.match(/https?:\/\/[^\s]+/g);
          if (urlMatch) urls.push(...urlMatch);
        }
        posts.push({ text: text.slice(0, 300), url: urls[0] ?? '', date: createdAt.slice(0, 10), actor });
      }
    } catch (e) { console.error(`Bluesky/${actor}: ${e.message}`); }
  }
  _bskyCache = posts;
  return posts;
}

function deriveBskyTerms(ing) {
  const raw = ing.pubmed.replace(/"/g, '').replace(/ OR /g, '|').replace(/ AND /g, '|');
  const terms = raw.split('|')
    .map(t => t.replace(/\(|\)/g, '').trim())
    .filter(t => t.length >= 3 && !['supplement', 'supplementation', 'randomized', 'human', 'clinical', 'aging', 'longevity', 'cognitive', 'performance', 'sleep', 'inflammation', 'thyroid', 'adults'].includes(t.toLowerCase()));
  terms.unshift(ing.slug.replace(/-/g, ' '));
  return [...new Set(terms.map(t => t.toLowerCase()))];
}

async function searchBsky(terms, fromIso) {
  try {
    const posts = await getBskyPosts(fromIso);
    return posts
      .filter(p => terms.some(t => p.text.toLowerCase().includes(t)))
      .slice(0, MAX_BSKY)
      .map(p => ({
        title: p.text.replace(/https?:\/\/\S+/g, '').trim().slice(0, 150),
        url: p.url,
        date: p.date,
      }));
  } catch { return []; }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { from, to, fromIso, toIso } = getDateRange();
  const results = [];
  const registry = loadRegistryContext();

  // Auto-extract new RCT studies via Sonnet (if API key available)
  let autoExtractResults = { autoExtracted: [], reviewQueue: [] };
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { runExtraction } = await import('./kg-auto-extractor.js');
      autoExtractResults = await runExtraction({ daysBack: DAYS_BACK, dryRun: false });
    } catch (e) { console.error('Auto-extractor failed:', e.message); }
  }

  for (const ing of INGREDIENTS) {
    const registryStat = registry.ingredientStats.get(ing.slug) ?? { count: 0, bestRank: 0 };
    const entry = { slug: ing.slug, registryCount: registryStat.count, pubmed: [], efsa: [], ct: [], bsky: [] };

    try {
      const ids = await searchPubMed(ing.pubmed, from, to);
      if (ids.length) {
        const fetched = filterPubMedRecords(await fetchPubMedTitles(ids));
        entry.pubmed = fetched.map(record => {
          const typeKey = normalizePubTypes(record.pubtypes, record.title);
          const existsInRegistry = registry.registryPmids.has(record.pmid);
          const enriched = {
            ...record,
            slug: ing.slug,
            typeKey,
            badge: typeMeta(typeKey).badge,
            existsInRegistry,
          };
          const relevance = computeRelevance(enriched, registryStat);
          const stubCreated = !existsInRegistry && relevance.level === 'HIGH' ? createStudyYamlStub(enriched) : false;
          if (!existsInRegistry) registry.registryPmids.add(record.pmid);
          return { ...enriched, relevance, stubCreated };
        });
      }
      await delay(400);
    } catch (e) { console.error(`PubMed/${ing.slug}: ${e.message}`); }

    try {
      entry.efsa = await searchEFSA(ing.efsa, fromIso);
    } catch (e) { console.error(`EFSA/${ing.slug}: ${e.message}`); }

    try {
      entry.ct = filterClinicalTrials(await searchClinicalTrials(ing.ct, fromIso));
      await delay(300);
    } catch (e) { console.error(`CT/${ing.slug}: ${e.message}`); }

    try {
      const bskyTerms = deriveBskyTerms(ing);
      entry.bsky = await searchBsky(bskyTerms, fromIso);
    } catch (e) { console.error(`Bluesky/${ing.slug}: ${e.message}`); }

    if (entry.pubmed.length || entry.efsa.length || entry.ct.length || entry.bsky.length) {
      results.push(entry);
    }
  }

  const draftPath = writeDraft(results, fromIso, toIso, autoExtractResults.autoExtracted ?? []);
  const highCount = results.reduce((sum, r) => sum + r.pubmed.filter(p => p.relevance.level === 'HIGH').length, 0);
  const stubCount = results.reduce((sum, r) => sum + r.pubmed.filter(p => p.stubCreated).length, 0);

  if (results.length === 0) {
    console.log(`🔬 *MikroScore Research-Digest (${from} – ${to})*\n\nKeine neuen relevanten Studien oder Trials diese Woche.\n\n📝 Draft aktualisiert: \`${draftPath}\`\n\nKG-Upgrade aktiv, aber diese Woche ohne neue Treffer.`);
    return;
  }

  let msg = `🔬 *MikroScore Research-Digest (${from} – ${to})*\n`;
  msg += `Neue Treffer für ${results.length} Wirkstoffe · ${highCount} HIGH-Relevance · ${stubCount} neue Study-Stubs\n\n`;

  for (const r of results) {
    const total = r.pubmed.length + r.efsa.length + r.ct.length + (r.bsky?.length ?? 0);
    msg += `*${r.slug.toUpperCase()}* (${total} neu, Registry ${r.registryCount})\n`;

    if (r.pubmed.length) {
      msg += `📄 PubMed (${r.pubmed.length}):\n`;
      for (const p of r.pubmed.slice(0, 2)) {
        const flag = p.relevance.level === 'HIGH' ? '🔴' : p.relevance.level === 'MEDIUM' ? '🟡' : '⚪';
        const registryNote = p.existsInRegistry ? ' · im Registry' : ' · neu';
        const stubNote = p.stubCreated ? ' · stub' : '';
        msg += `• [${p.badge}] ${p.title.slice(0, 90)}${p.title.length > 90 ? '…' : ''} ${flag}${registryNote}${stubNote}\n`;
        msg += `  https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/\n`;
      }
    }

    if (r.efsa.length) {
      msg += `🇪🇺 EFSA (${r.efsa.length}):\n`;
      for (const e of r.efsa.slice(0, 1)) {
        msg += `• ${e.title.slice(0, 100)}${e.title.length > 100 ? '…' : ''}\n`;
        msg += `  ${e.url}\n`;
      }
    }

    if (r.ct.length) {
      msg += `🧪 ClinicalTrials (${r.ct.length}):\n`;
      for (const c of r.ct.slice(0, 2)) {
        const phase = c.phase ? ` [${c.phase}]` : '';
        msg += `• ${c.title.slice(0, 100)}${c.title.length > 100 ? '…' : ''}${phase}\n`;
        msg += `  https://clinicaltrials.gov/study/${c.nctId}\n`;
      }
    }

    if (r.bsky?.length) {
      msg += `🦋 bioRxiv/Preprints (${r.bsky.length}):\n`;
      for (const b of r.bsky.slice(0, 2)) {
        msg += `• ${b.title.slice(0, 100)}${b.title.length > 100 ? '…' : ''}\n`;
        if (b.url) msg += `  ${b.url}\n`;
      }
    }

    msg += '\n';
  }

  msg += `📝 Draft: \`${draftPath}\`\n\n`;
  msg += `---\n_Quellen: PubMed · EFSA Journal · ClinicalTrials.gov · Bluesky/bioRxiv_\n_KG-Upgrade aktiv: Registry-Check, Study-Type-Badges, Relevance-Scoring, Auto-Study-Stubs._`;

  console.log(msg);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
