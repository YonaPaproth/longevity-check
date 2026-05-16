import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/yona/Projects/schwurbel-website';
const ingredientsDir = path.join(root, 'src/content/ingredients');
const backlogPath = path.join(root, 'backlog/ingredients-top-100.md');

const issues = [];
const warnings = [];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

function getField(frontmatter, field) {
  const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(re);
  return match ? match[1].trim() : null;
}

function getStringField(frontmatter, field) {
  const raw = getField(frontmatter, field);
  if (!raw) return null;
  const quoted = raw.match(/^"([\s\S]*)"$/);
  return quoted ? quoted[1] : raw;
}

function getBlock(frontmatter, field) {
  const start = frontmatter.indexOf(`${field}:`);
  if (start === -1) return null;

  const afterStart = frontmatter.slice(start);
  const lines = afterStart.split('\n');
  const collected = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) {
      collected.push(line.replace(new RegExp(`^${field}:\\s*`), ''));
      continue;
    }

    if (/^\w[\w_]*:\s*/.test(line)) break;
    collected.push(line);
  }

  return collected.join('\n');
}

function parseAliases(frontmatter) {
  const block = getBlock(frontmatter, 'aliases');
  if (!block) return [];
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function parseKeyStudies(frontmatter) {
  const block = getBlock(frontmatter, 'key_studies');
  if (!block) return [];
  return block.split(/^\s*-\s+/m).filter(Boolean);
}

function parseBacklog(md) {
  const rows = md.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line));
  return rows.map((line) => {
    const cols = line.split('|').map((c) => c.trim());
    return {
      rank: cols[1],
      name: cols[2],
      slug: cols[3],
      status: cols[4],
      lastUpdated: cols[5],
      notes: cols[6],
    };
  });
}

const files = fs.readdirSync(ingredientsDir).filter((f) => f.endsWith('.mdx')).sort();
const seenSlugs = new Set();

for (const file of files) {
  const fullPath = path.join(ingredientsDir, file);
  const raw = read(fullPath);
  const frontmatter = parseFrontmatter(raw);

  if (!frontmatter) {
    issues.push(`${file}: missing frontmatter`);
    continue;
  }

  const title = getStringField(frontmatter, 'title');
  const slug = getStringField(frontmatter, 'slug');
  const summary = getStringField(frontmatter, 'summary');
  const publishedAt = getField(frontmatter, 'publishedAt');
  const updatedAt = getField(frontmatter, 'updatedAt');
  const aliases = parseAliases(frontmatter);
  const keyStudies = parseKeyStudies(frontmatter);

  if (!title) issues.push(`${file}: missing title`);
  if (!slug) issues.push(`${file}: missing slug`);
  if (!summary) issues.push(`${file}: missing summary`);
  if (!publishedAt) issues.push(`${file}: missing publishedAt`);

  if (slug) {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      issues.push(`${file}: invalid slug '${slug}'`);
    }
    if (seenSlugs.has(slug)) {
      issues.push(`${file}: duplicate slug '${slug}'`);
    }
    seenSlugs.add(slug);

    const expectedFile = `${slug}.mdx`;
    if (file !== expectedFile) {
      warnings.push(`${file}: filename does not match slug (expected ${expectedFile})`);
    }
  }

  if (summary && summary.length > 200) {
    issues.push(`${file}: summary too long (${summary.length}/200)`);
  }

  if (aliases.length === 0) {
    warnings.push(`${file}: aliases array looks empty`);
  }

  if (keyStudies.length === 0) {
    issues.push(`${file}: key_studies missing`);
  }

  if (!updatedAt) {
    warnings.push(`${file}: missing updatedAt`);
  }

  for (const study of keyStudies) {
    const hasPmid = /pmid:\s*"[^"]+"/.test(study);
    const hasUrl = /url:\s*"https?:\/\/[^\"]+"/.test(study);
    if (!hasPmid && !hasUrl) {
      warnings.push(`${file}: key_study missing PMID and URL`);
      break;
    }
  }
}

const backlog = parseBacklog(read(backlogPath));
const fileSlugs = new Set(files.map((f) => f.replace(/\.mdx$/, '')));
const backlogSlugs = new Set(backlog.map((r) => r.slug));

for (const row of backlog) {
  const exists = fileSlugs.has(row.slug);
  if (row.status === 'done' && !exists) {
    issues.push(`backlog: ${row.slug} marked done but file is missing`);
  }
  if (exists && row.status !== 'done') {
    warnings.push(`backlog: ${row.slug} has file but status is '${row.status}'`);
  }
  if (row.status === 'done' && !row.lastUpdated) {
    warnings.push(`backlog: ${row.slug} marked done without last_updated`);
  }
}

for (const slug of fileSlugs) {
  if (!backlogSlugs.has(slug)) {
    warnings.push(`backlog: missing row for existing file '${slug}'`);
  }
}

console.log(`Checked ${files.length} ingredient files and ${backlog.length} backlog rows.\n`);

if (issues.length) {
  console.log('ERRORS:');
  for (const issue of issues) console.log(`- ${issue}`);
  console.log('');
}

if (warnings.length) {
  console.log('WARNINGS:');
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log('');
}

if (!issues.length && !warnings.length) {
  console.log('No issues found.');
}

process.exit(issues.length ? 1 : 0);
