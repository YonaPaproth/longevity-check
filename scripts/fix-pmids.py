#!/usr/bin/env python3
"""
Auto-fix wrong PMIDs by searching PubMed for each study title.

For each study YAML where the PMID doesn't match PubMed's title:
1. Search PubMed esearch for the YAML title
2. Compare results with similarity scoring
3. If a match > 80% similarity is found, update the PMID
4. Rename the file, update ingredient YAMLs, update KG relations

Usage:
  python3 scripts/fix-pmids.py              # dry run (report only)
  python3 scripts/fix-pmids.py --apply      # apply fixes
  python3 scripts/fix-pmids.py --apply --threshold 0.7  # lower threshold
"""

import json, yaml, glob, subprocess, sys, time, re, os
from difflib import SequenceMatcher

SIMILARITY_THRESHOLD = 0.80
RATE_DELAY = 0.4

def normalize(title):
    return re.sub(r'[^a-z0-9\s]', '', title.lower()).strip()

def similarity(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

def esearch(query, max_results=5):
    """Search PubMed for a title, return list of PMIDs."""
    # Clean query for URL
    q = re.sub(r'[^\w\s]', ' ', query).strip()
    q = re.sub(r'\s+', '+', q)
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={q}&retmax={max_results}&retmode=json'
    result = subprocess.run(['curl', '-s', '--max-time', '15', url], capture_output=True, text=True)
    if result.returncode != 0:
        return []
    try:
        data = json.loads(result.stdout)
        return data.get('esearchresult', {}).get('idlist', [])
    except:
        return []

def esummary(pmids):
    """Fetch titles for a list of PMIDs."""
    if not pmids:
        return {}
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={",".join(pmids)}&retmode=json'
    result = subprocess.run(['curl', '-s', '--max-time', '15', url], capture_output=True, text=True)
    if result.returncode != 0:
        return {}
    try:
        data = json.loads(result.stdout)
        result_data = data.get('result', {})
        return {uid: result_data[uid] for uid in result_data.get('uids', [])}
    except:
        return {}

def load_mismatches():
    """Load studies that failed verification (from verify-pmid.py output)."""
    # Re-run verification to get current mismatches
    studies = []
    for f in sorted(glob.glob('data/sources/studies/pmid-*.yaml')):
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
                    'authors': str(d.get('authors', '')),
                    'year': d.get('year', ''),
                    'data': d,
                })
        except:
            pass
    return studies

def find_correct_pmid(title, year=None, authors=None):
    """Search PubMed for a study title and return best matching PMID."""
    # Try exact title search first
    pmids = esearch(f'"{title}"[Title]', max_results=3)
    if not pmids:
        # Try title without quotes
        pmids = esearch(f'{title}[Title]', max_results=5)
    if not pmids:
        # Try key words from title
        words = title.split()[:6]
        pmids = esearch(' '.join(words) + '[Title]', max_results=5)
    if not pmids:
        return None, 0

    time.sleep(RATE_DELAY)
    summaries = esummary(pmids)

    best_pmid = None
    best_sim = 0

    for pmid, data in summaries.items():
        pubmed_title = data.get('title', '')
        sim = similarity(title, pubmed_title)

        # Bonus for year match
        if year and str(data.get('pubdate', '')).startswith(str(year)):
            sim += 0.05

        if sim > best_sim:
            best_sim = sim
            best_pmid = pmid

    return best_pmid, best_sim

def apply_fix(study, new_pmid):
    """Apply a PMID fix: update YAML, rename file, update ingredient refs."""
    old_pmid = study['pmid']
    old_file = study['file']
    new_file = f'data/sources/studies/pmid-{new_pmid}.yaml'

    # Skip if target file already exists
    if os.path.exists(new_file) and old_file != new_file:
        return False, f'target exists: {new_file}'

    # Update study YAML
    data = study['data']
    data['id'] = f'pmid-{new_pmid}'
    data['pmid'] = new_pmid
    data['url'] = f'https://pubmed.ncbi.nlm.nih.gov/{new_pmid}/'

    with open(new_file, 'w') as f:
        f.write('---\n')
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        f.write('---\n')

    if old_file != new_file:
        os.remove(old_file)

    # Update ingredient YAMLs that reference this PMID
    old_ref = f'pmid-{old_pmid}'
    new_ref = f'pmid-{new_pmid}'
    old_studie = f'studie-{old_pmid}'
    new_studie = f'studie-{new_pmid}'

    for ing_file in glob.glob('data/sources/ingredients/*.yaml'):
        with open(ing_file) as f:
            content = f.read()
        changed = False
        if old_ref in content:
            content = content.replace(old_ref, new_ref)
            changed = True
        if old_studie in content:
            content = content.replace(old_studie, new_studie)
            changed = True
        if changed:
            with open(ing_file, 'w') as f:
                f.write(content)

    return True, 'fixed'

def main():
    apply = '--apply' in sys.argv
    threshold = SIMILARITY_THRESHOLD
    for i, arg in enumerate(sys.argv):
        if arg == '--threshold' and i + 1 < len(sys.argv):
            threshold = float(sys.argv[i + 1])

    studies = load_mismatches()
    print(f'Loaded {len(studies)} studies from registry')
    print(f'Mode: {"APPLY" if apply else "DRY RUN"}')
    print(f'Threshold: {threshold}\n')

    # First verify which ones actually mismatch (quick check)
    # For efficiency, only process studies that were flagged as mismatches
    # We'll re-verify all to be safe
    pmids = [s['pmid'] for s in studies]
    pmid_to_study = {s['pmid']: s for s in studies}

    # Fetch current PubMed titles in batches
    all_titles = {}
    for i in range(0, len(pmids), 200):
        batch = pmids[i:i + 200]
        url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={",".join(batch)}&retmode=json'
        result = subprocess.run(['curl', '-s', '--max-time', '30', url], capture_output=True, text=True)
        try:
            data = json.loads(result.stdout)
            result_data = data.get('result', {})
            for uid in result_data.get('uids', []):
                all_titles[uid] = result_data[uid].get('title', '')
        except:
            pass
        print(f'  Verified {min(i + 200, len(pmids))}/{len(pmids)}...')
        time.sleep(0.4)

    # Find mismatches
    mismatches = []
    for study in studies:
        pubmed_title = all_titles.get(study['pmid'], '')
        if not pubmed_title:
            continue  # not found, skip
        sim = similarity(study['title'], pubmed_title)
        if sim < 0.5:
            mismatches.append(study)

    print(f'\nFound {len(mismatches)} mismatched studies to fix\n')

    fixed = 0
    not_found = 0
    low_confidence = 0
    errors = 0
    results = []

    for i, study in enumerate(mismatches):
        if i > 0 and i % 20 == 0:
            print(f'  Progress: {i}/{len(mismatches)}...')

        new_pmid, sim = find_correct_pmid(
            study['title'],
            year=study.get('year'),
            authors=study.get('authors'),
        )
        time.sleep(RATE_DELAY)

        if not new_pmid:
            not_found += 1
            results.append({'old': study['pmid'], 'title': study['title'][:60], 'status': 'NOT_FOUND', 'sim': 0})
            continue

        if sim < threshold:
            low_confidence += 1
            results.append({'old': study['pmid'], 'new': new_pmid, 'title': study['title'][:60], 'status': 'LOW_CONFIDENCE', 'sim': round(sim, 2)})
            continue

        if apply:
            success, msg = apply_fix(study, new_pmid)
            if success:
                fixed += 1
                results.append({'old': study['pmid'], 'new': new_pmid, 'title': study['title'][:60], 'status': 'FIXED', 'sim': round(sim, 2)})
            else:
                errors += 1
                results.append({'old': study['pmid'], 'new': new_pmid, 'title': study['title'][:60], 'status': f'ERROR: {msg}', 'sim': round(sim, 2)})
        else:
            fixed += 1
            results.append({'old': study['pmid'], 'new': new_pmid, 'title': study['title'][:60], 'status': 'WOULD_FIX', 'sim': round(sim, 2)})

    # Save report
    with open('/tmp/pmid-fix-report.json', 'w') as f:
        json.dump(results, f, indent=1)

    # Summary
    print(f'\n{"=" * 60}')
    print(f'✅ Fixed: {fixed}')
    print(f'🔍 Not found in PubMed: {not_found}')
    print(f'⚠️  Low confidence (<{threshold}): {low_confidence}')
    print(f'❌ Errors: {errors}')
    print(f'\nReport: /tmp/pmid-fix-report.json')

    if not apply and fixed > 0:
        print(f'\nRun with --apply to apply these fixes.')

if __name__ == '__main__':
    main()
