#!/usr/bin/env node
/**
 * Build bootstrap research cache from existing ingredient MDX dossiers.
 *
 * Usage:
 *   node scripts/build-research-cache.cjs
 *   node scripts/build-research-cache.cjs --slug omega-3
 *   node scripts/build-research-cache.cjs --outDir research-cache
 *   node scripts/build-research-cache.cjs --dry-run
 *   node scripts/build-research-cache.cjs --preserve-manual
 *   node scripts/build-research-cache.cjs --force
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INGREDIENTS_DIR = path.join(ROOT, 'src/content/ingredients');
const DEFAULT_OUT_DIR = path.join(ROOT, 'research-cache');
const AUDIT_SCRIPT = path.join(__dirname, 'audit-dossiers.cjs');

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const ONLY_SLUG = getArg('--slug');
const OUT_DIR = path.resolve(getArg('--outDir') || DEFAULT_OUT_DIR);
const DRY_RUN = hasFlag('--dry-run');
const PRESERVE_MANUAL = hasFlag('--preserve-manual');
const FORCE = hasFlag('--force');
const TODAY = new Date().toISOString().slice(0, 10);

const HIGH_PRIORITY = new Set([
  'nmn', 'nr', 'ashwagandha', 'omega-3', 'magnesium', 'vitamin-d3', 'vitamin-d3-k2',
  'kreatin', 'berberine', 'curcumin', 'resveratrol', 'coq10', 'zink', 'vitamin-b12',
  'kollagen', 'melatonin', 'l-theanin', 'probiotika', 'glutathion', 'nac', 'glycin',
  'taurin', 'quercetin', 'fisetin', 'spermidine', 'urolithin-a', 'rhodiola',
  'lion-s-mane', 'alpha-liponsaeure', 'koffein', 'beta-alanin', 'l-citrullin',
  'selen', 'jod', 'folsaeure', 'hyaluronsaeure', 'vitamin-c', 'vitamin-e',
  'vitamin-k2', 'eisen', 'calcium', 'cholin', 'apigenin', 'astaxanthin'
]);

const PRODUCT_PATTERNS = {
  magnesium: [
    ['magnesiumglycinat', { category: 'compound-form', bioavailability: 'high', tolerability: 'high', notes: 'Gut vertraeglich; oft fuer Schlaf/Nerven genutzt' }],
    ['magnesiumcitrat', { category: 'compound-form', bioavailability: 'high', tolerability: 'medium', notes: 'Gut bioverfuegbar; kann bei hoeheren Dosen abfuehrend wirken' }],
    ['magnesium-l-threonat', { category: 'compound-form', bioavailability: 'high', tolerability: 'medium', notes: 'Wird oft fuer kognitive Anwendungen vermarktet; Human-Evidenz begrenzt' }],
    ['magnesiummalat', { category: 'compound-form', bioavailability: 'high', tolerability: 'medium', notes: 'Hauefig fuer Energie/Muskeln vermarktet' }],
    ['magnesiumoxid', { category: 'compound-form', bioavailability: 'low', tolerability: 'medium', notes: 'Schwaechere Bioverfuegbarkeit als viele organische Formen' }],
  ],
  'omega-3': [
    ['krill', { category: 'delivery-form', bioavailability: 'medium', tolerability: 'medium', notes: 'Kriloel/Phospholipidform wird oft als bioverfuegbarer vermarktet' }],
    ['algen', { category: 'delivery-form', bioavailability: 'medium', tolerability: 'high', notes: 'Vegane Quelle fuer DHA/EPA je nach Produkt' }],
    ['ethylester', { category: 'chemical-form', bioavailability: 'medium', tolerability: 'medium', notes: 'Kann weniger gut absorbiert werden als TG-Form' }],
    ['triglycerid-form', { category: 'chemical-form', bioavailability: 'high', tolerability: 'medium', notes: 'TG-Form gilt oft als besser absorbierbar' }],
    ['ifos', { category: 'quality-signal', bioavailability: 'medium', tolerability: 'medium', notes: 'Unabhaengige Qualitaetspruefung fuer Fischoel' }],
  ],
  coq10: [
    ['ubiquinol', { category: 'chemical-form', bioavailability: 'high', tolerability: 'medium', notes: 'Reduzierte Form; haeufig als besser bioverfuegbar beworben' }],
    ['ubiquinon', { category: 'chemical-form', bioavailability: 'medium', tolerability: 'medium', notes: 'Oxidierte Standardform' }],
  ],
  curcumin: [
    ['piperin', { category: 'co-formulation', bioavailability: 'high', tolerability: 'medium', notes: 'Wird oft zur Resorptionssteigerung kombiniert; Interaktionspotenzial beachten' }],
    ['phytosom', { category: 'delivery-form', bioavailability: 'high', tolerability: 'medium', notes: 'Phospholipid-gebundene Form mit verbesserter Aufnahme' }],
    ['standardextrakt', { category: 'extract-form', bioavailability: 'low', tolerability: 'medium', notes: 'Ohne Resorptionshilfe oft schwach bioverfuegbar' }],
  ],
  probiotika: [
    ['cfu', { category: 'quality-signal', bioavailability: 'medium', tolerability: 'medium', notes: 'Keimzahl ist relevant, aber nicht allein entscheidend' }],
    ['stamm', { category: 'quality-signal', bioavailability: 'medium', tolerability: 'medium', notes: 'Stammspezifitaet ist fuer Evidenz und Wirkung wichtig' }],
  ],
};

function warn(list, type, file, detail) {
  list.push({ type, file, detail });
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm = {};
  const lines = match[1].split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const keyMatch = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    const rest = keyMatch[2];

    // Array of objects
    if (rest === '') {
      const next = lines[i + 1] || '';
      if (/^\s*-\s+/.test(next)) {
        const items = [];
        i++;
        while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
          const item = {};
          const first = lines[i].replace(/^\s*-\s+/, '');
          const firstKv = first.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
          if (firstKv) item[firstKv[1]] = stripQuotes(firstKv[2]);
          i++;
          while (i < lines.length && /^\s{4,}[A-Za-z_][\w-]*:/.test(lines[i])) {
            const sub = lines[i].trim().match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
            if (sub) item[sub[1]] = stripQuotes(sub[2]);
            i++;
          }
          items.push(item);
        }
        fm[key] = items;
        continue;
      }

      // Multiline indented text or nested bullets
      const block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || !lines[i].trim())) {
        if (lines[i].trim()) block.push(lines[i].trim());
        i++;
      }
      fm[key] = block.join(' ');
      continue;
    }

    // Inline array
    if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      fm[key] = inner ? inner.split(',').map(v => stripQuotes(v.trim())).filter(Boolean) : [];
      i++;
      continue;
    }

    fm[key] = parseScalar(rest);
    i++;
  }

  return fm;
}

function stripQuotes(value) {
  return String(value || '').replace(/^['"]|['"]$/g, '').trim();
}

function parseScalar(value) {
  const v = stripQuotes(value);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d+\.\d+$/.test(v)) return Number(v);
  return v;
}

function getBody(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return null;
}

function loadAuditScores() {
  if (!fs.existsSync(AUDIT_SCRIPT)) return {};
  try {
    const script = fs.readFileSync(AUDIT_SCRIPT, 'utf8');
    const vm = require('vm');
    const sandbox = {
      require,
      console: { log: () => {} },
      process: { argv: [] },
      __dirname: path.join(ROOT, 'scripts'),
    };
    vm.createContext(sandbox);
    vm.runInContext(script + '\nthis.__exports={parseFrontmatter,scoreQuality};', sandbox);
    const { parseFrontmatter, scoreQuality } = sandbox.__exports;
    const scores = {};
    for (const file of fs.readdirSync(INGREDIENTS_DIR).filter(f => f.endsWith('.mdx'))) {
      const content = fs.readFileSync(path.join(INGREDIENTS_DIR, file), 'utf8');
      const fm = parseFrontmatter(content);
      const result = scoreQuality(content, fm);
      scores[file.replace(/\.mdx$/, '')] = result.score;
    }
    return scores;
  } catch {
    return {};
  }
}

function confidenceFromEvidenceLevel(level) {
  const n = Number(level);
  if (n === 1 || n === 2) return 'high';
  if (n === 3) return 'medium';
  return 'low';
}

function inferStudyType(text) {
  const s = String(text || '').toLowerCase();
  if (/(meta-analysis|metaanalyse|meta analyse|pooled analysis|pooled-analysis|pooled analyse)/.test(s)) return 'meta-analysis';
  if (/(systematic review|systematischer review|systematische review|review article|umbrella review|scoping review|\ba review of\b|narrative review)/.test(s)) return 'systematic-review';
  if (/(\brct\b|randomized|randomised|randomly assigned|placebo-controlled|double-blind|single-blind|controlled trial|clinical trial|trial\s*\(|trial:|\bn=\d+\)?|healthy adults|healthy subjects|patients\b|participants\b|postmenopausal women|older adults|older people|men and women)/.test(s)) return 'rct';
  if (/(cohort|prospective|observational|case-control|cross-sectional|longitudinal|population-based)/.test(s)) return 'observational';
  if (/(guideline|consensus|position statement|leitlinie)/.test(s)) return 'guideline';
  if (/(mouse|mice|rat|rats|murine|animal|nagetier|rattenmodell|mausmodell|rodent|drosophila|c\. elegans|worm|worms|yeast|zebrafish|mptp)/.test(s)) return 'animal';
  if (/(in vitro|cell culture|zellkultur|fibroblast|cell line|hek-?293|caco-?2|cellular|senescent cells|macrophage|hepatocyte|neuron|neuronal|myotube)/.test(s)) return 'in-vitro';
  if (/(extends lifespan|extends healthspan|induces autophagy|senotherapeutic|mechanism|bioactive flavonoid|human brain|immune function|cardiovascular health|role of .* in disease)/.test(s)) return 'other';
  if (/\breview\b/.test(s)) return 'systematic-review';
  return 'other';
}

function evidenceDomainFromStudyType(studyType) {
  switch (studyType) {
    case 'meta-analysis':
    case 'systematic-review':
    case 'rct':
    case 'observational':
      return 'human';
    case 'guideline':
      return 'guideline';
    case 'animal':
      return 'animal';
    case 'in-vitro':
      return 'in-vitro';
    default:
      return 'unknown';
  }
}

function effectSummaryFromFinding(finding) {
  const text = String(finding || '').trim();
  const m = text.match(/([^\.]+(?:\d+[^\.]*)?)/);
  return m ? m[1].trim() : text.slice(0, 180);
}

function extractEffectSize(text) {
  const s = String(text || '');
  const patterns = [
    /(\d+[\.,]?\d*\s*(?:-|–|to)\s*\d+[\.,]?\d*\s*%)/i,
    /(\d+[\.,]?\d*\s*%)/i,
    /(HR\s*0[\.,]\d+[^;,.)]*)/i,
    /(RR\s*0[\.,]\d+[^;,.)]*)/i,
    /(OR\s*0[\.,]\d+[^;,.)]*)/i,
    /(aOR\s*0[\.,]\d+[^;,.)]*)/i,
    /(-?\d+[\.,]?\d*\s*(?:mg|g|IU|µg|mcg|mmHg))/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

function claimFromFinding(finding, title, slug) {
  const text = String(finding || '').trim();
  const first = text.split(/[\.:]/)[0].trim();
  if (first.length >= 20 && first.length <= 140) return first;
  return `${title || slug} — zentrales Studienfinding`;
}

function normalizeSourceType(pmid) {
  return pmid ? 'PubMed' : 'Unknown';
}

function inferQuality(studyType) {
  if (studyType === 'meta-analysis' || studyType === 'systematic-review' || studyType === 'guideline') return 'high';
  if (studyType === 'rct' || studyType === 'observational') return 'medium';
  if (studyType === 'animal' || studyType === 'in-vitro') return 'low';
  return 'low';
}

function inferRiskOfBias(studyType) {
  if (studyType === 'other') return 'high';
  return 'unknown';
}

function classificationConfidence(studyType) {
  return studyType === 'other' ? 'low' : 'medium';
}

function extractApprovedClaims(efsaNotes) {
  const text = String(efsaNotes || '');
  const claims = [];
  const lines = text.split(/\.|;/).map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (/(traegt|trägt|beitrag|normale|normalen|erhalt)/i.test(line) && line.length < 180) claims.push(line);
  }
  return [...new Set(claims)].slice(0, 8);
}

function inferWordingConstraints(studyFeed, efsaAllowed) {
  const constraints = ['Keine krankheitsbezogenen Heilclaims formulieren'];
  if (studyFeed.some(s => s.evidenceDomain === 'animal' || s.evidenceDomain === 'in-vitro')) {
    constraints.push('Tier- und In-vitro-Daten nicht als Humanbeleg darstellen');
  }
  if (!efsaAllowed) constraints.push('Wissenschaftliche Evidenz und regulatorisch zulaessige Claims strikt trennen');
  return [...new Set(constraints)];
}

function buildProductFactors(slug, body, aliases) {
  const haystack = `${body}\n${(aliases || []).join(' ')}`.toLowerCase();
  const patterns = PRODUCT_PATTERNS[slug] || [];
  const forms = [];

  for (const [needle, meta] of patterns) {
    if (haystack.includes(needle.toLowerCase())) {
      forms.push({ name: needle, ...meta });
    }
  }

  const selectionNotes = [];
  if (slug === 'magnesium' && forms.length) {
    selectionNotes.push('Form beeinflusst Bioverfuegbarkeit und Vertraeglichkeit deutlich');
  }
  if (slug === 'omega-3' && forms.length) {
    selectionNotes.push('Auf EPA+DHA-Gehalt, Oxidationsstabilitaet und Fettsaeureform achten');
  }
  if (slug === 'probiotika' && forms.length) {
    selectionNotes.push('CFU-Zahl allein reicht nicht; Stammspezifitaet ist entscheidend');
  }

  return {
    hasStructuredProductConsiderations: forms.length > 0,
    forms,
    selectionNotes,
  };
}

function priorityForSlug(slug, auditScore) {
  return {
    seo: HIGH_PRIORITY.has(slug) ? 'high' : 'medium',
    business: HIGH_PRIORITY.has(slug) ? 'medium' : 'low',
    contentQuality: auditScore >= 85 ? 'high' : auditScore >= 65 ? 'medium' : 'low',
  };
}

function reviewPriority(slug, auditScore) {
  if (HIGH_PRIORITY.has(slug) && auditScore < 85) return 'high';
  if (HIGH_PRIORITY.has(slug)) return 'high';
  if (auditScore < 65) return 'high';
  return 'medium';
}

function buildStudyFeed(keyStudies, slug, title, warnings, file) {
  if (!Array.isArray(keyStudies)) return [];
  return keyStudies.map((study, idx) => {
    const pmid = study.pmid ? String(study.pmid) : null;
    const titleText = String(study.title || `${slug} study ${idx + 1}`);
    const finding = String(study.finding || '');
    const type = inferStudyType(`${titleText} ${finding}`);
    if (type === 'other') warn(warnings, 'study-type-unclear', file, titleText);
    return {
      id: pmid ? `pmid-${pmid}` : `${slug}-study-${idx + 1}`,
      sourceType: normalizeSourceType(pmid),
      pmid,
      doi: null,
      title: titleText,
      year: study.year ? Number(study.year) : null,
      studyType: type,
      studyTypeUnclear: type === 'other',
      classificationConfidence: classificationConfidence(type),
      evidenceDomain: evidenceDomainFromStudyType(type),
      population: '',
      intervention: '',
      comparator: '',
      outcomes: [],
      effectSummary: effectSummaryFromFinding(finding),
      summary: finding,
      quality: inferQuality(type),
      riskOfBias: inferRiskOfBias(type),
      relevance: type === 'other' ? 'low' : 'high',
      status: 'included',
      detectedAt: TODAY,
      reviewedAt: TODAY,
      notes: type === 'other' ? 'Studientyp konnte aus Titel/Finding nicht klar klassifiziert werden; Vertrauen und Prioritaet reduziert.' : '',
    };
  });
}

function buildKeyFindings(keyStudies, slug, title) {
  if (!Array.isArray(keyStudies)) return [];
  return keyStudies.slice(0, 8).map((study, idx) => {
    const pmid = study.pmid ? String(study.pmid) : null;
    const titleText = String(study.title || `${slug} study ${idx + 1}`);
    const finding = String(study.finding || '');
    const type = inferStudyType(`${titleText} ${finding}`);
    return {
      id: pmid ? `pmid-${pmid}-finding-${idx + 1}` : `${slug}-finding-${idx + 1}`,
      claim: claimFromFinding(finding, title, slug),
      population: '',
      intervention: '',
      comparator: '',
      effectSize: extractEffectSize(finding),
      studyType: type,
      studyTypeUnclear: type === 'other',
      classificationConfidence: classificationConfidence(type),
      sourceType: normalizeSourceType(pmid),
      pmid,
      year: study.year ? Number(study.year) : null,
      quality: inferQuality(type),
      riskOfBias: inferRiskOfBias(type),
      confidence: type === 'other' ? 'low' : 'medium',
      evidenceDomain: evidenceDomainFromStudyType(type),
      includedInDossier: true,
      notes: type === 'other' ? 'Studientyp unklar; Finding nur mit reduziertem Vertrauen verwenden.' : '',
    };
  });
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
  return out;
}

function mergePreserved(base, existing) {
  if (!existing || typeof existing !== 'object') return base;
  return {
    ...base,
    openQuestions: Array.isArray(existing.openQuestions) ? existing.openQuestions : base.openQuestions,
    newEvidence: Array.isArray(existing.newEvidence) ? existing.newEvidence : base.newEvidence,
    triage: existing.triage && typeof existing.triage === 'object' ? { ...base.triage, ...existing.triage } : base.triage,
    regulatory: existing.regulatory && typeof existing.regulatory === 'object'
      ? {
          ...base.regulatory,
          wordingConstraints: Array.isArray(existing.regulatory.wordingConstraints)
            ? existing.regulatory.wordingConstraints
            : base.regulatory.wordingConstraints,
          notes: existing.regulatory.notes || base.regulatory.notes,
        }
      : base.regulatory,
    keyFindings: Array.isArray(existing.keyFindings)
      ? existing.keyFindings.filter(k => k && k.manual === true).concat(base.keyFindings)
      : base.keyFindings,
  };
}

function buildCacheFromFile(file, auditScores, warnings) {
  const fullPath = path.join(INGREDIENTS_DIR, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const fm = parseFrontmatter(raw);
  const body = getBody(raw);
  const slug = String(fm.slug || file.replace(/\.mdx$/, '')).trim();
  if (!slug) throw new Error(`Missing slug in ${file}`);

  const title = String(fm.title || slug);
  const dossierUpdatedAt = normalizeDate(fm.updatedAt || fm.publishedAt);
  if (!dossierUpdatedAt) warn(warnings, 'missing-updatedAt', file, slug);

  const keyStudies = Array.isArray(fm.key_studies) ? fm.key_studies : [];
  if (!keyStudies.length) warn(warnings, 'missing-key-studies', file, slug);

  const auditScore = Number.isFinite(auditScores[slug]) ? auditScores[slug] : null;
  const evidenceLevel = Number(fm.evidenceLevel || 5);
  const aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
  const studyFeed = buildStudyFeed(keyStudies, slug, title, warnings, file);
  const keyFindings = buildKeyFindings(keyStudies, slug, title).map(k => ({
    ...k,
    confidence: confidenceFromEvidenceLevel(evidenceLevel),
  }));
  const efsaAllowed = Boolean(fm.efsa_health_claims_allowed);
  const regulatoryNotes = String(fm.efsa_notes || '').trim();
  const productFactors = buildProductFactors(slug, body, aliases);

  const cache = {
    slug,
    cacheVersion: 1,
    status: 'active',
    reviewStatus: 'bootstrap',
    createdAt: TODAY,
    updatedAt: TODAY,
    lastReviewed: TODAY,
    reviewer: 'build-research-cache',
    lastSearchDate: TODAY,
    aliases,
    priority: priorityForSlug(slug, auditScore ?? 0),
    search: {
      pubmedQuery: `${title} AND humans`,
      clinicalTrialsQuery: slug,
      sourcePolicy: {
        includeMetaAnalyses: true,
        includeSystematicReviews: true,
        includeHumanRCTs: true,
        includeObservational: true,
        includeAnimalSelective: true,
        includeInVitroSelective: true,
      },
      notes: 'Bootstrap query placeholder; refine during refresh integration',
    },
    dossier: {
      path: `src/content/ingredients/${slug}.mdx`,
      title,
      summary: String(fm.summary || ''),
      updatedAt: dossierUpdatedAt,
      auditScore,
    },
    evidenceSummary: {
      level: evidenceLevel,
      confidence: confidenceFromEvidenceLevel(evidenceLevel),
      headline: String(fm.evidenceSummary || ''),
      updatedAt: TODAY,
    },
    keyFindings,
    studyFeed,
    newEvidence: [],
    openQuestions: [],
    regulatory: {
      efsaCheckedAt: TODAY,
      approvedClaims: extractApprovedClaims(regulatoryNotes),
      rejectedClaims: [],
      wordingConstraints: inferWordingConstraints(studyFeed, efsaAllowed),
      notes: regulatoryNotes,
    },
    triage: {
      needsReview: true,
      flaggedForRewrite: false,
      rewriteReason: studyFeed.some(s => s.studyTypeUnclear) ? 'Mindestens ein key_study-Eintrag hat keinen klaren Studientyp und sollte reviewt werden.' : '',
      evidenceChangeSeverity: 'medium',
      reviewPriority: studyFeed.some(s => s.studyTypeUnclear) ? 'high' : reviewPriority(slug, auditScore ?? 0),
    },
    productFactors,
  };

  return cache;
}

function writeJson(filePath, data) {
  const sorted = sortKeys(data);
  const text = JSON.stringify(sorted, null, 2) + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function main() {
  const warnings = [];
  const auditScores = loadAuditScores();
  const files = fs.readdirSync(INGREDIENTS_DIR)
    .filter(f => f.endsWith('.mdx'))
    .filter(f => !ONLY_SLUG || f === `${ONLY_SLUG}.mdx`)
    .sort();

  const items = [];
  for (const file of files) {
    const cache = buildCacheFromFile(file, auditScores, warnings);
    const outPath = path.join(OUT_DIR, `${cache.slug}.json`);

    if (fs.existsSync(outPath) && !FORCE && !PRESERVE_MANUAL) {
      throw new Error(`Refusing to overwrite existing cache without --force or --preserve-manual: ${outPath}`);
    }

    let finalCache = cache;
    if (fs.existsSync(outPath) && PRESERVE_MANUAL) {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      finalCache = mergePreserved(cache, existing);
    }

    if (!DRY_RUN) writeJson(outPath, finalCache);

    items.push({
      slug: finalCache.slug,
      title: finalCache.dossier.title,
      reviewStatus: finalCache.reviewStatus,
      lastReviewed: finalCache.lastReviewed,
      lastSearchDate: finalCache.lastSearchDate,
      auditScore: finalCache.dossier.auditScore,
      evidenceLevel: finalCache.evidenceSummary.level,
      seoPriority: finalCache.priority.seo,
      needsReview: finalCache.triage.needsReview,
      flaggedForRewrite: finalCache.triage.flaggedForRewrite,
      evidenceChangeSeverity: finalCache.triage.evidenceChangeSeverity,
      reviewPriority: finalCache.triage.reviewPriority,
      keyFindingCount: finalCache.keyFindings.length,
      studyFeedCount: finalCache.studyFeed.length,
      newEvidenceCount: finalCache.newEvidence.length,
      structuredProductFormsCount: finalCache.productFactors.forms.length,
      unclearStudyTypeCount: finalCache.studyFeed.filter(s => s.studyTypeUnclear).length,
    });
  }

  const indexJson = {
    cacheVersion: 1,
    generatedAt: TODAY,
    totalSlugs: items.length,
    items,
  };

  if (!DRY_RUN) writeJson(path.join(OUT_DIR, 'index.json'), indexJson);

  console.log(`Processed ${items.length} slug(s)${DRY_RUN ? ' [dry-run]' : ''}.`);
  if (warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
    const grouped = warnings.reduce((acc, w) => {
      acc[w.type] = (acc[w.type] || 0) + 1;
      return acc;
    }, {});
    for (const [type, count] of Object.entries(grouped).sort()) {
      console.log(`- ${type}: ${count}`);
    }
  }
}

try {
  main();
} catch (err) {
  console.error(err.message || String(err));
  process.exit(1);
}
