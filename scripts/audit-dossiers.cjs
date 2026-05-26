#!/usr/bin/env node
/**
 * MikroScore Dossier Quality Audit
 * Evaluates all ingredient MDX files and outputs a prioritized table.
 */

const fs = require('fs');
const path = require('path');

const INGREDIENTS_DIR = path.join(__dirname, '../src/content/ingredients');

// High-priority slugs (high search volume)
const HIGH_PRIORITY = new Set([
  'nmn', 'nr', 'ashwagandha', 'omega-3', 'magnesium', 'vitamin-d3', 'vitamin-d3-k2',
  'kreatin', 'berberin', 'curcumin', 'resveratrol', 'coq10', 'zink', 'vitamin-b12',
  'omega-3', 'kollagen', 'melatonin', 'l-theanin', 'probiotika', 'glutathion',
  'nac', 'glycin', 'taurin', 'quercetin', 'fisetin', 'spermidine', 'urolithin-a',
  'ashwagandha', 'rhodiola', 'lion-s-mane', 'alpha-liponsaeure', 'koffein',
  'beta-alanin', 'l-citrullin', 'selen', 'jod', 'folat', 'hyaluronsaeure',
]);

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const fm = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let inArray = false;
  let arrayItems = [];

  for (const line of lines) {
    // Simple key: value
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
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
    } else if (line.match(/^  - /) && inArray) {
      arrayItems.push(line.replace(/^  - /, '').trim());
    }
  }
  if (inArray && currentKey) fm[currentKey] = arrayItems;

  return fm;
}

function countWords(text) {
  return text.replace(/---[\s\S]*?---/, '').replace(/[#*`\[\]]/g, '').split(/\s+/).filter(w => w.length > 2).length;
}

function countKeyStudies(content) {
  const matches = content.match(/- title:/g);
  return matches ? matches.length : 0;
}

function hasPmid(content) {
  return /pmid:\s*["']?\d{5,}["']?/.test(content);
}

function hasConcreteNumbers(content) {
  // Look for effect sizes, percentages, specific values
  return /\d+[\.,]\d+\s*(mg|µg|g|%|mmol|SMD|RR|OR|CI|p\s*[<>]|±)/.test(content);
}

function hasLimitations(content) {
  const keywords = ['limitation', 'limitier', 'einschränk', 'nicht belegt', 'schwache evidenz', 'kein beleg', 'unklar', 'widersprüch'];
  const lower = content.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function hasEfsaLink(content) {
  return /efsa\.europa\.eu|efsa\.onlinelibrary/.test(content);
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
  if (hasPmid(content)) { score += 10; strengths.push('PMID vorhanden'); }
  else { issues.push('Kein PMID'); }

  // 3. Word count (max 20 pts)
  const words = countWords(content);
  if (words >= 800) { score += 20; strengths.push(`${words} Wörter`); }
  else if (words >= 400) { score += 10; issues.push(`Nur ${words} Wörter`); }
  else { issues.push(`Zu kurz: ${words} Wörter`); }

  // 4. Evidence level (max 10 pts)
  const el = parseInt(fm.evidenceLevel || '5');
  if (el <= 2) { score += 10; strengths.push(`EvidenzL ${el}`); }
  else if (el === 3) { score += 5; }
  else { issues.push(`Schwache Evidenz (L${el})`); }

  // 5. Concrete numbers / effect sizes (max 10 pts)
  if (hasConcreteNumbers(content)) { score += 10; strengths.push('Effektgrößen'); }
  else { issues.push('Keine konkreten Zahlen'); }

  // 6. Honest limitations (max 10 pts)
  if (hasLimitations(content)) { score += 10; strengths.push('Limitierungen'); }
  else { issues.push('Keine Limitierungen'); }

  // 7. updatedAt freshness (max 10 pts)
  const updated = fm.updatedAt || fm.publishedAt || '';
  const year = parseInt(updated.toString().slice(0, 4));
  if (year >= 2026) { score += 10; strengths.push('2026 aktuell'); }
  else if (year >= 2025) { score += 5; issues.push('Update 2025'); }
  else { issues.push('Veraltet'); }

  // 8. evidenceSummary length (max 10 pts)
  const eSum = fm.evidenceSummary || '';
  if (eSum.length >= 150) { score += 10; }
  else if (eSum.length >= 80) { score += 5; issues.push('EvidenceSummary kurz'); }
  else { issues.push('EvidenceSummary fehlt/zu kurz'); }

  return { score, issues, strengths, words, studyCount };
}

function getGrade(score) {
  if (score >= 85) return '🟢 A';
  if (score >= 65) return '🟡 B';
  if (score >= 45) return '🟠 C';
  return '🔴 D';
}

// Main
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
  const priority = HIGH_PRIORITY.has(slug) ? '⭐ Hoch' : 'Normal';

  results.push({ slug, score, grade, priority, words, studyCount, issues, strengths, title: fm.title || slug });
}

// Sort: high priority first, then by score ascending (worst first within priority)
results.sort((a, b) => {
  if (a.priority !== b.priority) return a.priority === '⭐ Hoch' ? -1 : 1;
  return a.score - b.score;
});

// Output
console.log('\n🔍 MIKROSCORE DOSSIER QUALITY AUDIT');
console.log('='.repeat(80));

const highPri = results.filter(r => r.priority === '⭐ Hoch');
const normal = results.filter(r => r.priority === 'Normal');

const printSection = (title, items) => {
  console.log(`\n## ${title} (${items.length})\n`);
  console.log('Score | Note | Wörter | Studien | Slug');
  console.log('-'.repeat(70));
  for (const r of items) {
    const issueStr = r.issues.slice(0, 2).join(', ');
    console.log(`${r.score.toString().padStart(3)}   ${r.grade}  ${r.words.toString().padStart(5)}w  ${r.studyCount}St   ${r.slug}`);
    if (r.issues.length) console.log(`      ⚠️  ${issueStr}`);
  }
};

printSection('⭐ HIGH PRIORITY (nach Rewrite priorisieren)', highPri);
printSection('Normal', normal);

// Summary stats
const grades = { A: 0, B: 0, C: 0, D: 0 };
for (const r of results) {
  const g = r.grade.slice(-1);
  grades[g]++;
}

console.log('\n' + '='.repeat(80));
console.log(`📊 GESAMT: ${results.length} Dossiers`);
console.log(`   🟢 A (≥85): ${grades.A} | 🟡 B (65-84): ${grades.B} | 🟠 C (45-64): ${grades.C} | 🔴 D (<45): ${grades.D}`);
console.log(`\n🎯 TOP 10 REWRITE-KANDIDATEN (hohe Prio + schlechteste Qualität):`);
const top10 = highPri.slice(0, 10);
for (const r of top10) {
  console.log(`   ${r.grade} ${r.score}/100 — ${r.slug}: ${r.issues.join(' · ')}`);
}
console.log('');
