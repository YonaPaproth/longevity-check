#!/usr/bin/env python3
"""
Batch-fetch study metadata from PubMed E-utilities and update study YAMLs.

Fetches: publication types → study_type, evidence_quality
Rate limit: 3 requests/second (NCBI guidelines, no API key)
Batch size: 200 PMIDs per request (NCBI max)
"""

import json, yaml, glob, time, sys, re, subprocess

BATCH_SIZE = 200
RATE_DELAY = 0.4  # seconds between requests (2.5 req/s, safe)

# Publication type → our study_type
PTYPE_MAP = {
    'Randomized Controlled Trial': 'RCT',
    'Meta-Analysis': 'Meta-Analysis',
    'Systematic Review': 'Systematic Review',
    'Review': 'Review',
    'Clinical Trial': 'Clinical Trial',
    'Clinical Trial, Phase I': 'Clinical Trial Phase I',
    'Clinical Trial, Phase II': 'Clinical Trial Phase II',
    'Clinical Trial, Phase III': 'Clinical Trial Phase III',
    'Clinical Trial, Phase IV': 'Clinical Trial Phase IV',
    'Multicenter Study': 'Multicenter Study',
    'Observational Study': 'Observational Study',
    'Case Reports': 'Case Report',
    'Comparative Study': 'Comparative Study',
    'Controlled Clinical Trial': 'Controlled Clinical Trial',
    'Evaluation Study': 'Evaluation Study',
    'Validation Study': 'Validation Study',
    'Twin Study': 'Twin Study',
    'Retracted Publication': 'RETRACTED',
    'Preprint': 'Preprint',
}

# study_type → evidence_quality
QUALITY_MAP = {
    'Meta-Analysis': 'high',
    'Systematic Review': 'high',
    'RCT': 'high',
    'Multicenter Study': 'high',
    'Controlled Clinical Trial': 'high',
    'Clinical Trial Phase III': 'high',
    'Clinical Trial Phase II': 'moderate',
    'Clinical Trial Phase I': 'moderate',
    'Clinical Trial': 'moderate',
    'Comparative Study': 'moderate',
    'Observational Study': 'moderate',
    'Evaluation Study': 'moderate',
    'Validation Study': 'moderate',
    'Twin Study': 'moderate',
    'Review': 'low',
    'Case Report': 'low',
    'Preprint': 'low',
    'RETRACTED': 'low',
}

def pick_best_type(pubtypes):
    """Pick the highest-priority publication type."""
    # Priority order (most specific/evidence-heavy first)
    priority = [
        'Meta-Analysis', 'Systematic Review',
        'Randomized Controlled Trial',
        'Controlled Clinical Trial',
        'Clinical Trial, Phase III', 'Clinical Trial, Phase II', 'Clinical Trial, Phase I',
        'Clinical Trial',
        'Multicenter Study',
        'Observational Study', 'Comparative Study',
        'Evaluation Study', 'Validation Study', 'Twin Study',
        'Case Reports',
        'Review',
        'Preprint',
    ]
    for p in priority:
        if p in pubtypes:
            return PTYPE_MAP.get(p, p)
    return 'Journal Article'

def fetch_batch(pmids):
    """Fetch publication types for a batch of PMIDs via curl (avoids macOS SSL issues)."""
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={",".join(pmids)}&retmode=json'
    result = subprocess.run(['curl', '-s', '--max-time', '30', url], capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f'curl failed: {result.stderr}')
    data = json.loads(result.stdout)
    return data.get('result', {})

def main():
    # Load studies to update
    with open('/tmp/studies-to-update.json') as f:
        studies = json.load(f)

    pmids = [s['pmid'] for s in studies]
    pmid_to_study = {s['pmid']: s for s in studies}

    print(f'Fetching metadata for {len(pmids)} studies in {(len(pmids) + BATCH_SIZE - 1) // BATCH_SIZE} batches...')

    all_results = {}
    for i in range(0, len(pmids), BATCH_SIZE):
        batch = pmids[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(pmids) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f'  Batch {batch_num}/{total_batches} ({len(batch)} PMIDs)...', end=' ')

        try:
            result = fetch_batch(batch)
            for uid in result.get('uids', []):
                r = result[uid]
                pubtypes = r.get('pubtype', [])
                study_type = pick_best_type(pubtypes)
                quality = QUALITY_MAP.get(study_type, 'low')
                all_results[uid] = {
                    'study_type': study_type,
                    'evidence_quality': quality,
                    'pubtypes': pubtypes,
                }
            print(f'✓ {len(result.get("uids", []))} results')
        except Exception as e:
            print(f'✗ Error: {e}')

        if i + BATCH_SIZE < len(pmids):
            time.sleep(RATE_DELAY)

    # Update YAML files
    updated = 0
    errors = 0
    for pmid, meta in all_results.items():
        study = pmid_to_study.get(pmid)
        if not study:
            continue

        filepath = study['file']
        try:
            with open(filepath) as f:
                content = f.read()

            # Parse existing YAML
            docs = list(yaml.safe_load_all(content))
            doc = docs[0] if docs else {}

            # Only update if not already set
            changed = False
            if not doc.get('study_type') and meta['study_type'] != 'Journal Article':
                doc['study_type'] = meta['study_type']
                changed = True
            if not doc.get('evidence_quality'):
                doc['evidence_quality'] = meta['evidence_quality']
                changed = True

            if changed:
                # Write back preserving YAML format
                with open(filepath, 'w') as f:
                    f.write('---\n')
                    yaml.dump(doc, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                    f.write('---\n')
                updated += 1

        except Exception as e:
            print(f'  Error updating {filepath}: {e}')
            errors += 1

    print(f'\n✅ Done: {updated} studies updated, {errors} errors, {len(all_results)} fetched from PubMed')

    # Stats
    type_counts = {}
    for meta in all_results.values():
        t = meta['study_type']
        type_counts[t] = type_counts.get(t, 0) + 1

    print('\nStudy type distribution:')
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f'  {t}: {c}')

if __name__ == '__main__':
    main()
