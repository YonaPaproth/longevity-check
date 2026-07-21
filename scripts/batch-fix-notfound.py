#!/usr/bin/env python3
"""
Batch-fix NOT_FOUND studies: search PubMed for correct papers using author + finding keywords.

Usage:
  python3 scripts/batch-fix-notfound.py --batch 1    # first 20
  python3 scripts/batch-fix-notfound.py --batch 2    # next 20
  python3 scripts/batch-fix-notfound.py --batch 1 --apply  # apply fixes
"""

import json, yaml, glob, subprocess, sys, time, re, os
from difflib import SequenceMatcher

BATCH_SIZE = 20
SIM_THRESHOLD = 0.50
AUTHOR_BONUS = 0.15

def normalize(t):
    return re.sub(r'[^a-z0-9\s]', '', t.lower()).strip()

def sim(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

def esearch(query, max_results=5):
    q = re.sub(r'[^\w\s+\[\]"]', ' ', query).strip()
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={q}&retmax={max_results}&retmode=json'
    r = subprocess.run(['curl', '-s', '--max-time', '15', url], capture_output=True, text=True)
    try:
        return json.loads(r.stdout).get('esearchresult',{}).get('idlist',[])
    except:
        return []

def esummary(pmids):
    if not pmids: return {}
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={",".join(pmids)}&retmode=json'
    r = subprocess.run(['curl', '-s', '--max-time', '15', url], capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        return {uid: data['result'][uid] for uid in data.get('result',{}).get('uids',[])}
    except:
        return {}

def author_match(yaml_authors, pubmed_authors):
    if not yaml_authors or not pubmed_authors: return False
    yaml_first = yaml_authors.split()[0].rstrip(',').lower()
    return yaml_first in pubmed_authors.lower()

def find_paper(finding_text, yaml_title, yaml_authors, year=None):
    """Search PubMed using multiple strategies."""
    # Extract key medical/scientific terms from finding
    finding_words = [w for w in finding_text.split() if len(w) > 4 and w[0].isupper()][:5]
    title_words = [w for w in yaml_title.split() if len(w) > 3][:6]

    queries = []
    first_author = yaml_authors.split()[0].rstrip(',') if yaml_authors else ''

    if first_author and first_author.lower() not in ('et', 'al', 'et al.'):
        fw3 = "+".join(finding_words[:3])
        tw4 = "+".join(title_words[:4])
        if finding_words:
            queries.append(first_author + '+' + fw3)
        queries.append(first_author + '+' + tw4)

    if finding_words:
        fw4 = "+".join(finding_words[:4])
        queries.append(fw4)
    tw5 = "+".join(title_words[:5])
    queries.append(tw5)

    best_pmid, best_sim, best_data = None, 0, None

    for q in queries:
        ids = esearch(q, max_results=5)
        time.sleep(0.35)
        if not ids:
            continue

        summaries = esummary(ids[:5])
        time.sleep(0.35)

        for uid, pub in summaries.items():
            pub_title = pub.get('title', '')
            pub_authors = ' '.join(a.get('name','') for a in pub.get('authors',[]))

            # Score against both YAML title and finding text
            s_title = sim(yaml_title, pub_title)
            s_finding = sim(finding_text[:200], pub_title)
            s = max(s_title, s_finding * 0.8)  # finding match weighted lower

            if author_match(yaml_authors, pub_authors):
                s += AUTHOR_BONUS
            if year and str(pub.get('pubdate','')).startswith(str(year)):
                s += 0.05

            if s > best_sim:
                best_sim, best_pmid, best_data = s, uid, pub

    return best_pmid, best_sim, best_data

def apply_fix(old_pmid, new_pmid, pub_data, ingredient):
    """Apply the E2E fix from the rhodiola test."""
    old_file = f'data/sources/studies/pmid-{old_pmid}.yaml'
    new_file = f'data/sources/studies/pmid-{new_pmid}.yaml'

    # Read old study YAML
    with open(old_file) as f:
        docs = list(yaml.safe_load_all(f))
        d = docs[0]

    # Update with PubMed data
    d['id'] = f'pmid-{new_pmid}'
    d['pmid'] = new_pmid
    d['title'] = pub_data.get('title', d['title']).rstrip('.')
    authors = pub_data.get('authors', [])
    if authors:
        d['authors'] = f'{authors[0]["name"].split()[0]} et al.'
    pubdate = pub_data.get('pubdate', '')
    if pubdate:
        d['year'] = int(pubdate[:4])
    d['url'] = f'https://pubmed.ncbi.nlm.nih.gov/{new_pmid}/'

    # Skip if target already exists
    if os.path.exists(new_file) and old_file != new_file:
        return False, 'target exists'

    with open(new_file, 'w') as f:
        f.write('---\n')
        yaml.dump(d, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        f.write('---\n')
    if old_file != new_file:
        os.remove(old_file)

    # Update ingredient YAML: ref + studie + source
    ing_file = f'data/sources/ingredients/{ingredient}.yaml'
    with open(ing_file) as f:
        content = f.read()
    content = content.replace(f'pmid-{old_pmid}', f'pmid-{new_pmid}')
    content = content.replace(f'studie-{old_pmid}', f'studie-{new_pmid}')
    content = content.replace(f'pmid:{old_pmid}', f'pmid:{new_pmid}')
    with open(ing_file, 'w') as f:
        f.write(content)

    return True, 'fixed'

def main():
    batch_num = 1
    apply = '--apply' in sys.argv
    for i, arg in enumerate(sys.argv):
        if arg == '--batch' and i + 1 < len(sys.argv):
            batch_num = int(sys.argv[i + 1])

    # Load linked NOT_FOUND studies
    linked = json.load(open('/tmp/not-found-linked.json'))
    start = (batch_num - 1) * BATCH_SIZE
    end = start + BATCH_SIZE
    batch = linked[start:end]

    print(f'Batch {batch_num}: studies {start+1}-{min(end, len(linked))} of {len(linked)}')
    print(f'Mode: {"APPLY" if apply else "DRY RUN"}\n')

    fixed = 0
    not_found = 0
    low_conf = 0
    errors = 0

    for item in batch:
        pmid = item['pmid']
        ingredient = item['ingredient']
        yaml_title = item['yaml_title']
        finding = item['finding']

        # Load authors from study YAML
        study_file = f'data/sources/studies/pmid-{pmid}.yaml'
        yaml_authors = ''
        year = None
        if os.path.exists(study_file):
            with open(study_file) as f:
                docs = list(yaml.safe_load_all(f))
                d = docs[0]
            yaml_authors = str(d.get('authors', ''))
            year = d.get('year')

        new_pmid, best_sim, pub_data = find_paper(finding, yaml_title, yaml_authors, year)
        time.sleep(0.35)

        if not new_pmid:
            print(f'  ❌ {pmid} ({ingredient}): no match found')
            not_found += 1
            continue

        if best_sim < SIM_THRESHOLD:
            print(f'  ⚠️  {pmid} ({ingredient}): low confidence {best_sim:.2f} → {new_pmid}')
            low_conf += 1
            continue

        if apply:
            success, msg = apply_fix(pmid, new_pmid, pub_data, ingredient)
            if success:
                print(f'  ✅ {pmid} → {new_pmid} ({ingredient}, sim={best_sim:.2f})')
                fixed += 1
            else:
                print(f'  ❌ {pmid}: {msg}')
                errors += 1
        else:
            print(f'  ~ {pmid} → {new_pmid} ({ingredient}, sim={best_sim:.2f})')
            fixed += 1

    print(f'\n{"="*50}')
    print(f'✅ Fixed: {fixed}')
    print(f'❌ Not found: {not_found}')
    print(f'⚠️  Low confidence: {low_conf}')
    print(f'💥 Errors: {errors}')

    if not apply and fixed > 0:
        print(f'\nRun with --apply to apply fixes.')

if __name__ == '__main__':
    main()
