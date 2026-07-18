#!/usr/bin/env python3
"""
Batch-fetch abstracts from PubMed and extract participant counts (n).
Only processes studies that already have study_type set but no n value.
"""

import json, yaml, re, subprocess, time

BATCH_SIZE = 200
RATE_DELAY = 0.4

def fetch_abstracts(pmids):
    """Fetch abstracts via efetch, returns dict of pmid -> abstract text."""
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={",".join(pmids)}&rettype=abstract&retmode=text'
    result = subprocess.run(['curl', '-s', '--max-time', '60', url], capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f'curl failed: {result.stderr}')

    # Split by PMID markers
    text = result.stdout
    abstracts = {}
    # efetch text format: each record separated by blank lines, PMID at end
    records = re.split(r'\n\n(?=\d+\.\s)', text)
    for record in records:
        pmid_match = re.search(r'PMID:\s*(\d+)', record)
        if pmid_match:
            abstracts[pmid_match.group(1)] = record
    return abstracts


def extract_n(abstract_text, study_type):
    """Extract participant count from abstract text using regex patterns."""

    # For meta-analyses: look for total participants across studies
    if study_type in ('Meta-Analysis', 'Systematic Review'):
        patterns = [
            r'total\s+of\s+([\d,]+)\s+(?:participants|patients|subjects|individuals|adults)',
            r'([\d,]+)\s+(?:participants|patients|subjects|individuals)\s+(?:were|was)\s+(?:included|analyzed|pooled)',
            r'(?:included|comprising|encompassing)\s+([\d,]+)\s+(?:participants|patients|subjects)',
            r'(\d+)\s+(?:randomized\s+controlled\s+)?trials?\s+(?:with|involving|including)\s+([\d,]+)\s+(?:participants|patients|subjects)',
            r'(?:pooled|combined)\s+(?:analysis|sample|data)\s+(?:of|from)\s+.*?([\d,]+)\s+(?:participants|patients|subjects)',
        ]
        for p in patterns:
            m = re.search(p, abstract_text, re.IGNORECASE)
            if m:
                # For patterns with two groups, take the second (participants count)
                groups = m.groups()
                val = groups[-1] if len(groups) > 1 else groups[0]
                return int(val.replace(',', ''))
        return None

    # For RCTs and clinical trials: look for sample size
    patterns = [
        # "n = 116" or "n=116" (most common)
        r'\bn\s*=\s*(\d+)',
        # "(n = 116)"
        r'\(n\s*=\s*(\d+)\)',
        # "116 participants/patients/subjects/adults/volunteers"
        r'(\d+)\s+(?:healthy\s+)?(?:participants|patients|subjects|adults|volunteers|individuals|women|men|children|infants)',
        # "randomized 116"
        r'randomi[sz]ed\s+(?:a\s+total\s+of\s+)?(\d+)',
        # "a total of 116"
        r'a\s+total\s+of\s+(\d+)\s+(?:participants|patients|subjects|healthy)',
        # "enrolled 116"
        r'enrolled\s+(\d+)',
        # "recruited 116"
        r'recruited\s+(\d+)',
        # "assigned to ... (n=116)"
        r'assigned.*?n\s*=\s*(\d+)',
        # "one hundred sixteen" — skip, too complex
        # "116 eligible"
        r'(\d+)\s+eligible\s+(?:participants|patients|subjects)',
    ]

    # Search in first 3000 chars (methods section usually early)
    search_text = abstract_text[:3000]

    best_n = None
    for p in patterns:
        for m in re.finditer(p, search_text, re.IGNORECASE):
            val = int(m.group(1).replace(',', ''))
            # Sanity check: n should be reasonable (5 to 10 million)
            if 5 <= val <= 10_000_000:
                # Prefer larger n found (more likely to be total sample)
                if best_n is None or val > best_n:
                    best_n = val

    # Post-filter: if we found multiple values, prefer the one near "randomized" or "assigned"
    if best_n and best_n < 10:
        # Probably arm size, not total — try to find larger
        for p in patterns:
            for m in re.finditer(p, search_text, re.IGNORECASE):
                val = int(m.group(1).replace(',', ''))
                if val > best_n and val <= 10_000_000:
                    best_n = val

    return best_n


def main():
    with open('/tmp/studies-need-n.json') as f:
        studies = json.load(f)

    pmids = [s['pmid'] for s in studies]
    pmid_to_study = {s['pmid']: s for s in studies}

    print(f'Fetching abstracts for {len(pmids)} studies...')

    all_abstracts = {}
    for i in range(0, len(pmids), BATCH_SIZE):
        batch = pmids[i:i + BATCH_SIZE]
        print(f'  Batch {i // BATCH_SIZE + 1} ({len(batch)} PMIDs)...', end=' ')
        try:
            abstracts = fetch_abstracts(batch)
            all_abstracts.update(abstracts)
            print(f'✓ {len(abstracts)} abstracts')
        except Exception as e:
            print(f'✗ {e}')
        if i + BATCH_SIZE < len(pmids):
            time.sleep(RATE_DELAY)

    # Extract n and update YAMLs
    updated = 0
    no_n_found = 0
    errors = 0

    for pmid, abstract in all_abstracts.items():
        study = pmid_to_study.get(pmid)
        if not study:
            continue

        n = extract_n(abstract, study['type'])
        if n is None:
            no_n_found += 1
            continue

        filepath = study['file']
        try:
            with open(filepath) as f:
                content = f.read()
            docs = list(yaml.safe_load_all(content))
            doc = docs[0] if docs else {}

            if not doc.get('n'):
                doc['n'] = n
                with open(filepath, 'w') as f:
                    f.write('---\n')
                    yaml.dump(doc, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                    f.write('---\n')
                updated += 1
        except Exception as e:
            print(f'  Error: {filepath}: {e}')
            errors += 1

    print(f'\n✅ Done: {updated} updated with n, {no_n_found} no n found in abstract, {errors} errors')


if __name__ == '__main__':
    main()
