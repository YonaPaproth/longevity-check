#!/usr/bin/env node
/**
 * MikroScore Dossier Quality Audit
 * Evaluates all ingredient MDX files and outputs a prioritized table.
 *
 * Usage:
 *   node scripts/audit-dossiers.cjs           # console output
 *   node scripts/audit-dossiers.cjs --backlog  # also writes backlog/dossier-rewrite-backlog.md
 */

const fs = require('fs');
const path = require('path');

const INGREDIENTS_DIR = path.join(__dirname, '../src/content/ingredients');
const BACKLOG_PATH = path.join(__dirname, '../backlog/dossier-rewrite-backlog.md');
const WRITE_BACKLOG = process.argv.includes('--backlog');

// High-priority slugs (high search volume) — deduplicated, corrected
const HIGH_PRIORITY = new Set([
  'nmn', 'nr', 'ashwagandha', 'omega-3', 'magnesium', 'vitamin-d3', 'vitamin-d3-k2',
  'kreatin', 'berberine', 'curcumin', 'resveratrol', 'coq10', 'zink', 'vitamin-b12',
  'kollagen', 'melatonin', 'l-theanin', 'probiotika', 'glutathion',
  'nac', 'glycin', 'taurin', 'quercetin', 'fisetin', 'spermidine', 'urolithin-a',
  'rhodiola', 'lion-s-mane', 'alpha-liponsaeure', 'koffein',
  'beta-alanin', 'l-citrullin', 'selen', 'jod', 'folsaeure', 'hyaluronsaeure',
  'vitamin-c', 'vitamin-e', 'vitamin-k2', 'eisen', 'calcium', 'cholin',
  'ashwagandha', 'apigenin', 'astaxanthin',
]);

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let inArray = false;
  let inBlock = false;
  let blockLines = [];
  let arrayItems = [];

  for (const line of lines) {
    // Block scalar (key: | or key: >)
    const blockStart = line.match(/^(\w+):\s*[|>]\s*$/);
    if (blockStart) {
      if (inArray && currentKey) fm[currentKey] = arrayItems;
      currentKey = blockStart[1];
      inArray = false;
      inBlock = true;
      blockLines = [];
      continue;
    }
    if (inBlock) {
      if (line.startsWith('  ')) {
        blockLines.push(line.trim());
        continue;
      } else {
        fm[currentKey] = blockLines.join(' ');
        inBlock = false;
        blockLines = [];
      }
    }

    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kvMatch && !line.startsWith('  ') && !line.startsWith('-')) {
      if (inArray && currentKey) fm[currentKey] = arrayItems;
      currentKey = kvMatch[1];
      inArray = false;
      arrayItems = [];
      const val = kvMatch[2].replace(/^["']|["']$/g, '').trim();
      if (val === '') {
        inArray = true;
      } else {
        fm[currentKey] = val;
      }
    } else if (line.match(/^\s*- /) && inArray) {
      arrayItems.push(line.replace(/^\s*- /, '').trim());
    }
  }
  if (inBlock && currentKey) fm[currentKey] = blockLines.join(' ');
  if (inArray && currentKey) fm[currentKey] = arrayItems;

  return fm;
}

function countWords(text) {
  // Strip frontmatter then count all words (not just >2 chars — that was undercounting)
  return text
    .replace(/^---[\s\S]*?---/, '')
    .replace(/[#*`\[\]<>]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0).length;
}

function countKeyStudies(content) {
  const matches = content.match(/- title:/g);
  return matches ? matches.length : 0;
}

function hasPmid(content) {
  return /pmid:\s*["']?\d{5,}["']?/.test(content);
}

function hasConcreteNumbers(content) {
  // Fixed: accept both decimal AND integer + unit/stat (e.g. "500 mg", "10%", "p < 0.05")
  return /\d+[\.,]?\d*\s*(mg|µg|mcg|g|%|mmol|nmol|IU|SMD|RR|OR|HR|CI|p\s*[<>=]|±|x\s*täglich|x\/Woche)/i.test(content);
}

function hasLimitations(content) {
  const keywords = [
    'limitation', 'limitier', 'einschränk', 'nicht belegt', 'schwache evidenz',
    'kein beleg', 'unklar', 'widersprüch', 'tier', 'in vitro', 'zu wenig',
    'klein', 'kurze laufzeit', 'no evidence', 'insufficient',
  ];
  const lower = content.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function hasEfsaStatus(content) {
  return /efsa\.europa\.eu|efsa\.onlinelibrary|efsa[_\s-]?status/i.test(content);
}

function scoreQuality(content, fm) {
  let score = 0;
  const issues = [];
  const strengths = [];

  // 1. key_studies count (max 30 pts)
  const studyCount = countKeyStudies(content);
  if (studyCount >= 5) { score += 30; strengths.push(`${studyCount} Studien`); }
  else if (studyCount >= 3) { score += 20; strengths.push(`${studyCount} Studien`); }
  else if (studyCount >= 1) { score += 10; issues.push(`Nur ${studyCount} Studie(n)`); }
  else { issues.push('Keine Studien'); }

  // 2. Has PMID (max 10 pts)
  if (hasPmid(content)) { score += 10; strengths.push('PMID'); }
  else { issues.push('Kein PMID'); }

  // 3. Word count (max 20 pts)
  const words = countWords(content);
  if (words >= 800) { score += 20; strengths.push(`${words}w`); }
  else if (words >= 400) { score += 10; issues.push(`Nur ${words}w`); }
  else { issues.push(`Zu kurz: ${words}w`); }

  // 4. Evidence level (max 10 pts)
  const el = parseInt(fm.evidenceLevel || '5');
  if (el <= 2) { score += 10; strengths.push(`EvidenzL${el}`); }
  else if (el === 3) { score += 5; }
  else { issues.push(`Schwache Evidenz (L${el})`); }

  // 5. Concrete numbers / effect sizes (max 10 pts)
  if (hasConcreteNumbers(content)) { score += 10; strengths.push('Effektgrößen'); }
  else { issues.push('Keine konkreten Zahlen'); }

  // 6. Honest limitations (max 10 pts)
  if (hasLimitations(content)) { score += 10; strengths.push('Limitierungen'); }
  else { issues.push('Keine Limitierungen'); }

  // 7. updatedAt freshness (max 5 pts)
  const updated = fm.updatedAt || fm.publishedAt || '';
  const year = parseInt(updated.toString().slice(0, 4));
  if (year >= 2026) { score += 5; strengths.push('2026 aktuell'); }
  else if (year >= 2025) { score += 3; issues.push('Update 2025'); }
  else { issues.push('Veraltet'); }

  // 8. evidenceSummary length (max 10 pts)
  const eSum = String(fm.evidenceSummary || '');
  if (eSum.length >= 150) { score += 10; strengths.push('EvidenceSummary OK'); }
  else if (eSum.length >= 80) { score += 5; issues.push('EvidenceSummary kurz'); }
  else { issues.push('EvidenceSummary fehlt'); }

  // 9. EFSA status (max 5 pts) — was defined but never scored before
  if (hasEfsaStatus(content)) { score += 5; strengths.push('EFSA'); }
  else { issues.push('Kein EFSA-Link'); }

  return { score, issues, strengths, words, studyCount };
}

function getGrade(score) {
  if (score >= 85) return '🟢 A';
  if (score >= 65) return '🟡 B';
  if (score >= 45) return '🟠 C';
  return '🔴 D';
}

// P0/P1/P2 classification (high-priority slugs only)
function getPriority(score, isHigh, idx) {
  if (!isHigh) return 'P3';
  if (score < 65) return 'P0';
  if (score < 80) return 'P1';
  return 'P2';
}

// ─── Main ────────────────────────────────────────────────────────────────────
const files = fs.readdirSync(INGREDIENTS_DIR)
  .filter(f => f.endsWith('.mdx'))
  .sort();

const results = [];

for (const file of files) {
  const slug = file.replace('.mdx', '');
  const content = fs.readFileSync(path.join(INGREDIENTS_DIR, file), 'utf8');
  const fm = parseFrontmatter(content);
  const { score, issues, strengths, words, studyCount } = scoreQuality(content, fm);
  const grade = getGrade(score);
  const isHigh = HIGH_PRIORITY.has(slug);
  const priority = getPriority(score, isHigh);

  results.push({ slug, score, grade, priority, isHigh, words, studyCount, issues, strengths, title: fm.title || slug });
}

// Sort: P0 first, then P1, P2, P3 — within each group worst score first
const PORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
results.sort((a, b) => {
  if (PORDER[a.priority] !== PORDER[b.priority]) return PORDER[a.priority] - PORDER[b.priority];
  return a.score - b.score;
});

// ─── Console output ───────────────────────────────────────────────────────────
console.log('\n🔍 MIKROSCORE DOSSIER QUALITY AUDIT');
console.log('='.repeat(80));

const sections = ['P0', 'P1', 'P2', 'P3'];
const labels = {
  P0: '🔴 P0 — Sofort (hohe Prio + schlechteste Qualität)',
  P1: '🟡 P1 — Bald (hohe Prio, mittlere Qualität)',
  P2: '🟠 P2 — Normalprio (hohe Prio, ordentliche Basis)',
  P3: '⚪ P3 — Niedrige Prio (kein High-Priority Keyword)',
};

for (const p of sections) {
  const items = results.filter(r => r.priority === p);
  if (!items.length) continue;
  console.log(`\n## ${labels[p]} (${items.length})\n`);
  console.log('Score | Note  | Wörter | St | Slug');
  console.log('-'.repeat(70));
  for (const r of items) {
    console.log(`${r.score.toString().padStart(3)}   ${r.grade}   ${r.words.toString().padStart(5)}w  ${r.studyCount.toString().padStart(2)}  ${r.slug}`);
    if (r.issues.length) console.log(`      ⚠️  ${r.issues.join(' · ')}`);
  }
}

// Summary
const grades = { A: 0, B: 0, C: 0, D: 0 };
for (const r of results) {
  const g = r.grade.slice(-1);
  grades[g] = (grades[g] || 0) + 1;
}
console.log('\n' + '='.repeat(80));
console.log(`📊 GESAMT: ${results.length} Dossiers`);
console.log(`   🟢 A (≥85): ${grades.A} | 🟡 B (65-84): ${grades.B} | 🟠 C (45-64): ${grades.C} | 🔴 D (<45): ${grades.D}`);

// ─── Backlog markdown output ──────────────────────────────────────────────────
if (WRITE_BACKLOG) {
  const today = new Date().toISOString().slice(0, 10);
  const p0 = results.filter(r => r.priority === 'P0');
  const p1 = results.filter(r => r.priority === 'P1');
  const p2 = results.filter(r => r.priority === 'P2');
  const good = results.filter(r => r.score >= 85);

  const table = (rows) => [
    '| Prio | Score | Wörter | Slug | Hauptprobleme |',
    '|------|-------|--------|------|---------------|',
    ...rows.map((r, i) => `| ${r.priority}-${i + 1} | ${r.score} | ${r.words} | \`${r.slug}\` | ${r.issues.slice(0, 3).join(', ') || '—'} |`),
  ].join('\n');

  const md = `# Dossier Rewrite Backlog

Stand: ${today} | Generiert via \`scripts/audit-dossiers.cjs --backlog\`

**Qualitätsziel:** Score ≥ 85 (Note A) mit mind. 800 Wörtern, konkreten Effektgrößen, ehrlichen Limitierungen, aktuellem updatedAt.

---

## 🔴 P0 — Sofort (hohe Prio + schlechteste Qualität)

${table(p0)}

---

## 🟡 P1 — Bald (hohe Prio, mittlere Qualität)

${table(p1)}

---

## 🟠 P2 — Normalprio (hohe Prio, ordentliche Basis)

${table(p2)}

---

## 🟢 Bereits gut (Score ≥ 85, kein Rewrite nötig)

| Score | Slug |
|-------|------|
${good.map(r => `| ${r.score} | \`${r.slug}\` ✅ |`).join('\n')}

---

## Rewrite-Workflow

Für jeden Rewrite:
1. PubMed-Digest laufen lassen → neue Studien checken
2. Claude Code spawnen mit Prompt: "Rewrite [slug] mit mind. 800 Wörtern, konkreten Effektgrößen (SMD, %, mg), ehrlichen Limitierungen, EFSA-Status, updatedAt: ${today.slice(0, 7)}-XX"
3. Legal-Check (bestehende Scripts)
4. \`pnpm build\` → commit → push
5. Score nach Rewrite mit \`audit-dossiers.cjs --backlog\` prüfen

**Modell:** Claude Sonnet für Rewrites (Qualität > Kosten bei SEO-kritischen Seiten)
`;

  fs.mkdirSync(path.dirname(BACKLOG_PATH), { recursive: true });
  fs.writeFileSync(BACKLOG_PATH, md, 'utf8');
  console.log(`\n✅ Backlog geschrieben: ${BACKLOG_PATH}`);
}

console.log('');
