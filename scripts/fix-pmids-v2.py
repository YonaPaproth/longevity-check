#!/usr/bin/env python3
"""
Two-pass PMID fixer:
  Pass 1: Fix titles where PMID is correct (author match or high title similarity)
  Pass 2: Find correct PMIDs using author + keyword search

Usage:
  python3 scripts/fix-pmids-v2.py --pass1         # Pass 1 only (fast, safe)
  python3 scripts/fix-pmids-v2.py --pass2         # Pass 2 only (slower)
  python3 scripts/fix-pmids-v2.py --pass1 --apply # Apply Pass 1 fixes
"""

import json, yaml, glob, subprocess, sys, time, re, os
from difflib import SequenceMatcher

def normalize(t):
    return re.sub(r'[^a-z0-9\s]', '', t.lower()).strip()

def sim(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

def fetch_esummary(pmids):
    if not pmids: return {}
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={",".join(pmids)}&retmode=json'
    r = subprocess.run(['curl', '-s', '--max-time', '30', url], capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        return {uid: data['result'][uid] for uid in data.get('result',{}).get('uids',[])}
    except:
        return {}

def esearch(query, max_results=5):
    q = re.sub(r'[^\w\s+\[\]"]', ' ', query).strip()
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={q}&retmax={max_results}&retmode=json'
    r = subprocess.run(['curl', '-s', '--max-time', '15', url], capture_output=True, text=True)
    try:
        return json.loads(r.stdout).get('esearchresult',{}).get('idlist',[])
    except:
        return []

def author_matches(yaml_authors, pubmed_authors):
    if not yaml_authors or not pubmed_authors:
        return False
    yaml_first = yaml_authors.split()[0].rstrip(',').lower()
    return yaml_first in pubmed_authors.lower()

def main():
    pass1 = '--pass1' in sys.argv
    pass2 = '--pass2' in sys.argv
    apply = '--apply' in sys.argv
    if not pass1 and not pass2:
        pass1 = pass2 = True

    # Load all study YAMLs
    studies = []
    for f in sorted(glob.glob('data/sources/studies/pmid-*.yaml')):
        with open(f) as fh:
            docs = list(yaml.safe_load_all(fh))
            d = docs[0] if docs else {}
        if d.get('pmid') and d.get('title'):
            studies.append({'file': f, 'data': d, 'pmid': str(d['pmid']), 'title': str(d['title']), 'authors': str(d.get('authors',''))})

    print(f'{len(studies)} studies loaded')

    # Fetch all PubMed titles+authors in batches
    all_pubmed = {}
    pmids = [s['pmid'] for s in studies]
    for i in range(0, len(pmids), 200):
        batch = pmids[i:i+200]
        result = fetch_esummary(batch)
        all_pubmed.update(result)
        print(f'  Fetched {min(i+200, len(pmids))}/{len(pmids)} PubMed records...')
        time.sleep(0.4)

    # Identify mismatches
    mismatches = []
    for s in studies:
        pub = all_pubmed.get(s['pmid'], {})
        pub_title = pub.get('title', '')
        if not pub_title:
            mismatches.append({**s, 'pubmed_title': '', 'pubmed_authors': ''})
            continue
        pub_authors = ' '.join(a.get('name','') for a in pub.get('authors',[]))
        title_sim = sim(s['title'], pub_title)
        if title_sim < 0.5 and not author_matches(s['authors'], pub_authors):
            mismatches.append({**s, 'pubmed_title': pub_title, 'pubmed_authors': pub_authors})

    print(f'{len(mismatches)} mismatches found\n')

    # ── PASS 1: Fix titles where PMID is correct ─────────────────────────────
    if pass1:
        p1_fixed = 0
        for m in mismatches:
            pub = all_pubmed.get(m['pmid'], {})
            pub_title = pub.get('title', '')
            pub_authors = ' '.join(a.get('name','') for a in pub.get('authors',[]))

            title_sim = sim(m['title'], pub_title)
            has_author_match = author_matches(m['authors'], pub_authors)

            if title_sim > 0.5 or has_author_match:
                if apply:
                    # Update title in YAML
                    data = m['data']
                    data['title'] = pub_title.rstrip('.')
                    with open(m['file'], 'w') as f:
                        f.write('---\n')
                        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                        f.write('---\n')
                    p1_fixed += 1
                    print(f'  P1 ✓ {m["pmid"]}: title updated (sim={title_sim:.2f}, author={has_author_match})')
                else:
                    p1_fixed += 1
                    print(f'  P1 ~ {m["pmid"]}: would update title (sim={title_sim:.2f}, author={has_author_match})')

        print(f'\nPass 1: {p1_fixed} title fixes')
        if not apply:
            print('  (dry run — use --apply to apply)')

    # ── PASS 2: Find correct PMIDs ───────────────────────────────────────────
    if pass2:
        # Re-identify remaining mismatches after Pass 1
        remaining = []
        for m in mismatches:
            pub = all_pubmed.get(m['pmid'], {})
            pub_title = pub.get('title', '')
            pub_authors = ' '.join(a.get('name','') for a in pub.get('authors',[]))
            title_sim = sim(m['title'], pub_title)
            has_author_match = author_matches(m['authors'], pub_authors)
            if not (title_sim > 0.5 or has_author_match):
                remaining.append(m)

        print(f'\nPass 2: {len(remaining)} studies need new PMID\n')

        p2_fixed = 0
        p2_not_found = 0
        p2_low = 0

        for i, m in enumerate(remaining):
            if i > 0 and i % 25 == 0:
                print(f'  Progress: {i}/{len(remaining)}...')

            # Search with author + keywords
            first_author = m['authors'].split()[0].rstrip(',') if m['authors'] else ''
            keywords = ' '.join(w for w in m['title'].split() if len(w) > 4)[:60]

            queries = []
            if first_author:
                queries.append(f'{first_author}+{keywords.replace(" ", "+")}')
            queries.append(f'{keywords.replace(" ", "+")}')
            # Also try first 6 words of title
            queries.append('+'.join(m['title'].split()[:6]))

            best_pmid, best_sim = None, 0
            for q in queries:
                ids = esearch(q, max_results=5)
                time.sleep(0.35)
                if not ids:
                    continue

                summaries = fetch_esummary(ids[:5])
                time.sleep(0.35)

                for uid, pub in summaries.items():
                    pub_title = pub.get('title', '')
                    s = sim(m['title'], pub_title)
                    pub_authors_str = ' '.join(a.get('name','') for a in pub.get('authors',[]))
                    if author_matches(m['authors'], pub_authors_str):
                        s += 0.15
                    if str(m['data'].get('year','')) and str(pub.get('pubdate','')).startswith(str(m['data']['year'])):
                        s += 0.05
                    if s > best_sim:
                        best_sim, best_pmid = s, uid

            if not best_pmid:
                p2_not_found += 1
                continue

            if best_sim < 0.5:
                p2_low += 1
                continue

            if apply:
                # Apply fix: update YAML, rename file, update ingredient refs
                old_pmid = m['pmid']
                new_file = f'data/sources/studies/pmid-{best_pmid}.yaml'

                if os.path.exists(new_file) and new_file != m['file']:
                    p2_low += 1
                    continue

                data = m['data']
                data['id'] = f'pmid-{best_pmid}'
                data['pmid'] = best_pmid
                data['url'] = f'https://pubmed.ncbi.nlm.nih.gov/{best_pmid}/'

                # Update title from PubMed
                pub_info = fetch_esummary([best_pmid])
                if best_pmid in pub_info:
                    data['title'] = pub_info[best_pmid].get('title', data['title']).rstrip('.')

                with open(new_file, 'w') as f:
                    f.write('---\n')
                    yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                    f.write('---\n')

                if m['file'] != new_file:
                    os.remove(m['file'])

                # Update ingredient refs
                old_ref = f'pmid-{old_pmid}'
                new_ref = f'pmid-{best_pmid}'
                old_studie = f'studie-{old_pmid}'
                new_studie = f'studie-{best_pmid}'
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

                p2_fixed += 1
                print(f'  P2 ✓ {old_pmid} → {best_pmid} (sim={best_sim:.2f})')
            else:
                p2_fixed += 1
                print(f'  P2 ~ {m["pmid"]} → {best_pmid} (sim={best_sim:.2f})')

        print(f'\nPass 2: {p2_fixed} fixed, {p2_not_found} not found, {p2_low} low confidence')
        if not apply:
            print('  (dry run — use --apply to apply)')

if __name__ == '__main__':
    main()
