#!/usr/bin/env node
/**
 * PubMed Weekly Digest for MikroScore
 * Checks PubMed for new RCTs/meta-analyses for all ingredients
 * and sends a Telegram digest.
 *
 * Runs every Saturday 08:00 via OpenClaw cron.
 */

// ES module – no require needed

// Top ingredients to monitor (focus on most important ones)
const INGREDIENTS = [
  { slug: 'nmn', query: 'NMN OR "nicotinamide mononucleotide"' },
  { slug: 'nr', query: '"nicotinamide riboside"' },
  { slug: 'ashwagandha', query: 'ashwagandha OR "withania somnifera"' },
  { slug: 'omega-3', query: '"omega-3" OR "EPA DHA" OR "fish oil" supplement' },
  { slug: 'magnesium', query: 'magnesium supplementation "randomized"' },
  { slug: 'vitamin-d3', query: '"vitamin D" supplementation "randomized controlled trial"' },
  { slug: 'coq10', query: '"coenzyme Q10" OR CoQ10 supplementation' },
  { slug: 'berberine', query: 'berberine supplementation "randomized"' },
  { slug: 'curcumin', query: 'curcumin OR curcuminoid supplementation "randomized"' },
  { slug: 'resveratrol', query: 'resveratrol supplementation human' },
  { slug: 'kreatin', query: 'creatine supplementation "randomized" cognitive OR aging' },
  { slug: 'glycin', query: 'glycine supplementation aging OR sleep OR inflammation' },
  { slug: 'taurin', query: 'taurine supplementation aging OR longevity' },
  { slug: 'fisetin', query: 'fisetin supplementation human OR clinical' },
  { slug: 'quercetin', query: 'quercetin supplementation "randomized"' },
  { slug: 'spermidine', query: 'spermidine supplementation human' },
  { slug: 'urolithin-a', query: '"urolithin A" supplementation human' },
  { slug: 'selen', query: 'selenium supplementation "randomized" aging OR thyroid' },
  { slug: 'lion-s-mane', query: '"lion mane" OR "hericium erinaceus" supplementation human' },
  { slug: 'rhodiola', query: '"rhodiola rosea" supplementation "randomized"' },
];

// How many days back to look
const DAYS_BACK = 8; // slightly more than 7 to avoid gaps

function getDateRange() {
  const to = new Date();
  const from = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '/');
  return { from: fmt(from), to: fmt(to) };
}

async function searchPubMed(query, from, to) {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: `(${query}) AND ("${from}"[PDAT]:"${to}"[PDAT])`,
    retmax: '5',
    sort: 'relevance',
    retmode: 'json',
  });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed error ${res.status}`);
  const data = await res.json();
  const ids = data.esearchresult?.idlist ?? [];
  return ids;
}

async function fetchTitles(ids) {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'json',
  });
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed summary error ${res.status}`);
  const data = await res.json();
  return ids.map(id => {
    const rec = data.result?.[id];
    if (!rec) return null;
    return {
      pmid: id,
      title: rec.title ?? '(kein Titel)',
      journal: rec.source ?? '',
      date: rec.pubdate ?? '',
    };
  }).filter(Boolean);
}

async function main() {
  const { from, to } = getDateRange();
  const results = [];

  for (const ing of INGREDIENTS) {
    try {
      const ids = await searchPubMed(ing.query, from, to);
      if (ids.length > 0) {
        const papers = await fetchTitles(ids);
        results.push({ slug: ing.slug, papers });
      }
      // Rate limit: PubMed allows ~3 req/sec without API key
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.error(`Error for ${ing.slug}: ${e.message}`);
    }
  }

  // Format digest
  if (results.length === 0) {
    console.log(`🔬 *MikroScore PubMed-Digest (${from} – ${to})*\n\nKeine neuen relevanten Studien diese Woche.`);
    return;
  }

  let msg = `🔬 *MikroScore PubMed-Digest (${from} – ${to})*\n`;
  msg += `Neue Publikationen für ${results.length} Wirkstoffe:\n\n`;

  for (const r of results) {
    msg += `*${r.slug.toUpperCase()}* (${r.papers.length} neu):\n`;
    for (const p of r.papers.slice(0, 3)) {
      msg += `• ${p.title.slice(0, 120)}${p.title.length > 120 ? '…' : ''}\n`;
      msg += `  📄 https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/\n`;
    }
    msg += '\n';
  }

  msg += `---\n_Kein Auto-Update – bitte manuell prüfen ob Updates nötig sind._`;

  console.log(msg);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
