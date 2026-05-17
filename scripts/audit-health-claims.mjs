#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/yona/Projects/schwurbel-website';

const DEFAULT_GLOBS = [
  'src/content/ingredients',
  'src/content/products',
  'src/content/claims',
  'src/pages',
];

const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.astro', '.html', '.txt', '.json']);

const RULES = [
  {
    id: 'disease-treatment',
    severity: 'high',
    reason: 'Can read like treatment / prevention / disease-risk language for foods or supplements.',
    patterns: [
      /\bheilt\b/gi,
      /\blindert\b/gi,
      /\btherapie\b/gi,
      /\bbehandl(?:ung|en|t)\b/gi,
      /\bvorbeug(?:en|ung)\b/gi,
      /\bkrankheit(?:en)?\b/gi,
      /\bdepression(?:en)?\b/gi,
      /\bburn-?out\b/gi,
      /\barthrose\b/gi,
      /\bdiabet(?:es|iker|isch)?\b/gi,
      /\bosteoporose\b/gi,
      /\bmakuladegeneration\b/gi,
      /\barterienverkalkung\b/gi,
      /\bneurodegenerativ(?:e|en)?\b/gi,
      /\bherzinsuffizienz\b/gi,
      /\brisikoreduktion\b/gi,
      /\bherzges[üu]nder\b/gi,
    ],
  },
  {
    id: 'unapproved-effect',
    severity: 'high',
    reason: 'Strong health-effect wording that may be interpreted as a health claim.',
    patterns: [
      /\bbelegt f[üu]r\b/gi,
      /\bgut belegt\b/gi,
      /\bnachweislich\b/gi,
      /\bwirkt\b/gi,
      /\bwirksam\b/gi,
      /\bverbessert\b/gi,
      /\bsenkt\b/gi,
      /\berh[öo]ht\b/gi,
      /\bsch[üu]tzt\b/gi,
      /\bregeneriert\b/gi,
      /\bverl[äa]ngert\b/gi,
      /\banti-?aging\b/gi,
      /\blongevity\b/gi,
      /\bneuroprotekt(?:ion|iv)\b/gi,
    ],
  },
  {
    id: 'drug-comparison',
    severity: 'high',
    reason: 'Drug-like comparison or replacement language is especially risky.',
    patterns: [
      /nat[üu]rlich(?:e|es|er)?\s+ozempic/gi,
      /nat[üu]rlich(?:e|es|er)?\s+ibuprofen/gi,
      /\bersetzt\b/gi,
      /\bwie\s+ozempic\b/gi,
      /\bwie\s+ibuprofen\b/gi,
      /\bpharma(?:zeutisch|n[aä]her)?\b/gi,
    ],
  },
  {
    id: 'absolute-safety-marketing',
    severity: 'medium',
    reason: 'Absolute or promotional safety wording can be misleading.',
    patterns: [
      /\bsicher\b/gi,
      /\bperfekt\b/gi,
      /\bideal\b/gi,
      /\btop-preis\b/gi,
      /\bwundermittel\b/gi,
      /\ballheilmittel\b/gi,
      /\bohne nebenwirkungen\b/gi,
      /\bkeine nebenwirkungen\b/gi,
    ],
  },
  {
    id: 'sleep-stress-mood',
    severity: 'medium',
    reason: 'These topics are common health-claim hotspots for supplements in the EU.',
    patterns: [
      /\bschlaf(?:qualit[äa]t|st[öo]rungen?)?\b/gi,
      /\bstress(?:reduktion)?\b/gi,
      /\bstimmung\b/gi,
      /\bcortisol\b/gi,
      /\bgelassenheit\b/gi,
      /\bfokus\b/gi,
      /\bkonzentration\b/gi,
    ],
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.astro'].includes(entry.name)) continue;
      walk(full, out);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function getTargets() {
  const args = process.argv.slice(2);
  const paths = args.length ? args : DEFAULT_GLOBS;
  return paths.flatMap((p) => {
    const full = path.isAbsolute(p) ? p : path.join(root, p);
    if (!fs.existsSync(full)) return [];
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return walk(full, []);
    return TEXT_EXTENSIONS.has(path.extname(full)) ? [full] : [];
  });
}

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split('\n').length;
}

function getLine(text, lineNumber) {
  return text.split('\n')[lineNumber - 1] ?? '';
}

function clip(s, max = 180) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function severityScore(sev) {
  return sev === 'high' ? 2 : sev === 'medium' ? 1 : 0;
}

const files = getTargets();
const findings = [];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(raw)) !== null) {
        const line = lineNumberFromIndex(raw, match.index);
        findings.push({
          file: path.relative(root, file),
          line,
          severity: rule.severity,
          rule: rule.id,
          reason: rule.reason,
          match: match[0],
          excerpt: clip(getLine(raw, line).trim()),
        });
      }
    }
  }
}

findings.sort((a, b) => {
  const sev = severityScore(b.severity) - severityScore(a.severity);
  if (sev) return sev;
  return a.file.localeCompare(b.file) || a.line - b.line;
});

const summary = findings.reduce((acc, f) => {
  acc.total += 1;
  acc[f.severity] += 1;
  return acc;
}, { total: 0, high: 0, medium: 0, low: 0 });

console.log(`Health-claim wording audit\n`);
console.log(`Scanned files: ${files.length}`);
console.log(`Findings: ${summary.total} (high: ${summary.high}, medium: ${summary.medium})\n`);

if (!findings.length) {
  console.log('No suspicious wording found by the heuristic rules.');
  process.exit(0);
}

for (const f of findings) {
  console.log(`[${f.severity.toUpperCase()}] ${f.file}:${f.line}`);
  console.log(`  rule:   ${f.rule}`);
  console.log(`  match:  ${f.match}`);
  console.log(`  why:    ${f.reason}`);
  console.log(`  text:   ${f.excerpt}`);
  console.log('');
}

console.log('How to use this output:');
console.log('- High: usually review manually and rewrite conservatively.');
console.log('- Medium: often okay in context, but check whether it reads like a claim on the rendered page.');
console.log('- Heuristics catch obvious wording, not legal nuance. Borderline cases still benefit from LLM or legal review.');

process.exit(summary.high > 0 ? 2 : 0);
