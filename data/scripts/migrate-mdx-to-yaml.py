#!/usr/bin/env python3
"""
migrate-mdx-to-yaml.py — Batch-migrate MDX dossiers to YAML Single Source of Truth

Usage:
  python3 data/scripts/migrate-mdx-to-yaml.py                  # all unmigrated
  python3 data/scripts/migrate-mdx-to-yaml.py eisen calcium     # specific slugs
  python3 data/scripts/migrate-mdx-to-yaml.py --dry-run         # preview only
  python3 data/scripts/migrate-mdx-to-yaml.py --list-missing-en # show slugs needing EN

Reads:
  - src/content/ingredients/<slug>.mdx (DE)
  - src/content/en/ingredients/<slug>.mdx (EN, if exists)
  - data/relations/by-entity/<slug>.json

Writes:
  - data/sources/ingredients/<slug>.yaml

Skips slugs that already have a YAML source file.
"""

import json, re, sys, os
from pathlib import Path

try:
    import yaml
except ImportError:
    print("pip3 install pyyaml")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent.parent
DE_DIR = ROOT / "src/content/ingredients"
EN_DIR = ROOT / "src/content/en/ingredients"
REL_DIR = ROOT / "data/relations/by-entity"
SRC_DIR = ROOT / "data/sources/ingredients"
SRC_DIR.mkdir(parents=True, exist_ok=True)


def extract_fm_body(path):
    """Extract frontmatter dict and body string from MDX."""
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n?(.*)", text, re.DOTALL)
    if not m:
        return {}, ""
    fm = yaml.safe_load(m.group(1))
    body = m.group(2).strip()
    # Remove generator comment if present
    body = re.sub(r"^\{/\*.*?\*/\}\s*", "", body).strip()
    return fm or {}, body


def build_yaml(slug, dry_run=False):
    """Build YAML source from existing MDX + relations."""
    de_path = DE_DIR / f"{slug}.mdx"
    if not de_path.exists():
        print(f"  ✗ {slug}: DE MDX not found")
        return False

    de_fm, de_body = extract_fm_body(de_path)
    if not de_fm:
        print(f"  ✗ {slug}: empty DE frontmatter")
        return False

    # EN (optional)
    en_path = EN_DIR / f"{slug}.mdx"
    en_fm, en_body = ({}, "") if not en_path.exists() else extract_fm_body(en_path)

    # Relations
    rel_path = REL_DIR / f"{slug}.json"
    relations = []
    if rel_path.exists():
        relations = json.loads(rel_path.read_text())["relations"]

    # Build key_studies with bilingual findings
    en_studies = {s.get("pmid", ""): s for s in en_fm.get("key_studies", [])}
    studies_lines = []
    for s in de_fm.get("key_studies", [])[:5]:
        pmid = s.get("pmid", "")
        en_s = en_studies.get(pmid, {})
        de_finding = s.get("finding", "").replace("\n", " ").strip()
        en_finding = en_s.get("finding", f"NEEDS_EN_TRANSLATION").replace("\n", " ").strip()
        url_line = f'    url: "{s["url"]}"\n' if s.get("url") else ""
        studies_lines.append(
            f'  - pmid: "{pmid}"\n'
            f'    title: "{s["title"].replace(chr(34), chr(39))}"\n'
            f'    authors: "{s["authors"]}"\n'
            f"    year: {s['year']}\n"
            f"{url_line}"
            f"    finding:\n"
            f"      de: >-\n        {de_finding}\n"
            f"      en: >-\n        {en_finding}\n"
        )

    # EN summaries
    en_title = en_fm.get("title", de_fm["title"]) if en_fm else de_fm["title"]
    en_efsa = en_fm.get("efsa_notes", "NEEDS_EN_TRANSLATION") if en_fm else "NEEDS_EN_TRANSLATION"
    en_summary = en_fm.get("summary", "NEEDS_EN_TRANSLATION") if en_fm else "NEEDS_EN_TRANSLATION"
    en_evidence = en_fm.get("evidenceSummary", "NEEDS_EN_TRANSLATION") if en_fm else "NEEDS_EN_TRANSLATION"
    if not en_body:
        en_body = "NEEDS_EN_BODY"

    # Aliases
    aliases_lines = "\n".join(f'    - "{a}"' for a in de_fm.get("aliases", []))

    # Relations
    rel_lines = []
    for r in relations:
        rl = (
            f"  - relation: {r['relation']}\n"
            f"    target: {r['target']}\n"
            f"    direction: {r.get('direction', 'outgoing')}\n"
            f"    confidence: {r.get('confidence', 0.7)}"
        )
        if r.get("source"):
            rl += f'\n    source: "{r["source"]}"'
        rel_lines.append(rl)

    # Body indentation
    de_body_indented = "\n".join(f"      {line}" for line in de_body.split("\n"))
    en_body_indented = "\n".join(f"      {line}" for line in en_body.split("\n"))

    content = f"""---
id: {slug}
type: ingredient

meta:
  title:
    de: "{de_fm['title']}"
    en: "{en_title}"
  aliases:
{aliases_lines}
  category: {de_fm.get('category', 'other')}
  evidenceLevel: "{de_fm.get('evidenceLevel', '3')}"
  safety_rating: {de_fm.get('safety_rating', 'likely-safe')}
  efsa_health_claims_allowed: {'true' if de_fm.get('efsa_health_claims_allowed') else 'false'}
  typical_dose_mg: {de_fm.get('typical_dose_mg', 0)}
  publishedAt: "{de_fm.get('publishedAt', '2026-05-14')}"
  updatedAt: "2026-06-13"

efsa_notes:
  de: >-
    {de_fm.get('efsa_notes', '').replace(chr(10), ' ').strip()}
  en: >-
    {en_efsa.replace(chr(10), ' ').strip()}

key_studies:
{"".join(studies_lines)}
locales:
  de:
    summary: >-
      {de_fm.get('summary', '').replace(chr(10), ' ').strip()}
    evidenceSummary: >-
      {de_fm.get('evidenceSummary', '').replace(chr(10), ' ').strip()}
    body: |
{de_body_indented}

  en:
    summary: >-
      {en_summary.replace(chr(10), ' ').strip()}
    evidenceSummary: >-
      {en_evidence.replace(chr(10), ' ').strip()}
    body: |
{en_body_indented}

relations:
{chr(10).join(rel_lines)}
"""

    if dry_run:
        needs = "NEEDS_EN" if "NEEDS_EN" in content else "complete"
        print(f"  → {slug}.yaml ({needs}, {len(content)} bytes)")
        return True

    out_path = SRC_DIR / f"{slug}.yaml"
    out_path.write_text(content, encoding="utf-8")
    needs = "NEEDS_EN" if "NEEDS_EN" in content else "complete"
    print(f"  ✓ {slug}.yaml ({needs})")
    return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    dry_run = "--dry-run" in sys.argv
    list_en = "--list-missing-en" in sys.argv

    # Get all DE slugs
    all_slugs = sorted(p.stem for p in DE_DIR.glob("*.mdx"))

    # Already migrated
    existing = {p.stem for p in SRC_DIR.glob("*.yaml")}

    if args:
        slugs = args
    else:
        slugs = [s for s in all_slugs if s not in existing]

    if list_en:
        for s in all_slugs:
            en = EN_DIR / f"{s}.mdx"
            if not en.exists():
                print(s)
        return

    if not slugs:
        print(f"All {len(existing)} slugs already migrated. Nothing to do.")
        return

    print(f"Migrating {len(slugs)} ingredients (skipping {len(existing)} existing)...\n")

    ok = 0
    for slug in slugs:
        if slug in existing and slug not in args:
            continue
        if build_yaml(slug, dry_run):
            ok += 1

    print(f"\n✓ {ok}/{len(slugs)} migrated")
    if not dry_run:
        needs_en = sum(1 for p in SRC_DIR.glob("*.yaml") if "NEEDS_EN" in p.read_text())
        print(f"  {needs_en} need EN translation (search for NEEDS_EN)")


if __name__ == "__main__":
    main()
