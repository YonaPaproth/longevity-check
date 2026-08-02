#!/usr/bin/env node
/**
 * Preview MDX draft files as HTML in the browser.
 *
 * Usage:
 *   node scripts/preview-draft.js backlog/research-review-drafts/2026-07-25.mdx
 *   node scripts/preview-draft.js --latest
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DRAFT_DIR = path.join(ROOT, 'backlog', 'research-review-drafts');

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let mdxPath;

if (args[0] === '--latest' || !args[0]) {
  // Find newest .mdx in drafts dir
  const files = fs.readdirSync(DRAFT_DIR)
    .filter(f => f.endsWith('.mdx'))
    .sort()
    .reverse();
  if (!files.length) { console.error('No drafts found in', DRAFT_DIR); process.exit(1); }
  mdxPath = path.join(DRAFT_DIR, files[0]);
  console.log(`Using latest draft: ${files[0]}`);
} else {
  mdxPath = path.resolve(args[0]);
}

if (!fs.existsSync(mdxPath)) {
  console.error('File not found:', mdxPath);
  process.exit(1);
}

// ── MDX → HTML (simple, no Astro needed) ─────────────────────────────────────
const raw = fs.readFileSync(mdxPath, 'utf8');

// Strip frontmatter
const body = raw.replace(/^---[\s\S]*?---\n*/, '');

// Basic markdown → HTML
function md2html(md) {
  let html = md;

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="code"><code>${escHtml(code.trim())}</code></pre>`);

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Bold / italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Blockquote
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

  // Tables
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, table => {
    const rows = table.trim().split('\n').filter(r => !/^\|[\s-|]+\|$/.test(r));
    if (!rows.length) return table;
    const header = rows[0];
    const body = rows.slice(1);
    const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const trs = body.map(row => {
      const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('\n');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // Lists
  html = html.replace(/((?:^[ \t]*[-*+] .+$\n?)+)/gm, list => {
    const items = list.trim().split('\n').map(l => {
      const text = l.replace(/^[ \t]*[-*+] /, '');
      return `<li>${text}</li>`;
    }).join('\n');
    return `<ul>${items}</ul>`;
  });

  html = html.replace(/((?:^[ \t]*\d+\. .+$\n?)+)/gm, list => {
    const items = list.trim().split('\n').map(l => {
      const text = l.replace(/^[ \t]*\d+\. /, '');
      return `<li>${text}</li>`;
    }).join('\n');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: wrap remaining bare lines
  html = html.split(/\n{2,}/).map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|table|pre|blockquote|hr|div)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Extract title from frontmatter
const titleMatch = raw.match(/title:\s*"(.+)"/);
const title = titleMatch?.[1] ?? path.basename(mdxPath, '.mdx');

const bodyHtml = md2html(body);

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)} — Preview</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f8fafc; color: #1e293b; line-height: 1.7; }
  .container { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
  .preview-banner { background: #0d9488; color: white; padding: 0.75rem 1.5rem;
                    font-size: 0.875rem; border-radius: 8px; margin-bottom: 2rem;
                    display: flex; justify-content: space-between; align-items: center; }
  .preview-banner span { opacity: 0.85; }
  h1 { font-size: 2rem; font-weight: 700; margin: 2rem 0 1rem; color: #0f172a; }
  h2 { font-size: 1.5rem; font-weight: 600; margin: 1.75rem 0 0.75rem; color: #0f172a;
       border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
  h3 { font-size: 1.2rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: #1e293b; }
  h4 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
  p { margin: 0.75rem 0; }
  ul, ol { margin: 0.75rem 0 0.75rem 1.5rem; }
  li { margin: 0.375rem 0; }
  a { color: #0d9488; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px;
         font-family: 'SF Mono', Monaco, monospace; font-size: 0.875em; }
  pre.code { background: #1e293b; color: #e2e8f0; padding: 1rem 1.25rem;
             border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
  pre.code code { background: none; padding: 0; color: inherit; }
  blockquote { border-left: 4px solid #0d9488; padding: 0.5rem 1rem;
               background: #f0fdfa; margin: 1rem 0; border-radius: 0 8px 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th { background: #f1f5f9; padding: 0.5rem 0.75rem; text-align: left;
       font-weight: 600; border: 1px solid #e2e8f0; }
  td { padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  hr { border: none; border-top: 2px solid #e2e8f0; margin: 2rem 0; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px;
           font-size: 0.75rem; font-weight: 600; }
  .file-path { font-family: monospace; font-size: 0.75rem; color: #64748b;
               margin-top: 0.5rem; }
</style>
</head>
<body>
<div class="container">
  <div class="preview-banner">
    <strong>📄 Draft Preview</strong>
    <span>${escHtml(title)}</span>
  </div>
  <div class="file-path">${escHtml(mdxPath)}</div>
  ${bodyHtml}
</div>
</body>
</html>`;

// ── Write + Open ──────────────────────────────────────────────────────────────
const outPath = path.join(ROOT, 'backlog', 'preview-draft.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Preview written:', outPath);

try {
  execSync(`open "${outPath}"`);
  console.log('Opened in browser ✓');
} catch {
  console.log('Could not auto-open browser. Open manually:', outPath);
}
