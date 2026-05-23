#!/usr/bin/env node
/**
 * MikroScore Weekly Research Digest
 * Sources: PubMed, EFSA Journal, ClinicalTrials.gov
 * Runs every Saturday 08:00 via OpenClaw cron.
 */

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

function getDateRange() {
  const to = new Date();
  const from = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '/');
  const isoFmt = d => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to), fromIso: isoFmt(from), toIso: isoFmt(to) };
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { from, to, fromIso } = getDateRange();
  const results = [];

  for (const ing of INGREDIENTS) {
    const entry = { slug: ing.slug, pubmed: [], efsa: [], ct: [] };

    // PubMed
    try {
      const ids = await searchPubMed(ing.pubmed, from, to);
      if (ids.length) entry.pubmed = await fetchPubMedTitles(ids);
      await delay(400); // respect rate limit
    } catch (e) { console.error(`PubMed/${ing.slug}: ${e.message}`); }

    // EFSA (RSS is fetched once and cached – no hammering)
    try {
      entry.efsa = await searchEFSA(ing.efsa, fromIso);
    } catch (e) { console.error(`EFSA/${ing.slug}: ${e.message}`); }

    // ClinicalTrials.gov
    try {
      entry.ct = await searchClinicalTrials(ing.ct, fromIso);
      await delay(300);
    } catch (e) { console.error(`CT/${ing.slug}: ${e.message}`); }

    if (entry.pubmed.length || entry.efsa.length || entry.ct.length) {
      results.push(entry);
    }
  }

  // ── Format digest ──────────────────────────────────────────────────────────

  if (results.length === 0) {
    console.log(`🔬 *MikroScore Research-Digest (${from} – ${to})*\n\nKeine neuen relevanten Studien oder Trials diese Woche.`);
    return;
  }

  let msg = `🔬 *MikroScore Research-Digest (${from} – ${to})*\n`;
  msg += `Neue Treffer für ${results.length} Wirkstoffe:\n\n`;

  for (const r of results) {
    const total = r.pubmed.length + r.efsa.length + r.ct.length;
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

    msg += '\n';
  }

  msg += `---\n_Quellen: PubMed · EFSA Journal · ClinicalTrials.gov_\n_Kein Auto-Update – bitte manuell prüfen ob Dossier-Updates nötig sind._`;

  console.log(msg);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
