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

const ALLOW_CONTEXT_PATTERNS = [
  /redaktioneller hinweis/i,
  /rechtlicher hinweis/i,
  /rechtlicher kontext/i,
  /kein(?:e|er)?\s+(zul[aä]ssig(?:e|er)?|zugelassen(?:e|er)?)/i,
  /nicht\s+zugelassen/i,
  /nicht\s+zul[aä]ssig/i,
  /keine?\s+health\s*claims?/i,
  /kein\s+health\s*claim/i,
  /health\s*claim/i,
  /claim-?check/i,
  /der claim/i,
  /unser urteil/i,
  /was efsa/i,
  /was bfr/i,
  /was efsa\s*\/\s*bfr/i,
  /gleichsetzung/i,
  /werbliche aussage/i,
  /werbliche gesundheitsaussage/i,
  /rechtlich problematisch/i,
  /rechtlich riskant/i,
  /rechtlich heikel/i,
  /als werbliche/i,
  /darf .* nicht/i,
  /nicht automatisch als claim/i,
  /^>/, // quoted claim block in markdown
];

const SUGGESTION_MAP = [
  [/\bbelegt f[üu]r\b/gi, 'wird untersucht für'],
  [/\bgut belegt\b/gi, 'vergleichsweise gut untersucht'],
  [/\bnachweislich\b/gi, 'in Studien beschrieben'],
  [/\bwirkt\b/gi, 'wird diskutiert'],
  [/\bwirksam\b/gi, 'plausibel / untersucht'],
  [/\bverbessert\b/gi, 'war mit Veränderungen verbunden'],
  [/\bsenkt\b/gi, 'war mit niedrigeren Werten verbunden'],
  [/\berh[öo]ht\b/gi, 'war mit höheren Werten verbunden'],
  [/\bsch[üu]tzt\b/gi, 'wird mit Schutzmechanismen in Verbindung gebracht'],
  [/\bverl[äa]ngert\b/gi, 'wird im Zusammenhang mit Alterungsforschung diskutiert'],
  [/\blongevity\b/gi, 'gesundes Altern'],
  [/\banti-?aging\b/gi, 'Alterungsforschung'],
  [/\bherzges[üu]nder\b/gi, 'diterpenärmer / im Herz-Kreislauf-Kontext diskutiert'],
  [/nat[üu]rlich(?:e|es|er)?\s+ozempic/gi, 'wird marketingseitig mit Ozempic verglichen'],
  [/nat[üu]rlich(?:e|es|er)?\s+ibuprofen/gi, 'wird marketingseitig mit Ibuprofen verglichen'],
  [/\bwie\s+ozempic\b/gi, 'mit Ozempic verglichen'],
  [/\bwie\s+ibuprofen\b/gi, 'mit Ibuprofen verglichen'],
  [/\bsicher\b/gi, 'gut untersucht / eher gut verträglich'],
  [/\bperfekt\b/gi, 'praktisch'],
  [/\bideal\b/gi, 'gut geeignet'],
  [/\bwundermittel\b/gi, 'pauschale Lösung'],
  [/\ballheilmittel\b/gi, 'universelle Lösung'],
  [/\bohne nebenwirkungen\b/gi, 'mit anderem Nebenwirkungsprofil'],
  [/\bkeine nebenwirkungen\b/gi, 'nicht frei von möglichen Nebenwirkungen'],
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

function getContextWindow(text, lineNumber, radius = 1) {
  const lines = text.split('\n');
  const start = Math.max(0, lineNumber - 1 - radius);
  const end = Math.min(lines.length, lineNumber + radius);
  return lines.slice(start, end).join('\n');
}

function clip(s, max = 180) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function severityScore(sev) {
  return sev === 'high' ? 2 : sev === 'medium' ? 1 : 0;
}

function isAllowedContext(line, windowText) {
  return ALLOW_CONTEXT_PATTERNS.some((re) => re.test(line) || re.test(windowText));
}

function buildSuggestion(line, matchText) {
  let suggestion = line;
  let changed = false;
  for (const [pattern, replacement] of SUGGESTION_MAP) {
    const before = suggestion;
    suggestion = suggestion.replace(pattern, replacement);
    if (suggestion !== before) changed = true;
  }

  if (!changed) {
    suggestion = line.replace(matchText, `[vorsichtiger formulieren: ${matchText}]`);
  }

  return clip(suggestion.trim(), 220);
}

const files = getTargets();
const findings = [];
const skipped = [];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(raw)) !== null) {
        const line = lineNumberFromIndex(raw, match.index);
        const lineText = getLine(raw, line).trim();
        const windowText = getContextWindow(raw, line, 1);

        if (isAllowedContext(lineText, windowText)) {
          skipped.push({
            file: path.relative(root, file),
            line,
            rule: rule.id,
            match: match[0],
          });
          continue;
        }

        findings.push({
          file: path.relative(root, file),
          line,
          severity: rule.severity,
          rule: rule.id,
          reason: rule.reason,
          match: match[0],
          excerpt: clip(lineText),
          suggestion: buildSuggestion(lineText, match[0]),
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
console.log(`Findings: ${summary.total} (high: ${summary.high}, medium: ${summary.medium})`);
console.log(`Skipped by allowlist/context: ${skipped.length}\n`);

if (!findings.length) {
  console.log('No suspicious wording found by the heuristic rules.');
  process.exit(0);
}

for (const f of findings) {
  console.log(`[${f.severity.toUpperCase()}] ${f.file}:${f.line}`);
  console.log(`  rule:       ${f.rule}`);
  console.log(`  match:      ${f.match}`);
  console.log(`  why:        ${f.reason}`);
  console.log(`  text:       ${f.excerpt}`);
  console.log(`  suggestion: ${f.suggestion}`);
  console.log('');
}

console.log('How to use this output:');
console.log('- High: usually review manually and rewrite conservatively.');
console.log('- Medium: often okay in context, but check whether it reads like a claim on the rendered page.');
console.log('- Suggestions are intentionally weak rewrites, not legal guarantees.');
console.log('- Heuristics catch obvious wording, not legal nuance. Borderline cases still benefit from LLM or legal review.');

process.exit(summary.high > 0 ? 2 : 0);
