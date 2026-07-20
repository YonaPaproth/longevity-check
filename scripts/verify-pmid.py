#!/usr/bin/env python3
"""
Verify that PMIDs in study YAMLs match the actual PubMed titles.

Usage:
  python3 scripts/verify-pmid.py                    # verify all studies
  python3 scripts/verify-pmid.py pmid-12345678      # verify single study
  python3 scripts/verify-pmid.py --changed          # verify only git-changed studies
"""

import json, yaml, glob, subprocess, sys, time, re
from difflib import SequenceMatcher

BATCH_SIZE = 200
SIMILARITY_THRESHOLD = 0.5  # Below this = likely wrong PMID

def normalize(title):
    """Normalize title for comparison."""
    return re.sub(r'[^a-z0-9\s]', '', title.lower()).strip()

def similarity(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

def fetch_titles(pmids):
    """Fetch titles from PubMed for a batch of PMIDs."""
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={",".join(pmids)}&retmode=json'
    result = subprocess.run(['curl', '-s', '--max-time', '30', url], capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f'curl failed: {result.stderr}')
    data = json.loads(result.stdout)
    result_data = data.get('result', {})
    titles = {}
    for uid in result_data.get('uids', []):
        titles[uid] = result_data[uid].get('title', '')
    return titles

def load_studies(filter_changed=False, single=None):
    """Load study YAMLs to verify."""
    if single:
        files = [f'data/sources/studies/{single}.yaml'] if not single.endswith('.yaml') else [single]
    elif filter_changed:
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD', '--', 'data/sources/studies/'],
            capture_output=True, text=True, cwd='/Users/yona/Projects/schwurbel-website'
        )
        result2 = subprocess.run(
            ['git', 'ls-files', '--others', '--exclude-standard', '--', 'data/sources/studies/'],
            capture_output=True, text=True, cwd='/Users/yona/Projects/schwurbel-website'
        )
        files = [f.strip() for f in (result.stdout + result2.stdout).split('\n') if f.strip().endswith('.yaml')]
    else:
        files = sorted(glob.glob('data/sources/studies/pmid-*.yaml'))

    studies = []
    for f in files:
        try:
            with open(f) as fh:
                docs = list(yaml.safe_load_all(fh))
                d = docs[0] if docs else {}
            if d.get('pmid') and d.get('title'):
                studies.append({
                    'file': f,
                    'id': d.get('id', ''),
                    'pmid': str(d['pmid']),
                    'title': str(d['title']),
                })
        except Exception as e:
            print(f'  ⚠ Error reading {f}: {e}')
    return studies

def main():
    single = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else None
    changed_only = '--changed' in sys.argv

    studies = load_studies(filter_changed=changed_only, single=single)
    if not studies:
        print('No studies to verify.')
        return

    print(f'Verifying {len(studies)} studies against PubMed...\n')

    pmids = [s['pmid'] for s in studies]
    pmid_to_study = {s['pmid']: s for s in studies}

    # Fetch in batches
    all_titles = {}
    for i in range(0, len(pmids), BATCH_SIZE):
        batch = pmids[i:i + BATCH_SIZE]
        print(f'  Fetching batch {i // BATCH_SIZE + 1} ({len(batch)} PMIDs)...', end=' ')
        try:
            titles = fetch_titles(batch)
            all_titles.update(titles)
            print(f'✓ {len(titles)} titles')
        except Exception as e:
            print(f'✗ {e}')
        if i + BATCH_SIZE < len(pmids):
            time.sleep(0.4)

    # Compare
    mismatches = []
    not_found = []
    ok = 0

    for study in studies:
        pmid = study['pmid']
        yaml_title = study['title']
        pubmed_title = all_titles.get(pmid, '')

        if not pubmed_title:
            not_found.append(study)
            continue

        sim = similarity(yaml_title, pubmed_title)
        if sim < SIMILARITY_THRESHOLD:
            mismatches.append({
                **study,
                'pubmed_title': pubmed_title,
                'similarity': round(sim, 2),
            })
        else:
            ok += 1

    # Report
    print(f'\n{"=" * 60}')
    print(f'✅ OK: {ok}')
    print(f'❌ MISMATCH: {len(mismatches)}')
    print(f'⚠️  NOT FOUND in PubMed: {len(not_found)}')

    if mismatches:
        print(f'\n{"=" * 60}')
        print('MISMATCHED STUDIES (YAML title ≠ PubMed title):\n')
        for m in mismatches:
            print(f'  PMID: {m["pmid"]}')
            print(f'  YAML:   {m["title"][:80]}')
            print(f'  PubMed: {m["pubmed_title"][:80]}')
            print(f'  Similarity: {m["similarity"]}')
            print(f'  File: {m["file"]}')
            print()

    if not_found:
        print(f'\nNOT FOUND in PubMed:\n')
        for s in not_found:
            print(f'  {s["pmid"]}: {s["title"][:60]} ({s["file"]})')

    # Exit code for CI integration
    if mismatches:
        sys.exit(1)

if __name__ == '__main__':
    main()
