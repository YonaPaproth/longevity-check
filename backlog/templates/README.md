# Bilingual dossier + claim templates

Use these templates when adding a new ingredient + claim pair to Mikroscore.

## Suggested production order

1. `ingredient.de.template.mdx`
2. `ingredient.en.template.mdx`
3. `kg-ingredient-entity.template.json`
4. `kg-ingredient-relations.template.json`
5. `claim.de.template.mdx`
6. `claim.en.template.mdx`
7. `kg-claim-entity.template.json`
8. `kg-claim-relations.template.json`
9. `pnpm build`

## Important rules

- Keep **ingredient slug identical** in DE + EN.
- Keep **KG IDs language-neutral and stable**.
- Do **not** translate KG relation names or IDs.
- `summary` fields in content collections must stay short (<= 200 chars).
- `ingredientEvidenceScore` in claimContext is a practical editorial score for the ingredient layer, not a legal claim.
- EFSA / EU regulatory status must be handled **separately** from evidence summaries.
- Always add at least one internal link between dossier and claim.

## Current working example

See the saffron test implementation for a complete reference:
- `src/content/ingredients/safran.mdx`
- `src/content/en/ingredients/safran.mdx`
- `src/content/claims/safran-preis-gesundheit.mdx`
- `src/content/en/claims/saffron-worth-the-price-for-health.mdx`
- `data/entities/ingredients/safran.json`
- `data/relations/by-entity/safran.json`
- `data/entities/claims/safran-preis-gesundheit.json`
- `data/relations/by-entity/safran-preis-gesundheit.json`
