/**
 * migrate-ingredients.ts
 *
 * Reads ALL src/content/ingredients/*.mdx files and produces:
 *   - data/entities/ingredients/<slug>.json   (entity)
 *   - data/relations/by-entity/<slug>.json    (relations extracted from frontmatter + body)
 *   - data/entities/mechanisms/<id>.json      (auto-created)
 *   - data/entities/symptoms/<id>.json        (auto-created)
 *   - data/entities/biomarkers/<id>.json      (auto-created)
 *
 * Phase 1: Frontmatter extraction (deterministic)
 * Phase 2: Body-text relation extraction (pattern-based heuristics)
 *
 * Run: npx tsx data/scripts/migrate-ingredients.ts
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT = join(import.meta.dirname, '../..');
const INGREDIENTS_DIR = join(ROOT, 'src/content/ingredients');
const OUT_ENTITIES = join(ROOT, 'data/entities/ingredients');
const OUT_MECHANISMS = join(ROOT, 'data/entities/mechanisms');
const OUT_SYMPTOMS = join(ROOT, 'data/entities/symptoms');
const OUT_BIOMARKERS = join(ROOT, 'data/entities/biomarkers');
const OUT_RELATIONS = join(ROOT, 'data/relations/by-entity');

// Ensure output dirs
for (const d of [OUT_ENTITIES, OUT_MECHANISMS, OUT_SYMPTOMS, OUT_BIOMARKERS, OUT_RELATIONS]) {
  mkdirSync(d, { recursive: true });
}

// ── Frontmatter parser ────────────────────────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found');

  const raw = match[1];
  const body = match[2];

  // Simple YAML parser for our known structure
  const fm: Record<string, any> = {};
  let currentKey = '';
  let currentArray: any[] | null = null;
  let currentArrayObj: Record<string, any> | null = null;

  for (const line of raw.split('\n')) {
    // Top-level key: value
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      // Flush previous array
      if (currentArray !== null) {
        if (currentArrayObj) currentArray.push(currentArrayObj);
        fm[currentKey] = currentArray;
        currentArray = null;
        currentArrayObj = null;
      }

      const [, key, val] = kvMatch;
      currentKey = key;

      if (val.trim() === '') {
        // Could be start of array or object
        continue;
      }

      // Array inline: ["a", "b"]
      if (val.trim().startsWith('[')) {
        try {
          fm[key] = JSON.parse(val.trim());
        } catch {
          fm[key] = val.trim().replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        }
        continue;
      }

      // Boolean
      if (val.trim() === 'true') { fm[key] = true; continue; }
      if (val.trim() === 'false') { fm[key] = false; continue; }

      // Number
      if (/^\d+(\.\d+)?$/.test(val.trim())) { fm[key] = parseFloat(val.trim()); continue; }

      // String (strip quotes)
      fm[key] = val.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    // Array item start: "  - key: val" or "  - text"
    const arrayItemMatch = line.match(/^\s+-\s+(.*)$/);
    if (arrayItemMatch) {
      if (currentArray === null) currentArray = [];

      const itemContent = arrayItemMatch[1];

      // Object property: "key: value"
      const objPropMatch = itemContent.match(/^(\w+)\s*:\s*(.*)$/);
      if (objPropMatch) {
        if (currentArrayObj && !currentArrayObj[objPropMatch[1]]) {
          // New item
        } else if (currentArrayObj) {
          currentArray.push(currentArrayObj);
        }
        currentArrayObj = {};
        const val = objPropMatch[2].trim().replace(/^["']|["']$/g, '');
        currentArrayObj[objPropMatch[1]] = /^\d+$/.test(val) ? parseInt(val) : val;
      } else {
        // Simple string array item
        if (currentArrayObj) {
          currentArray.push(currentArrayObj);
          currentArrayObj = null;
        }
        currentArray.push(itemContent.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Continuation of array object property
    const contPropMatch = line.match(/^\s{4,}(\w+)\s*:\s*(.*)$/);
    if (contPropMatch && currentArrayObj) {
      const val = contPropMatch[2].trim().replace(/^["']|["']$/g, '');
      currentArrayObj[contPropMatch[1]] = /^\d+$/.test(val) ? parseInt(val) : val;
      continue;
    }
  }

  // Flush final array
  if (currentArray !== null) {
    if (currentArrayObj) currentArray.push(currentArrayObj);
    fm[currentKey] = currentArray;
  }

  return { frontmatter: fm, body };
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Relation extraction from body text ────────────────────────────────────────

// Known symptom/use-case keywords
const SYMPTOM_PATTERNS: Record<string, string[]> = {
  'schlaf': ['schlaf', 'insomni', 'einschlaf', 'durchschlaf', 'sleep'],
  'energie': ['energi', 'müdigkeit', 'fatigue', 'erschöpfung', 'ermüdung'],
  'kognition': ['kogniti', 'gedächtnis', 'gehirn', 'konzentration', 'brain fog', 'mental'],
  'immunsystem': ['immun', 'abwehr', 'infekt', 'erkältung'],
  'entzuendung': ['entzündung', 'inflammat', 'anti-inflammat', 'antiinflamma'],
  'blutdruck': ['blutdruck', 'hypertoni', 'blood pressure'],
  'blutzucker': ['blutzucker', 'insulin', 'glukose', 'diabetes', 'hba1c'],
  'stress': ['stress', 'cortisol', 'adaptogen', 'angst', 'anxio'],
  'depression': ['depress', 'stimmung', 'mood'],
  'herz-kreislauf': ['herz', 'kardio', 'cardiovascular', 'atherosklerose', 'cholesterin', 'ldl', 'hdl', 'triglycerid'],
  'gelenke': ['gelenk', 'knorpel', 'arthro', 'arthritis'],
  'haut': ['haut', 'skin', 'kollagen', 'falten', 'hautalterung'],
  'muskel': ['muskel', 'muskelkater', 'regeneration', 'recovery', 'kraft'],
  'verdauung': ['verdauung', 'darm', 'mikrobiom', 'gastro', 'magen', 'ibs', 'reizdar'],
  'alterung': ['aging', 'alterung', 'longevity', 'lebensdauer', 'langlebigkeit', 'seneszenz', 'senolyt'],
  'oxidativer-stress': ['oxidativ', 'antioxida', 'freie radikale', 'ros', 'reactive oxygen'],
  'knochen': ['knochen', 'osteo', 'calcium-absorption', 'knochendichte'],
  'augen': ['auge', 'makuladegeneration', 'sehkraft', 'retina', 'netzhaut'],
  'leber': ['leber', 'hepato', 'leberschutz', 'entgiftung', 'detox'],
  'schilddruese': ['schilddrüs', 'thyroid', 'jod'],
  'fertilitat': ['fertil', 'spermien', 'fruchtbar'],
  'migraene': ['migrän', 'kopfschmerz', 'migraine'],
  'neuroprotektiv': ['neuroprotekt', 'neurodegenerat', 'alzheimer', 'parkinson', 'demenz'],
};

// Known mechanism keywords
const MECHANISM_PATTERNS: Record<string, string[]> = {
  'nad-biosynthese': ['nad+', 'nad-', 'nicotinamid', 'salvage pathway', 'nampt'],
  'atp-synthese': ['atp', 'mitochondri', 'energiestoffwechsel', 'elektronentransportkette'],
  'antioxidative-abwehr': ['antioxida', 'glutathion', 'superoxiddismutase', 'sod', 'nrf2'],
  'serotonin-synthese': ['serotonin', '5-ht', 'tryptophan-hydroxylase'],
  'dopamin-synthese': ['dopamin', 'tyrosin-hydroxylase', 'l-dopa'],
  'gaba-rezeptor': ['gaba', 'gamma-aminobuttersäure', 'gabaerg'],
  'ampk-aktivierung': ['ampk', 'amp-aktivierte'],
  'mtor-hemmung': ['mtor', 'rapamycin'],
  'sirt1-aktivierung': ['sirtuin', 'sirt1', 'sirt3'],
  'nf-kb-hemmung': ['nf-kb', 'nf-κb', 'nukleärer faktor'],
  'autophagie': ['autophag', 'autophagy', 'mitophag'],
  'dna-reparatur': ['dna-reparatur', 'dna repair', 'parp'],
  'kollagen-synthese': ['kollagensynthese', 'kollagenbildung', 'prokollagen'],
  'methylierung': ['methylierung', 'methylgruppen', 'homocystein', 'sam-', 's-adenosyl'],
  'senolytisch': ['senolyt', 'senescent', 'zombie-zell'],
  'telomer-erhaltung': ['telomer', 'telomeras'],
  'stammzell-funktion': ['stammzell'],
  'epigenetisch': ['epigenet', 'histondeacetylase', 'hdac', 'dna-methylierung'],
  'blut-hirn-schranke': ['blut-hirn-schranke', 'bhs', 'blood-brain'],
  'prostaglandin-hemmung': ['prostaglandin', 'cox-2', 'cyclooxygenase'],
};

// Known biomarker keywords
const BIOMARKER_PATTERNS: Record<string, string[]> = {
  'serum-magnesium': ['serum-magnesium', 'magnesiumspiegel'],
  'homocystein': ['homocystein', 'homocysteine'],
  'crp': ['crp', 'c-reaktives protein', 'c-reactive protein'],
  'hba1c': ['hba1c', 'glykiertes hämoglobin'],
  'vitamin-d-spiegel': ['25-oh-d', '25(oh)d', '25-hydroxyvitamin', 'vitamin-d-spiegel', 'calcidiol'],
  'ferritin': ['ferritin'],
  'tsh': ['tsh', 'thyreoidea'],
  'leberwerte': ['got', 'gpt', 'alt', 'ast', 'leberwert', 'gamma-gt', 'ggt'],
  'blutdruck-werte': ['systolisch', 'diastolisch', 'mmhg'],
  'nad-spiegel': ['nad-spiegel', 'nad+-spiegel', 'nad level'],
  'glutathion-spiegel': ['glutathion-spiegel', 'gsh'],
  'omega-3-index': ['omega-3-index', 'epa/dha'],
  'cholesterin': ['ldl-cholesterin', 'hdl-cholesterin', 'gesamtcholesterin'],
  'nüchternblutzucker': ['nüchternblutzucker', 'nüchternglukose', 'fasting glucose'],
  'insulin': ['nüchterninsulin', 'homa-ir', 'insulinresistenz'],
};

// Interaction patterns — find mentions of other ingredient slugs
function extractInteractions(body: string, currentSlug: string, allSlugs: string[]): Array<{target: string; note: string}> {
  const interactions: Array<{target: string; note: string}> = [];
  const lowerBody = body.toLowerCase();

  // Explicit interaction sections
  const interactionSection = body.match(/##[^#]*(?:Interaktion|Wechselwirkung|Kombination|Synergie)[^#]*\n([\s\S]*?)(?=\n##|$)/i);
  const interactionText = interactionSection ? interactionSection[1] : '';

  // Also check the whole body for "nicht kombinieren", "Wechselwirkung mit", etc.
  for (const slug of allSlugs) {
    if (slug === currentSlug) continue;

    // Check if the other ingredient is mentioned in interaction context
    const name = slug.replace(/-/g, '[- ]?');
    const mentionRegex = new RegExp(`(?:interak|wechselwirk|kombinier|zusammen mit|konkurrenz|verstärk|abschwäch|hemm|blockier|synergi)[\\s\\S]{0,200}${name}|${name}[\\s\\S]{0,200}(?:interak|wechselwirk|kombinier|zusammen mit|konkurrenz|verstärk|abschwäch|hemm|blockier|synergi)`, 'i');

    if (mentionRegex.test(body) || (interactionText && new RegExp(name, 'i').test(interactionText))) {
      // Extract context
      const contextMatch = body.match(new RegExp(`[^.]*${name}[^.]*\\.`, 'i'));
      interactions.push({
        target: slug,
        note: contextMatch ? contextMatch[0].trim().slice(0, 200) : ''
      });
    }
  }

  return interactions;
}

function extractPatternMatches(body: string, patterns: Record<string, string[]>): string[] {
  const matches: string[] = [];
  const lowerBody = body.toLowerCase();

  for (const [id, keywords] of Object.entries(patterns)) {
    for (const kw of keywords) {
      if (lowerBody.includes(kw.toLowerCase())) {
        matches.push(id);
        break;
      }
    }
  }

  return matches;
}

// ── Kontraindikation extraction ───────────────────────────────────────────────

function extractKontraindikationen(body: string): string[] {
  const results: string[] = [];
  const lowerBody = body.toLowerCase();

  const patterns: Record<string, string[]> = {
    'schwangerschaft': ['schwanger', 'stillzeit', 'pregnancy'],
    'kinder': ['kinder', 'kleinkind', 'säugling'],
    'nierenerkrankung': ['nierenerkrank', 'niereninsuffizienz', 'nierenfunktion', 'dialyse'],
    'lebererkrankung': ['lebererkrank', 'leberschäd', 'hepati', 'leberzirrhose'],
    'blutgerinnungsstoerung': ['blutgerinn', 'antikoagul', 'blutverdünner', 'warfarin', 'marcumar'],
    'autoimmunerkrankung': ['autoimmun'],
    'hormonabhaengige-tumore': ['hormonabhäng', 'brustkrebs', 'östrogen-rezeptor'],
    'ssri-einnahme': ['ssri', 'serotonin-syndrom', 'antidepress'],
    'mao-hemmer': ['mao-hemmer', 'monoaminoxidase'],
    'schilddruesenerkrankung': ['schilddrüsenerkrank', 'hashimoto', 'morbus basedow', 'hyperthyreose'],
    'epilepsie': ['epileps', 'krampfanfall'],
    'blutdruckmedikamente': ['antihypertensiv', 'blutdruckmedikament', 'blutdrucksenkend'],
    'diabetes-medikamente': ['metformin', 'insulin-therapie', 'antidiabetik', 'sulfonylharnstoff'],
    'chemotherapie': ['chemotherap', 'zytostatik', 'krebstherapie'],
    'organtransplantation': ['transplant', 'immunsuppress', 'cyclosporin'],
  };

  for (const [id, keywords] of Object.entries(patterns)) {
    for (const kw of keywords) {
      if (lowerBody.includes(kw.toLowerCase())) {
        // Check if it's in a contraindication/warning context
        const warnContext = new RegExp(`(?:nicht|kontraindiz|vorsicht|warnung|cave|achtung|meiden|vermeiden|gefährlich|risiko|nebenwirk)[\\s\\S]{0,300}${kw}|${kw}[\\s\\S]{0,300}(?:nicht|kontraindiz|vorsicht|warnung|cave|achtung|meiden|vermeiden)`, 'i');
        if (warnContext.test(body)) {
          results.push(id);
          break;
        }
      }
    }
  }

  return results;
}

// ── Nebenwirkung extraction ───────────────────────────────────────────────────

function extractNebenwirkungen(body: string): string[] {
  const results: string[] = [];
  const lowerBody = body.toLowerCase();

  const patterns: Record<string, string[]> = {
    'magen-darm-beschwerden': ['durchfall', 'übelkeit', 'erbrechen', 'magenschmerzen', 'gastrointestinal', 'abführend', 'blähungen', 'bauchschmerz', 'diarrhoe'],
    'kopfschmerzen': ['kopfschmerz'],
    'schlaflosigkeit': ['schlaflosigkeit', 'schlafstörung', 'insomnie'],
    'hautausschlag': ['hautausschlag', 'hautreaktion', 'rash', 'juckreiz'],
    'lebertoxizitaet': ['lebertoxiz', 'hepatotoxis', 'lebersch'],
    'serotonin-syndrom': ['serotonin-syndrom'],
    'blutdruckabfall': ['hypotension', 'blutdruckabfall', 'blutdruck zu niedrig'],
    'blutzuckerabfall': ['hypoglykäm', 'unterzucker', 'blutzuckerabfall'],
    'metallischer-geschmack': ['metallisch'],
    'flush': ['flush', 'hautrötung', 'flushing'],
  };

  for (const [id, keywords] of Object.entries(patterns)) {
    for (const kw of keywords) {
      if (lowerBody.includes(kw.toLowerCase())) {
        results.push(id);
        break;
      }
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = readdirSync(INGREDIENTS_DIR).filter(f => f.endsWith('.mdx'));
const allSlugs = files.map(f => f.replace('.mdx', ''));

console.log(`Found ${files.length} ingredient files`);

// Collect auto-created entities
const autoMechanisms = new Set<string>();
const autoSymptoms = new Set<string>();
const autoBiomarkers = new Set<string>();
const autoKontra = new Set<string>();
const autoNebenwirkungen = new Set<string>();

// Track all relations for dual indexing
const allRelations: Map<string, Array<{relation: string; target: string; direction: string; confidence?: number; evidence_strength?: string; source?: string; note?: string}>> = new Map();

function addRelation(entity: string, rel: {relation: string; target: string; direction: string; confidence?: number; evidence_strength?: string; source?: string; note?: string}) {
  if (!allRelations.has(entity)) allRelations.set(entity, []);
  // Dedupe
  const existing = allRelations.get(entity)!;
  if (!existing.find(r => r.relation === rel.relation && r.target === rel.target)) {
    existing.push(rel);
  }
}

let processed = 0;

for (const file of files) {
  const slug = file.replace('.mdx', '');
  const content = readFileSync(join(INGREDIENTS_DIR, file), 'utf-8');

  let fm: Record<string, any>;
  let body: string;

  try {
    ({ frontmatter: fm, body } = parseFrontmatter(content));
  } catch (e) {
    console.error(`  ✗ ${slug}: ${(e as Error).message}`);
    continue;
  }

  // ── Entity ──────────────────────────────────────────────────────────────

  const entity: Record<string, any> = {
    id: fm.slug || slug,
    type: 'ingredient',
    name: fm.title || slug,
    summary: (fm.summary || '').slice(0, 300),
  };

  if (fm.aliases) entity.aliases = fm.aliases;
  if (fm.category) entity.category = fm.category;
  if (fm.evidenceLevel) entity.evidenceLevel = parseInt(fm.evidenceLevel);
  if (fm.safety_rating) entity.safety = fm.safety_rating;
  if (typeof fm.efsa_health_claims_allowed === 'boolean') entity.efsa_approved = fm.efsa_health_claims_allowed;
  if (fm.typical_dose_mg) entity.typical_dose_mg = fm.typical_dose_mg;

  writeFileSync(join(OUT_ENTITIES, `${slug}.json`), JSON.stringify(entity, null, 2) + '\n');

  // ── Relations ───────────────────────────────────────────────────────────

  // 1. Symptoms/Use-cases from body
  const symptoms = extractPatternMatches(body, SYMPTOM_PATTERNS);
  for (const s of symptoms) {
    autoSymptoms.add(s);
    addRelation(slug, { relation: 'wird_eingesetzt_fuer', target: s, direction: 'outgoing', confidence: 0.7 });
    addRelation(s, { relation: 'wird_eingesetzt_fuer', target: slug, direction: 'incoming', confidence: 0.7 });
  }

  // 2. Mechanisms from body
  const mechanisms = extractPatternMatches(body, MECHANISM_PATTERNS);
  for (const m of mechanisms) {
    autoMechanisms.add(m);
    addRelation(slug, { relation: 'wirkt_ueber', target: m, direction: 'outgoing', confidence: 0.7 });
    addRelation(m, { relation: 'wirkt_ueber', target: slug, direction: 'incoming', confidence: 0.7 });
  }

  // 3. Biomarkers from body
  const biomarkers = extractPatternMatches(body, BIOMARKER_PATTERNS);
  for (const b of biomarkers) {
    autoBiomarkers.add(b);
    addRelation(slug, { relation: 'benoetigt_biomarker_check', target: b, direction: 'outgoing', confidence: 0.6 });
    addRelation(b, { relation: 'benoetigt_biomarker_check', target: slug, direction: 'incoming', confidence: 0.6 });
  }

  // 4. Interactions with other ingredients
  const interactions = extractInteractions(body, slug, allSlugs);
  for (const inter of interactions) {
    addRelation(slug, { relation: 'hat_interaktion_mit', target: inter.target, direction: 'outgoing', confidence: 0.7, note: inter.note });
    addRelation(inter.target, { relation: 'hat_interaktion_mit', target: slug, direction: 'incoming', confidence: 0.7, note: inter.note });
  }

  // 5. Kontraindikationen
  const kontras = extractKontraindikationen(body);
  for (const k of kontras) {
    autoKontra.add(k);
    addRelation(slug, { relation: 'kontraindiziert_bei', target: `kontra-${k}`, direction: 'outgoing', confidence: 0.7 });
  }

  // 6. Nebenwirkungen
  const nebenwirkungen = extractNebenwirkungen(body);
  for (const n of nebenwirkungen) {
    autoNebenwirkungen.add(n);
    addRelation(slug, { relation: 'hat_nebenwirkung', target: `nw-${n}`, direction: 'outgoing', confidence: 0.7 });
  }

  // 7. EFSA status
  if (typeof fm.efsa_health_claims_allowed === 'boolean') {
    addRelation(slug, {
      relation: 'hat_regulatorischen_status',
      target: fm.efsa_health_claims_allowed ? 'efsa-zugelassen' : 'efsa-nicht-zugelassen',
      direction: 'outgoing',
      confidence: 1.0
    });
  }

  // 8. Key studies
  if (Array.isArray(fm.key_studies)) {
    for (const study of fm.key_studies) {
      if (study.pmid) {
        addRelation(slug, {
          relation: 'basiert_auf_studie',
          target: `studie-${study.pmid}`,
          direction: 'outgoing',
          confidence: 0.9,
          source: `pmid:${study.pmid}`,
          note: study.finding?.slice(0, 200) || ''
        });
      }
    }
  }

  processed++;
  if (processed % 20 === 0) console.log(`  Processed ${processed}/${files.length}`);
}

console.log(`\nProcessed ${processed}/${files.length} ingredients`);

// ── Write auto-created entities ───────────────────────────────────────────────

function writeName(id: string): string {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

for (const id of autoMechanisms) {
  writeFileSync(join(OUT_MECHANISMS, `${id}.json`), JSON.stringify({
    id, type: 'mechanism', name: writeName(id)
  }, null, 2) + '\n');
}

for (const id of autoSymptoms) {
  writeFileSync(join(OUT_SYMPTOMS, `${id}.json`), JSON.stringify({
    id, type: 'symptom', name: writeName(id)
  }, null, 2) + '\n');
}

for (const id of autoBiomarkers) {
  writeFileSync(join(OUT_BIOMARKERS, `${id}.json`), JSON.stringify({
    id, type: 'biomarker', name: writeName(id)
  }, null, 2) + '\n');
}

// Write regulatory entities
const regDir = join(ROOT, 'data/entities/regulatory');
mkdirSync(regDir, { recursive: true });
writeFileSync(join(regDir, 'efsa-zugelassen.json'), JSON.stringify({
  id: 'efsa-zugelassen', type: 'regulatory', name: 'EFSA Health Claims zugelassen'
}, null, 2) + '\n');
writeFileSync(join(regDir, 'efsa-nicht-zugelassen.json'), JSON.stringify({
  id: 'efsa-nicht-zugelassen', type: 'regulatory', name: 'EFSA Health Claims nicht zugelassen'
}, null, 2) + '\n');

console.log(`\nAuto-created entities:`);
console.log(`  Mechanisms:       ${autoMechanisms.size}`);
console.log(`  Symptoms:         ${autoSymptoms.size}`);
console.log(`  Biomarkers:       ${autoBiomarkers.size}`);
console.log(`  Kontraindikation: ${autoKontra.size}`);
console.log(`  Nebenwirkungen:   ${autoNebenwirkungen.size}`);

// ── Write relation files ──────────────────────────────────────────────────────

let totalRelations = 0;
for (const [entityId, rels] of allRelations) {
  writeFileSync(join(OUT_RELATIONS, `${entityId}.json`), JSON.stringify({
    entity: entityId,
    relations: rels
  }, null, 2) + '\n');
  totalRelations += rels.length;
}

console.log(`\nRelation files:     ${allRelations.size}`);
console.log(`Total relations:    ${totalRelations}`);
console.log('\n✓ Migration complete');
