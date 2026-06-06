# Mikroscore knowledge graph implementation plan

## Goal

Make Mikroscore easier to extend with:

- graph-driven pages
- bilingual DE/EN rendering
- safer agent edits
- less duplication between MDX and KG JSON
- future visualizations like `/graph`

---

## Phase 1 — Formalize the graph layer without breaking content

### 1. Add a graph library folder

Create:

```txt
src/lib/graph/
  types.ts
  entities.ts
  relations.ts
  labels.ts
  builders.ts
  validate.ts
```

### Purpose of each file

#### `types.ts`
Defines TypeScript types for:
- entity types
- relation types
- graph nodes
- graph edges
- localized labels

Example:

```ts
export type EntityType =
  | 'ingredient'
  | 'claim'
  | 'mechanism'
  | 'symptom'
  | 'regulatory'
  | 'biomarker';

export type RelationType =
  | 'bezieht_sich_auf'
  | 'wirkt_ueber'
  | 'zielt_auf'
  | 'wird_eingesetzt_fuer'
  | 'verwandter_wirkstoff'
  | 'hat_regulatorischen_status'
  | 'basiert_auf_studie';
```

#### `entities.ts`
Loads all entities from:
- `data/entities/...`

Exports helpers like:
- `getEntityById(id)`
- `getAllEntities()`
- `getEntitiesByType(type)`

#### `relations.ts`
Loads:
- `data/relations/by-entity/...`

Exports:
- `getRelationsForEntity(id)`
- `getOutgoingRelations(id)`
- `getIncomingRelations(id)`

#### `labels.ts`
Resolves display labels by locale.

Exports:
- `getEntityLabel(entity, locale)`
- `getEntityDescription(entity, locale)`

#### `builders.ts`
Creates graph-ready structures.

Exports:
- `buildIngredientGraph(slug, locale)`
- `buildClaimGraph(slug, locale)`
- `buildFullGraph(locale)`
- `buildSubgraph(entityId, depth, locale)`

#### `validate.ts`
Shared validation helpers used by scripts.

---

### 2. Create one central relation vocabulary file

Add:

```txt
data/schema/relation-types.json
```

Example:

```json
{
  "allowed": [
    "bezieht_sich_auf",
    "wirkt_ueber",
    "zielt_auf",
    "wird_eingesetzt_fuer",
    "verwandter_wirkstoff",
    "hat_regulatorischen_status",
    "basiert_auf_studie"
  ]
}
```

Why:
- prevents agents from inventing relation names

---

### 3. Add entity schemas for validation

Add:

```txt
data/schema/
  ingredient-entity.schema.json
  claim-entity.schema.json
  relation.schema.json
```

Keep the schemas practical, not overengineered.

---

## Phase 2 — Reduce duplication between MDX and KG

### 4. Make KG canonical for relations

Decision:
These should come from KG JSON, not be manually duplicated in MDX long-term:
- related mechanisms
- related symptoms
- related ingredients
- regulatory links

### Practical repo change
Keep `claimContext` for now, but begin slimming it down.

Current:

```yaml
claimContext:
  claimEntityId: "safran-preis-gesundheit"
  ingredientEvidenceScore: 5
  humanEvidence: "begrenzt"
  regulatoryStatus: "efsa-nicht-zugelassen"
  relatedMechanisms:
    - "serotonin-synthese"
  relatedSymptoms:
    - "depression"
  relatedIngredients:
    - "ashwagandha"
```

Target:

```yaml
claimContext:
  claimEntityId: "safran-preis-gesundheit"
  ingredientEvidenceScore: 5
```

Optional temporary overrides if needed:

```yaml
claimContext:
  claimEntityId: "..."
  ingredientEvidenceScore: 5
  displayOverrides:
    regulatoryStatus: "No approved EFSA health claims for saffron."
```

Rule:
- graph structure → KG
- editorial display nuance → MDX optional override

---

### 5. Update the ClaimContext component

Current file:

```txt
src/components/ClaimContextModule.astro
```

Improve it to:
- first read `claimEntityId`
- pull mechanisms/symptoms/related ingredients from KG
- only fall back to frontmatter if missing

That way old content keeps working while the architecture improves.

---

## Phase 3 — Make the graph consumable by pages and visualizations

### 6. Add derived graph endpoints

Create:

```txt
src/pages/data/graph.json.ts
src/pages/data/graph.en.json.ts
```

Output shape:

```json
{
  "nodes": [
    {
      "id": "safran",
      "type": "ingredient",
      "label": "Safran",
      "path": "/wirkstoffe/safran"
    },
    {
      "id": "depression",
      "type": "symptom",
      "label": "Depression",
      "path": "/wirkstoffe/nach-wirkung/depression"
    }
  ],
  "edges": [
    {
      "source": "safran",
      "target": "depression",
      "relation": "wird_eingesetzt_fuer",
      "confidence": 0.7
    }
  ]
}
```

EN version:

```json
{
  "nodes": [
    {
      "id": "safran",
      "type": "ingredient",
      "label": "Saffron",
      "path": "/en/ingredients/safran"
    }
  ]
}
```

Why:
- makes graph visualization much easier than using raw by-entity JSON directly

---

### 7. Add a first non-interactive graph component

Create:

```txt
src/components/graph/EntityGraphContext.astro
```

This component should render:
- central entity
- related claims
- mechanisms
- symptoms
- related ingredients
- regulatory status

At first as:
- chips
- cards
- mini network list

Not a full node graph yet.

Why:
- proves the architecture before adding visualization complexity

---

### 8. Add an actual graph page scaffold

Create:

```txt
src/pages/graph.astro
src/pages/en/graph.astro
```

Version 1 should not be a fancy force-directed graph yet.

Start with:
- filters by entity type
- search
- selected entity → neighborhood panel
- graph data from `/data/graph*.json`

Later add:
- Cytoscape / vis-network / d3-force
- pan/zoom
- depth filters

---

## Phase 4 — Validation and agent productivity

### 9. Add validation scripts

Create:

```txt
scripts/validate-kg.ts
scripts/validate-content-graph-links.ts
scripts/validate-bilingual-content.ts
```

#### `validate-kg.ts` should check:
- every entity has a valid type
- every relation type is allowed
- every relation target exists
- no duplicate entity IDs
- all by-entity files match their entity IDs

#### `validate-content-graph-links.ts` should check:
- every claim `ingredient` exists
- every `claimEntityId` exists
- ingredient slugs used in pages map to real entities
- graph-backed links resolve correctly

#### `validate-bilingual-content.ts` should check:
- DE ingredient has EN counterpart if marked priority
- DE claim has EN counterpart if marked bilingual
- same ingredient slug across locales
- no accidental DE label on EN page title if avoidable

---

### 10. Add package.json scripts

Add:

```json
{
  "scripts": {
    "validate:kg": "tsx scripts/validate-kg.ts",
    "validate:content-links": "tsx scripts/validate-content-graph-links.ts",
    "validate:bilingual": "tsx scripts/validate-bilingual-content.ts",
    "validate:all": "pnpm validate:kg && pnpm validate:content-links && pnpm validate:bilingual"
  }
}
```

Why:
- agents can run `pnpm validate:all`
- agents can run `pnpm build`
- safer workflow

---

### 11. Add scaffolding generators

Templates already exist. Next step: scriptable generation.

Create:

```txt
scripts/new-ingredient.ts
scripts/new-claim.ts
scripts/new-bilingual-topic.ts
```

Best one:

#### `new-bilingual-topic.ts`
Command:

```bash
pnpm tsx scripts/new-bilingual-topic.ts safran
```

Should create:
- `src/content/ingredients/safran.mdx`
- `src/content/en/ingredients/safran.mdx`
- `data/entities/ingredients/safran.json`
- `data/relations/by-entity/safran.json`

Optional flags:

```bash
pnpm tsx scripts/new-bilingual-topic.ts safran --claim
```

Then also:
- `src/content/claims/safran-<topic>.mdx`
- `src/content/en/claims/<english-slug>.mdx`
- `data/entities/claims/...`
- `data/relations/by-entity/...`

---

## Exact repo changes

### New folders/files

```txt
src/lib/graph/
  types.ts
  entities.ts
  relations.ts
  labels.ts
  builders.ts
  validate.ts

src/components/graph/
  EntityGraphContext.astro
  GraphLegend.astro
  KnowledgeGraphCanvas.astro   # later

src/pages/
  graph.astro
  data/graph.json.ts

src/pages/en/
  graph.astro
  data/graph.json.ts   # or graph.en.json.ts under /data

data/schema/
  relation-types.json
  ingredient-entity.schema.json
  claim-entity.schema.json
  relation.schema.json

scripts/
  validate-kg.ts
  validate-content-graph-links.ts
  validate-bilingual-content.ts
  new-bilingual-topic.ts
```

---

## Field-level changes

### Keep in ingredient MDX
Keep:
- title
- summary
- evidenceLevel
- evidenceSummary
- EFSA notes
- safety
- studies
- article prose

### Keep in claim MDX
Keep:
- title
- verdict
- verdictNote
- summary
- sources
- article prose

### Keep in `claimContext`
Temporarily:
- `claimEntityId`
- `ingredientEvidenceScore`

Optional:
- `displayOverrides`

### Move graph structure responsibility fully to KG
Over time remove from MDX:
- relatedMechanisms
- relatedSymptoms
- relatedIngredients
- regulatoryStatus if duplicated in KG

---

## Suggested implementation order

### Sprint 1
- add `src/lib/graph`
- add validation scripts
- add relation vocabulary
- update `ClaimContextModule` to prefer KG

### Sprint 2
- add `/data/graph.json`
- add `/graph` and `/en/graph` scaffold
- add localized label resolver

### Sprint 3
- slim down `claimContext`
- add generator scripts
- migrate older claim pages gradually

### Sprint 4
- interactive graph UI
- graph filters
- related pages generated from graph clusters

---

## Recommended first implementation batch

If starting now, begin with:

1. `src/lib/graph/*`
2. `scripts/validate-kg.ts`
3. `data/schema/relation-types.json`
4. adapt `ClaimContextModule.astro` to prefer KG data
5. add `pnpm validate:kg`

This gives the highest leverage with the least disruption.

---

## Core recommendation

Do not rebuild Mikroscore.

Add a:
- formal graph layer
- validation layer
- derived graph API

Keep content editorial and let the KG become the canonical relational layer.
