#!/usr/bin/env node
/**
 * MikroScore Weekly Research Digest
 * Sources: PubMed, EFSA Journal, ClinicalTrials.gov
 * Runs every Saturday 08:00 via OpenClaw cron.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INGREDIENTS = [
  { slug: 'nmn',          pubmed: 'NMN OR "nicotinamide mononucleotide"',                     efsa: 'nicotinamide mononucleotide', ct: 'NMN supplement' },
  { slug: 'nr',           pubmed: '"nicotinamide riboside"',                                   efsa: 'nicotinamide riboside',       ct: 'nicotinamide riboside' },
  { slug: 'ashwagandha',  pubmed: 'ashwagandha OR "withania somnifera"',                       efsa: 'withania somnifera',          ct: 'ashwagandha' },
  { slug: 'omega-3',      pubmed: '"omega-3" OR "EPA DHA" OR "fish oil" supplement',           efsa: 'omega-3',                     ct: 'omega-3 fatty acids' },
  { slug: 'magnesium',    pubmed: 'magnesium supplementation "randomized"',                    efsa: 'magnesium',                   ct: 'magnesium supplement' },
  { slug: 'vitamin-d3',   pubmed: '"vitamin D" supplementation "randomized controlled trial"', efsa: 'vitamin D',                   ct: 'vitamin D supplement' },
  { slug: 'coq10',        pubmed: '"coenzyme Q10" OR CoQ10 supplementation',                   efsa: 'coenzyme Q10',                ct: 'CoQ10 supplement' },
  { slug: 'berberine',    pubmed: 'berberine supplementation "randomized"',                    efsa: 'berberine',                   ct: 'berberine' },
  { slug: 'curcumin',     pubmed: 'curcumin OR curcuminoid supplementation "randomized"',      efsa: 'curcumin',                    ct: 'curcumin supplement' },
  { slug: 'resveratrol',  pubmed: 'resveratrol supplementation human',                         efsa: 'resveratrol',                 ct: 'resveratrol' },
  { slug: 'kreatin',      pubmed: 'creatine supplementation "randomized" cognitive OR aging',  efsa: 'creatine',                    ct: 'creatine supplement' },
  { slug: 'glycin',       pubmed: 'glycine supplementation aging OR sleep OR inflammation',    efsa: 'glycine',                     ct: 'glycine supplement' },
  { slug: 'taurin',       pubmed: 'taurine supplementation aging OR longevity',                efsa: 'taurine',                     ct: 'taurine supplement' },
  { slug: 'fisetin',      pubmed: 'fisetin supplementation human OR clinical',                 efsa: 'fisetin',                     ct: 'fisetin' },
  { slug: 'quercetin',    pubmed: 'quercetin supplementation "randomized"',                    efsa: 'quercetin',                   ct: 'quercetin supplement' },
  { slug: 'spermidine',   pubmed: 'spermidine supplementation human',                          efsa: 'spermidine',                  ct: 'spermidine' },
  { slug: 'urolithin-a',  pubmed: '"urolithin A" supplementation human',                       efsa: 'urolithin',                   ct: 'urolithin A' },
  { slug: 'selen',        pubmed: 'selenium supplementation "randomized" aging OR thyroid',    efsa: 'selenium',                    ct: 'selenium supplement' },
  { slug: 'lion-s-mane',  pubmed: '"lion mane" OR "hericium erinaceus" supplementation human', efsa: 'hericium erinaceus',         ct: 'lion mane mushroom' },
  { slug: 'rhodiola',     pubmed: '"rhodiola rosea" supplementation "randomized"',             efsa: 'rhodiola rosea',              ct: 'rhodiola supplement' },
  { slug: 'koffein',      pubmed: 'caffeine supplementation "randomized" performance OR cognitive', efsa: 'caffeine',              ct: 'caffeine supplement' },
  { slug: 'l-citrullin',  pubmed: '"L-citrulline" supplementation "randomized"',              efsa: 'citrulline',                  ct: 'L-citrulline' },
  { slug: 'betain',       pubmed: 'betaine anhydrous supplementation "randomized"',            efsa: 'betaine',                     ct: 'betaine supplement' },
  { slug: 'l-tyrosin',    pubmed: '"L-tyrosine" supplementation cognitive "randomized"',       efsa: 'tyrosine',                    ct: 'L-tyrosine' },
  { slug: 'beta-alanin',  pubmed: '"beta-alanine" supplementation "randomized"',              efsa: 'beta-alanine',                ct: 'beta-alanine' },
];

const DAYS_BACK = 8;
const DRAFT_DIR = path.join(__dirname, '..', 'backlog', 'research-review-drafts');
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

function buildDraft(results, fromIso, toIso) {
  const title = `Neue Forschung der Woche (${toIso})`;
  const touched = results.map(r => r.slug);
  const summary = truncate(
    results.length === 0
      ? 'Diese Woche wurden keine relevanten neuen Papers oder Trials für die beobachteten MikroScore-Wirkstoffe gefunden.'
      : `Wöchentliche MikroScore-Research-Review mit neuen Papers, EFSA-Treffern und Clinical-Trial-Updates für ${results.length} beobachtete Wirkstoffe.`
  , 200);

  const topHighlights = results.slice(0, 5).map(r => {
    const count = r.pubmed.length + r.efsa.length + r.ct.length + (r.bsky?.length ?? 0);
    const parts = [`${r.pubmed.length} PubMed`, `${r.efsa.length} EFSA`, `${r.ct.length} Trials`];
    if (r.bsky?.length) parts.push(`${r.bsky.length} Preprints`);
    return `- **${r.slug}**: ${count} neue Treffer (${parts.join(', ')})`;
  }).join('\n');

  const sections = results.map(r => {
    const total = r.pubmed.length + r.efsa.length + r.ct.length + (r.bsky?.length ?? 0);
    let out = `## ${r.slug}\n\n`;
    out += `**Neue Treffer gesamt:** ${total}\n\n`;

    if (r.pubmed.length) {
      out += `### PubMed\n\n`;
      for (const p of r.pubmed) {
        out += `- **${p.title}**  \n`;
        out += `  Journal: ${p.journal || 'n/a'} · Datum: ${p.date || 'n/a'}  \n`;
        out += `  Link: https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/\n`;
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
    out += `- Prüfen, ob bestehendes Dossier ${'`'}${r.slug}${'`'} aktualisiert werden sollte.\n`;
    out += `- Nur relevante Human-Daten oder starke Meta-Analysen später öffentlich hervorheben.\n`;
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

## Rohentwurf

Dieser Entwurf wurde automatisch aus dem wöchentlichen Research-Run erzeugt und **muss vor Veröffentlichung manuell geprüft** werden.

- Zeitraum: **${fromIso} bis ${toIso}**
- Quellen: **PubMed, EFSA Journal, ClinicalTrials.gov**
- Status: **Draft / nicht veröffentlicht**

${sections || '## Keine relevanten Treffer\n'}
## Nächste Schritte

- Relevante Treffer priorisieren
- ggf. Dossier-/Claim-Updates ableiten
- nur hochwertige Signale in einen öffentlichen Research-Review übernehmen
`;
}

function writeDraft(results, fromIso, toIso) {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  const filePath = path.join(DRAFT_DIR, `${toIso}.mdx`);
  fs.writeFileSync(filePath, buildDraft(results, fromIso, toIso), 'utf8');
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
      _score: scoreByPatterns(`${r.title} ${r.journal} ${r.date}`, STRONG_PUBMED_PATTERNS, WEAK_PUBMED_PATTERNS),
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
    return { pmid: id, title: rec.title ?? '(no title)', journal: rec.source ?? '', date: rec.pubdate ?? '' };
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
  // Parse items: extract title, link, pubDate, description
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
  // ClinicalTrials.gov v2 API
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
  // Extract searchable terms from the pubmed query string
  const raw = ing.pubmed.replace(/"/g, '').replace(/ OR /g, '|').replace(/ AND /g, '|');
  const terms = raw.split('|')
    .map(t => t.replace(/\(|\)/g, '').trim())
    .filter(t => t.length >= 3 && !['supplement', 'supplementation', 'randomized', 'human', 'clinical', 'aging', 'longevity', 'cognitive', 'performance', 'sleep', 'inflammation', 'thyroid', 'adults'].includes(t.toLowerCase()));
  // Also add the slug name
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

  for (const ing of INGREDIENTS) {
    const entry = { slug: ing.slug, pubmed: [], efsa: [], ct: [], bsky: [] };

    // PubMed
    try {
      const ids = await searchPubMed(ing.pubmed, from, to);
      if (ids.length) entry.pubmed = filterPubMedRecords(await fetchPubMedTitles(ids));
      await delay(400); // respect rate limit
    } catch (e) { console.error(`PubMed/${ing.slug}: ${e.message}`); }

    // EFSA (RSS is fetched once and cached – no hammering)
    try {
      entry.efsa = await searchEFSA(ing.efsa, fromIso);
    } catch (e) { console.error(`EFSA/${ing.slug}: ${e.message}`); }

    // ClinicalTrials.gov
    try {
      entry.ct = filterClinicalTrials(await searchClinicalTrials(ing.ct, fromIso));
      await delay(300);
    } catch (e) { console.error(`CT/${ing.slug}: ${e.message}`); }

    // Bluesky / bioRxiv preprints
    try {
      const bskyTerms = deriveBskyTerms(ing);
      entry.bsky = await searchBsky(bskyTerms, fromIso);
    } catch (e) { console.error(`Bluesky/${ing.slug}: ${e.message}`); }

    if (entry.pubmed.length || entry.efsa.length || entry.ct.length || entry.bsky.length) {
      results.push(entry);
    }
  }

  const draftPath = writeDraft(results, fromIso, toIso);

  // ── Format digest ──────────────────────────────────────────────────────────

  if (results.length === 0) {
    console.log(`🔬 *MikroScore Research-Digest (${from} – ${to})*\n\nKeine neuen relevanten Studien oder Trials diese Woche.\n\n📝 Draft aktualisiert: \`${draftPath}\`\n\nKein Auto-Update – bei interessanten Studien bitte manuell prüfen.`);
    return;
  }

  let msg = `🔬 *MikroScore Research-Digest (${from} – ${to})*\n`;
  msg += `Neue Treffer für ${results.length} Wirkstoffe:\n\n`;

  for (const r of results) {
    const total = r.pubmed.length + r.efsa.length + r.ct.length + (r.bsky?.length ?? 0);
    msg += `*${r.slug.toUpperCase()}* (${total} neu)\n`;

    if (r.pubmed.length) {
      msg += `📄 PubMed (${r.pubmed.length}):\n`;
      for (const p of r.pubmed.slice(0, 2)) {
        msg += `• ${p.title.slice(0, 100)}${p.title.length > 100 ? '…' : ''}\n`;
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
      msg += `🧪 ClinicalTrials (${r.ct.length} neue Studien):\n`;
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
  msg += `---\n_Quellen: PubMed · EFSA Journal · ClinicalTrials.gov · Bluesky/bioRxiv_\n_Kein Auto-Update – bei interessanten Studien bitte manuell prüfen._`;

  console.log(msg);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
