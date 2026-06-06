# Research review drafts

This folder stores automatically generated weekly research-review drafts from `scripts/pubmed-digest.js`.

Purpose:
- collect new PubMed / EFSA / ClinicalTrials.gov hits
- create an editorial starting point for MikroScore research reviews
- avoid auto-publishing without human review

Workflow:
1. Weekly cron runs `scripts/pubmed-digest.js`
2. Script generates a dated `.mdx` draft in this folder
3. Telegram digest points to the generated file path
4. Relevant findings are manually curated before anything is published publicly

Notes:
- Files here are drafts, not live site content
- Expect noise; every draft should be filtered and tightened before publication
- If this evolves into a public section later, final posts should live under `src/content/research-review/`
