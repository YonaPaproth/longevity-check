#!/usr/bin/env node
/**
 * KG Auto-Extractor
 * Fetches new PubMed abstracts for all YAML ingredients,
 * extracts structured data via Claude Sonnet API,
 * auto-writes high-confidence RCT stubs to registry.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/kg-auto-extractor.js
 *   ANTHROPIC_API_KEY=sk-... node scripts/kg-auto-extractor.js --dry-run
 *   ANTHROPIC_API_KEY=sk-... node scripts/kg-auto-extractor.js --days 14
 *
 * Integration: called by pubmed-digest.js as a module
 * Export: { autoExtracted: [], reviewQueue: [], errors: [] }
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const INGREDIENTS_DIR = path.join(ROOT, 'data', 'sources', 'ingredients');
const STUDIES_DIR = path.join(ROOT, 'data', 'sources', 'studies');
const QUERIES_PATH = path.join(ROOT, 'data', 'ingredient-queries.json');
const REVIEW_QUEUE_DIR = path.join(ROOT, 'backlog', 'review-queue');

const AUTO_WRITE_CONFIDENCE = 0.90;
const AUTO_WRITE_TYPES = new Set(['human_rct', 'meta_analysis']);
const DEFAULT_DAYS_BACK = 8;
const BATCH_SIZE = 5;

const RCT_PUBTYPES = new Set([
  'randomized controlled trial',
  'controlled clinical trial',
  'clinical trial',
  'multicenter study',
  'meta-analysis',
  'systematic review',
]);

const EXCLUDE_PUBTYPES = new Set([
  'review',
  'case report',
  'case reports',
  'preprint',
]);

const ANIMAL_PATTERN = /\b(mice|mouse|murine|rat\b|zebrafish|drosophila|c\.?\s*elegans|in vitro|cell line)\b/i;

const SYMPTOM_SLUGS = [
  'schlaf', 'energie', 'stress', 'kognition', 'immunsystem', 'blutzucker',
  'blutdruck', 'entzuendung', 'depression', 'gelenke', 'haut', 'muskel',
  'verdauung', 'alterung', 'oxidativer-stress', 'knochen', 'augen', 'leber',
  'schilddruese', 'fertilitat', 'migraene', 'neuroprotektiv', 'herz-kreislauf',
];

// ── Helpers ────────────────────────────────────────────────────────────────

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function yamlQuote(str) {
  return `'${String(str ?? '').replace(/'/g, "''")}'`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(daysBack) {
  const to = new Date();
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '/');
  return { from: fmt(from), to: fmt(to) };
}

// ── XML Parsing (regex-based, no external deps) ────────────────────────────

function extractAll(xml, tag) {
  const results = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].replace(/<[^>]+>/g, '').trim());
  }
  return results;
}

function extractFirst(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function parseArticles(xml) {
  const articles = [];
  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/gi) ?? [];

  for (const block of articleBlocks) {
    const pmid = extractFirst(block, 'PMID');
    if (!pmid) continue;

    const title = extractFirst(block, 'ArticleTitle');
    const abstractParts = extractAll(block, 'AbstractText');
    const abstractText = abstractParts.join(' ').replace(/\s+/g, ' ').trim();

    // Authors
    const authorBlocks = block.match(/<Author[^>]*>[\s\S]*?<\/Author>/gi) ?? [];
    const firstAuthor = (() => {
      if (!authorBlocks.length) return '';
      const last = extractFirst(authorBlocks[0], 'LastName');
      const first = extractFirst(authorBlocks[0], 'ForeName');
      return last ? (first ? `${last} ${first[0]}` : last) : extractFirst(authorBlocks[0], 'CollectiveName');
    })();

    // Publication types
    const pubtypes = extractAll(block, 'PublicationType').map(t => t.toLowerCase());

    // Year
    const year = extractFirst(block, 'Year') || extractFirst(block, 'PubDate').match(/\d{4}/)?.[0] || '';

    // Journal
    const journal = extractFirst(block, 'Title') || extractFirst(block, 'ISOAbbreviation');

    articles.push({ pmid, title, abstractText, pubtypes, firstAuthor, year, journal });
  }

  return articles;
}

// ── PubMed ─────────────────────────────────────────────────────────────────

async function esearch(query, from, to) {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: `(${query}) AND ("${from}"[PDAT]:"${to}"[PDAT])`,
    retmax: '10',
    sort: 'relevance',
    retmode: 'json',
  });
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`);
  if (!res.ok) throw new Error(`esearch HTTP ${res.status}`);
  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

async function efetch(ids) {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  });
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`);
  if (!res.ok) throw new Error(`efetch HTTP ${res.status}`);
  const xml = await res.text();
  return parseArticles(xml);
}

// ── RCT Filter ────────────────────────────────────────────────────────────

function isRctCandidate(article) {
  const { pubtypes, title } = article;

  // Exclude animal/in vitro by title
  if (ANIMAL_PATTERN.test(title)) return false;

  // Explicit excludes
  if (pubtypes.some(pt => EXCLUDE_PUBTYPES.has(pt) && !RCT_PUBTYPES.has(pt))) return false;

  // Must have at least one qualifying pubtype
  return pubtypes.some(pt => RCT_PUBTYPES.has(pt));
}

// ── Claude Sonnet Extraction ───────────────────────────────────────────────

async function extractWithSonnet(candidates, apiKey) {
  const results = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const abstractsText = batch.map((c, idx) =>
      `${idx + 1}. PMID ${c.pmid}: ${c.title} — ${c.abstractText || '(no abstract available)'}`
    ).join('\n\n');

    const prompt = `Extract structured supplement research data from these PubMed abstracts.
For each abstract, return a JSON object.

Available symptom slugs: ${SYMPTOM_SLUGS.join(', ')}

Return ONLY a valid JSON array (no prose, no markdown fences):
[{
  "pmid": "string",
  "study_type": "human_rct"|"meta_analysis"|"systematic_review"|"human_observational",
  "n": number|null,
  "dose_mg": number|null,
  "duration_weeks": number|null,
  "outcomes": [{ "symptom": "string", "direction": "positive"|"negative"|"null" }],
  "finding_en": "string (one sentence)",
  "finding_de": "string (one sentence, German)",
  "confidence": number (0.0-1.0)
}]

Abstracts:
${abstractsText}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';

      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`  ⚠ Batch ${Math.floor(i / BATCH_SIZE) + 1}: no JSON array in response`);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      // Merge with original candidate metadata
      for (const extracted of parsed) {
        const original = batch.find(c => c.pmid === String(extracted.pmid));
        if (original) {
          results.push({ ...extracted, _original: original });
        }
      }
    } catch (e) {
      console.error(`  ⚠ Sonnet batch error: ${e.message}`);
    }

    // Rate-limit between API calls
    if (i + BATCH_SIZE < candidates.length) await delay(500);
  }

  return results;
}

// ── Auto-write YAML stub ───────────────────────────────────────────────────

function studyTypeLabel(typeKey) {
  const map = {
    human_rct: 'RCT',
    meta_analysis: 'Meta-Analysis',
    systematic_review: 'Systematic Review',
    human_observational: 'Observational',
  };
  return map[typeKey] ?? typeKey;
}

function evidenceQuality(typeKey) {
  return (typeKey === 'human_rct' || typeKey === 'meta_analysis') ? 'high' : 'moderate';
}

function writeStudyStub(extracted, dryRun) {
  const { pmid, study_type, n, confidence } = extracted;
  const orig = extracted._original;
  const filePath = path.join(STUDIES_DIR, `pmid-${pmid}.yaml`);

  if (fs.existsSync(filePath)) return false;

  const yaml = [
    '---',
    `id: pmid-${pmid}`,
    'type: study',
    `pmid: ${yamlQuote(pmid)}`,
    `title: ${yamlQuote(orig?.title ?? '')}`,
    `authors: ${yamlQuote(orig?.firstAuthor ? `${orig.firstAuthor} et al.` : '')}`,
    `year: ${orig?.year || 'null'}`,
    `url: https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    `study_type: ${studyTypeLabel(study_type)}`,
    `evidence_quality: ${evidenceQuality(study_type)}`,
    `n: ${yamlQuote(n != null ? String(n) : '')}`,
    `auto_extracted: true`,
    `extraction_confidence: ${confidence}`,
    '---',
    '',
  ].join('\n');

  if (dryRun) {
    console.log(`  [dry-run] Would write: ${path.relative(ROOT, filePath)}`);
    console.log(`    study_type=${studyTypeLabel(study_type)}, n=${n}, confidence=${confidence}`);
  } else {
    fs.mkdirSync(STUDIES_DIR, { recursive: true });
    fs.writeFileSync(filePath, yaml, 'utf8');
  }

  return true;
}

// ── Review queue ──────────────────────────────────────────────────────────

function writeReviewQueue(queueItems, autoWrittenCount, dryRun) {
  const date = today();
  const outPath = path.join(REVIEW_QUEUE_DIR, `${date}.json`);

  const output = {
    generated: date,
    auto_written: autoWrittenCount,
    queued_for_review: queueItems,
  };

  if (dryRun) {
    console.log(`  [dry-run] Would write review queue: ${path.relative(ROOT, outPath)}`);
    console.log(`    auto_written=${autoWrittenCount}, queued=${queueItems.length}`);
  } else {
    fs.mkdirSync(REVIEW_QUEUE_DIR, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  }

  return outPath;
}

// ── Load ingredients ──────────────────────────────────────────────────────

function loadIngredientSlugs() {
  try {
    return fs.readdirSync(INGREDIENTS_DIR)
      .filter(f => /\.ya?ml$/i.test(f))
      .map(f => path.basename(f).replace(/\.ya?ml$/i, ''));
  } catch {
    return [];
  }
}

function loadQueries() {
  try {
    return JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function existingPmids() {
  try {
    return new Set(
      fs.readdirSync(STUDIES_DIR)
        .filter(f => /^pmid-\d+\.ya?ml$/i.test(f))
        .map(f => f.match(/pmid-(\d+)/i)?.[1])
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

// ── Main extraction logic ─────────────────────────────────────────────────

export async function runExtraction({ daysBack = DEFAULT_DAYS_BACK, dryRun = false } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const { from, to } = dateRange(daysBack);

  const slugs = loadIngredientSlugs();
  const queries = loadQueries();
  const knownPmids = existingPmids();

  console.log(`\n🔬 KG Auto-Extractor — ${today()}`);
  console.log(`   Ingredients: ${slugs.length} | Days back: ${daysBack} | Dry-run: ${dryRun}`);
  console.log(`   API key: ${apiKey ? 'present' : 'MISSING — extraction disabled'}\n`);

  const autoExtracted = [];
  const reviewQueue = [];
  const errors = [];

  // Accumulate all RCT candidates across all ingredients for batched Sonnet extraction
  const allCandidates = []; // { ...article, ingredient }

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const query = queries[slug]?.pubmed ?? `"${slug.replace(/-/g, ' ')} supplementation"`;

    try {
      const ids = await esearch(query, from, to);
      const newIds = ids.filter(id => !knownPmids.has(id));

      if (!newIds.length) {
        console.log(`Processing ${i + 1}/${slugs.length}: ${slug} (0 new PMIDs)`);
        await delay(350);
        continue;
      }

      await delay(350);
      const articles = await efetch(newIds);
      const candidates = articles.filter(isRctCandidate);

      console.log(`Processing ${i + 1}/${slugs.length}: ${slug} (${newIds.length} new PMIDs, ${candidates.length} RCT candidates)`);

      for (const c of candidates) {
        allCandidates.push({ ...c, ingredient: slug });
      }

      await delay(350);
    } catch (e) {
      console.error(`  ✗ ${slug}: ${e.message}`);
      errors.push({ ingredient: slug, error: e.message });
      await delay(350);
    }
  }

  console.log(`\n📋 Total RCT candidates: ${allCandidates.length}`);

  if (!allCandidates.length) {
    console.log('   No candidates found — nothing to extract.');
    writeReviewQueue([], 0, dryRun);
    return { autoExtracted, reviewQueue, errors };
  }

  if (!apiKey) {
    console.log('   Skipping Sonnet extraction (no API key).');
    for (const c of allCandidates) {
      reviewQueue.push({
        pmid: c.pmid,
        title: c.title,
        ingredient: c.ingredient,
        study_type: 'unknown',
        confidence: 0,
        reason: 'no_api_key',
        extracted: null,
      });
    }
    writeReviewQueue(reviewQueue, 0, dryRun);
    return { autoExtracted, reviewQueue, errors };
  }

  // Deduplicate by PMID (same study may match multiple ingredient queries)
  const seen = new Set();
  const uniqueCandidates = allCandidates.filter(c => {
    if (seen.has(c.pmid)) return false;
    seen.add(c.pmid);
    return true;
  });

  console.log(`\n🤖 Sending ${uniqueCandidates.length} unique candidates to Claude Sonnet...\n`);
  const extracted = await extractWithSonnet(uniqueCandidates, apiKey);

  let autoWrittenCount = 0;

  for (const item of extracted) {
    const { pmid, study_type, confidence } = item;
    const orig = item._original;
    const ingredient = allCandidates.find(c => c.pmid === pmid)?.ingredient ?? 'unknown';

    if (confidence >= AUTO_WRITE_CONFIDENCE && AUTO_WRITE_TYPES.has(study_type)) {
      const written = writeStudyStub(item, dryRun);
      if (written) {
        autoWrittenCount++;
        knownPmids.add(pmid); // prevent duplicate writes within run
        autoExtracted.push({
          pmid,
          title: orig?.title ?? '',
          ingredient,
          study_type,
          confidence,
          filePath: `data/sources/studies/pmid-${pmid}.yaml`,
        });
        console.log(`  ✅ Auto-written: pmid-${pmid} (${ingredient}, ${study_type}, conf=${confidence})`);
      }
    } else {
      const reason = confidence < AUTO_WRITE_CONFIDENCE ? 'below_auto_threshold' : 'study_type_not_qualifying';
      reviewQueue.push({
        pmid,
        title: orig?.title ?? '',
        ingredient,
        study_type,
        confidence,
        reason,
        extracted: {
          n: item.n,
          dose_mg: item.dose_mg,
          duration_weeks: item.duration_weeks,
          outcomes: item.outcomes,
          finding_en: item.finding_en,
          finding_de: item.finding_de,
        },
      });
    }
  }

  // Also queue candidates that weren't returned by Sonnet (extraction failed)
  const extractedPmids = new Set(extracted.map(e => e.pmid));
  for (const c of uniqueCandidates) {
    if (!extractedPmids.has(c.pmid)) {
      reviewQueue.push({
        pmid: c.pmid,
        title: c.title,
        ingredient: allCandidates.find(x => x.pmid === c.pmid)?.ingredient ?? 'unknown',
        study_type: 'unknown',
        confidence: 0,
        reason: 'extraction_failed',
        extracted: null,
      });
    }
  }

  const queuePath = writeReviewQueue(reviewQueue, autoWrittenCount, dryRun);

  console.log(`\n✨ Auto-extracted: ${autoWrittenCount} stubs written`);
  console.log(`   Review queue: ${reviewQueue.length} items → ${path.relative(ROOT, queuePath)}`);

  return { autoExtracted, reviewQueue, errors };
}

// ── CLI entry point ───────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const daysIdx = args.indexOf('--days');
  const daysBack = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) || DEFAULT_DAYS_BACK : DEFAULT_DAYS_BACK;

  runExtraction({ daysBack, dryRun })
    .then(({ autoExtracted, reviewQueue, errors }) => {
      if (errors.length) {
        console.log(`\n⚠ Errors (${errors.length}): ${errors.map(e => e.ingredient).join(', ')}`);
      }
      console.log('\nDone.');
    })
    .catch(e => {
      console.error('Fatal:', e.message);
      process.exit(1);
    });
}
