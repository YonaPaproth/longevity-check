# Mikroscore knowledge graph implementation checklist

_Status: implementation-ready_

This checklist turns the higher-level plan into an execution sequence that fits the current repo.

## What exists today

- `data/entities/*` already exists for ingredients, claims, mechanisms, symptoms, regulatory, biomarkers.
- `data/relations/by-entity/*` already exists.
- `src/components/ClaimContextModule.astro` already reads KG JSON directly and falls back to frontmatter.
- `src/pages/data/*.json.ts` already exists for other derived APIs.
- `tsx` and `zod` are already installed.
- DE + EN content collections already exist in `src/content.config.ts`.

## Implementation rules

- Do **not** rebuild content architecture from scratch.
- Make the **knowledge graph canonical for relationships**.
- Keep MDX canonical for **editorial prose and page-specific nuance**.
- Centralize graph logic in `src/lib/graph/*` so components/pages/scripts stop reimplementing file loading.
- Keep rollout backward-compatible until validation and migration are in place.

---

# Phase 0 — Lock the contract first

## 0.1 Define the graph contract

- [ ] Finalize the list of supported entity types:
  - [ ] `ingredient`
  - [ ] `claim`
  - [ ] `mechanism`
  - [ ] `symptom`
  - [ ] `regulatory`
  - [ ] `biomarker`
- [ ] Finalize the list of supported relation types currently used in repo.
- [ ] Confirm required relation fields:
  - [ ] `relation`
  - [ ] `target`
  - [ ] `direction`
  - [ ] `confidence`
- [ ] Decide whether `direction` remains required or whether all stored relations are treated as outgoing and incoming edges are derived.
- [ ] Decide one canonical locale type for graph helpers: `de | en`.
- [ ] Decide one canonical graph output shape for endpoints and UI:
  - [ ] `nodes[]`
  - [ ] `edges[]`
  - [ ] optional top-level metadata

### Definition of done

- [ ] The allowed types and output shape are written down in code comments and schema files.
- [ ] No future task in this checklist depends on an undefined relation or locale rule.

---

# Phase 1 — Build the graph library foundation

## 1.1 Create the folder structure

Create:

- [ ] `src/lib/graph/types.ts`
- [ ] `src/lib/graph/entities.ts`
- [ ] `src/lib/graph/relations.ts`
- [ ] `src/lib/graph/labels.ts`
- [ ] `src/lib/graph/paths.ts`
- [ ] `src/lib/graph/builders.ts`
- [ ] `src/lib/graph/validate.ts`
- [ ] `src/lib/graph/index.ts`

> `paths.ts` is intentionally added even though it was not explicit in the first plan. Route resolution is important enough to isolate.

## 1.2 Define core TypeScript types

In `src/lib/graph/types.ts`:

- [ ] Add `GraphLocale = 'de' | 'en'`.
- [ ] Add `EntityType` union.
- [ ] Add `RelationType` union.
- [ ] Add `RelationDirection` union.
- [ ] Add raw file types:
  - [ ] `GraphEntity`
  - [ ] `GraphRelation`
  - [ ] `GraphRelationFile`
- [ ] Add derived UI/API types:
  - [ ] `GraphNode`
  - [ ] `GraphEdge`
  - [ ] `GraphData`
  - [ ] `GraphSubgraphOptions`
- [ ] Add validation result types:
  - [ ] `ValidationIssue`
  - [ ] `ValidationReport`

### Definition of done

- [ ] All graph code imports shared types from one place.
- [ ] No component or script defines its own copy of graph types.

## 1.3 Implement entity loading helpers

In `src/lib/graph/entities.ts`:

- [ ] Create a single source of truth for entity directories by type.
- [ ] Load all entity JSON files.
- [ ] Build an in-memory index keyed by `id`.
- [ ] Export:
  - [ ] `getAllEntities()`
  - [ ] `getEntityById(id)`
  - [ ] `getEntitiesByType(type)`
  - [ ] `hasEntity(id)`
  - [ ] `getEntityTypeDirectory(type)`
- [ ] Ensure duplicate IDs are detectable.

### Definition of done

- [ ] Any component/page/script can resolve an entity by id without scanning folders ad hoc.

## 1.4 Implement relation loading helpers

In `src/lib/graph/relations.ts`:

- [ ] Load all `data/relations/by-entity/*.json` files.
- [ ] Export:
  - [ ] `getRelationsForEntity(id)`
  - [ ] `getOutgoingRelations(id)`
  - [ ] `getIncomingRelations(id)`
  - [ ] `getRelationsByType(relationType)`
  - [ ] `hasRelationsFile(id)`
- [ ] Derive incoming relations by scanning all outgoing relations if needed.
- [ ] Ensure each relation file’s `entity` matches the filename.

### Definition of done

- [ ] Components no longer need to read `data/relations/by-entity/*.json` directly.

## 1.5 Implement label resolution

In `src/lib/graph/labels.ts`:

- [ ] Define how DE labels are resolved from entity JSON today.
- [ ] Define how EN labels are resolved in v1.
- [ ] Export:
  - [ ] `getEntityLabel(entity, locale)`
  - [ ] `getEntityDescription(entity, locale)`
  - [ ] `getRelationLabel(relation, locale)`
- [ ] If EN label data is incomplete, define deterministic fallback behavior.

### Recommended v1 fallback behavior

- DE:
  - Prefer `entity.name`
- EN:
  - Prefer explicit EN mapping if available later
  - Otherwise fall back to `entity.name`

### Definition of done

- [ ] Graph endpoints can render DE and EN labels without embedding label logic in page files.

## 1.6 Implement route/path resolution

In `src/lib/graph/paths.ts`:

- [ ] Add `getEntityPath(entity, locale)`.
- [ ] Add rules for current route structure:
  - [ ] DE ingredient → `/wirkstoffe/[slug]`
  - [ ] DE symptom → `/wirkstoffe/nach-wirkung/[id]`
  - [ ] DE claim → confirm real route shape before hardcoding
  - [ ] EN ingredient → `/en/ingredients/[slug]`
  - [ ] EN claim → confirm real route shape before hardcoding
- [ ] Decide behavior for entity types that do not yet have public pages:
  - [ ] return `undefined`
  - [ ] or route to future placeholder pages

### Definition of done

- [ ] Path logic lives in one place and is reusable by endpoints, components, and future graph UI.

## 1.7 Implement graph builders

In `src/lib/graph/builders.ts`:

- [ ] Add `buildEntityNeighborhood(entityId, locale, depth = 1)`.
- [ ] Add `buildIngredientGraph(slug, locale)`.
- [ ] Add `buildClaimGraph(slug, locale)`.
- [ ] Add `buildFullGraph(locale)`.
- [ ] Deduplicate nodes and edges.
- [ ] Include node metadata needed for UI:
  - [ ] `id`
  - [ ] `type`
  - [ ] `label`
  - [ ] `path`
- [ ] Include edge metadata needed for UI:
  - [ ] `source`
  - [ ] `target`
  - [ ] `relation`
  - [ ] `confidence`

### Definition of done

- [ ] One helper call can return graph-ready data for pages and JSON APIs.

---

# Phase 2 — Add schema and validation before migration

## 2.1 Add schema files

Create:

- [ ] `data/schema/relation-types.json`
- [ ] `data/schema/entity-types.json`
- [ ] `data/schema/relation.schema.json`
- [ ] `data/schema/entity.schema.json`

> A single generic `entity.schema.json` is likely better than separate ingredient/claim files at first. It is simpler and easier to extend.

## 2.2 Define allowed relation vocabulary from real repo usage

- [ ] Inspect current `data/relations/by-entity/*` files.
- [ ] Capture every currently used relation name.
- [ ] Remove any accidental one-offs before freezing vocabulary.
- [ ] Store allowed values in `data/schema/relation-types.json`.

### Minimum expected set

- [ ] `bezieht_sich_auf`
- [ ] `wirkt_ueber`
- [ ] `zielt_auf`
- [ ] `wird_eingesetzt_fuer`
- [ ] `verwandter_wirkstoff`
- [ ] `hat_regulatorischen_status`
- [ ] `basiert_auf_studie`

## 2.3 Add reusable validation helpers

In `src/lib/graph/validate.ts`:

- [ ] Validate entity type.
- [ ] Validate relation type.
- [ ] Validate relation target existence.
- [ ] Validate relation confidence range.
- [ ] Validate relation direction.
- [ ] Validate filename ↔ `id` / `entity` consistency.
- [ ] Validate duplicate entity ids.
- [ ] Return machine-readable issue objects, not only strings.

### Definition of done

- [ ] Validation logic is reusable from CLI scripts and tests.

## 2.4 Add `validate-kg.ts`

Create `scripts/validate-kg.ts`:

- [ ] Load entities via `src/lib/graph/entities.ts`.
- [ ] Load relations via `src/lib/graph/relations.ts`.
- [ ] Run shared validators.
- [ ] Print a readable report.
- [ ] Exit non-zero on errors.
- [ ] Exit zero on success.

### Checks to include in v1

- [ ] every entity has a valid type
- [ ] every relation type is allowed
- [ ] every relation target exists
- [ ] every relation confidence is numeric and in range
- [ ] no duplicate entity IDs
- [ ] every by-entity filename matches `entity`
- [ ] every relation source entity exists

## 2.5 Wire package scripts

In `package.json` add:

- [ ] `validate:kg`
- [ ] `validate:all` placeholder or initial chained command

Recommended initial scripts:

```json
{
  "scripts": {
    "validate:kg": "tsx scripts/validate-kg.ts",
    "validate:all": "pnpm validate:ingredients && pnpm validate:kg"
  }
}
```

### Definition of done

- [ ] `pnpm validate:kg` runs locally.
- [ ] `pnpm validate:all` includes KG validation.

---

# Phase 3 — Refactor current component usage to the new graph layer

## 3.1 Refactor `ClaimContextModule.astro`

Current file:

- [ ] `src/components/ClaimContextModule.astro`

Tasks:

- [ ] Replace direct `fs` + path scanning with imports from `src/lib/graph/*`.
- [ ] Keep backward-compatible support for frontmatter fallback.
- [ ] Read graph relations from `claimEntityId` first.
- [ ] Resolve linked entities through graph helpers.
- [ ] Resolve labels and paths through shared helpers.
- [ ] Keep current display intact unless user-facing improvement is intentional.

## 3.2 Slim `claimContext` architecture without breaking content

In `src/content.config.ts`:

- [ ] Keep existing fields for now.
- [ ] Add optional `displayOverrides` object if needed.
- [ ] Mark duplicated relation fields as deprecated in comments.

Target long-term `claimContext`:

```yaml
claimContext:
  claimEntityId: "..."
  ingredientEvidenceScore: 5
  displayOverrides:
    regulatoryStatus: "..."
```

### Definition of done

- [ ] Existing claim pages still render.
- [ ] New claim pages can rely on KG for mechanisms, symptoms, related ingredients, and regulatory links.

---

# Phase 4 — Add derived graph APIs

## 4.1 Create graph JSON endpoints

Create:

- [ ] `src/pages/data/graph.json.ts`
- [ ] `src/pages/data/graph.en.json.ts`

Tasks:

- [ ] Use `buildFullGraph('de')` for DE endpoint.
- [ ] Use `buildFullGraph('en')` for EN endpoint.
- [ ] Match the style of existing `src/pages/data/*.json.ts` files.
- [ ] Add caching headers consistent with current JSON endpoints.

## 4.2 Finalize endpoint shape

Recommended response:

```json
{
  "meta": {
    "locale": "de",
    "generatedAt": "...",
    "nodeCount": 0,
    "edgeCount": 0
  },
  "nodes": [],
  "edges": []
}
```

Node minimum fields:

- [ ] `id`
- [ ] `type`
- [ ] `label`
- [ ] `path`

Edge minimum fields:

- [ ] `source`
- [ ] `target`
- [ ] `relation`
- [ ] `confidence`

### Definition of done

- [ ] `/data/graph.json` returns a complete graph snapshot.
- [ ] `/data/graph.en.json` returns the EN view of the same graph.

---

# Phase 5 — Add first graph-aware UI without premature complexity

## 5.1 Create a non-interactive graph context component

Create:

- [ ] `src/components/graph/EntityGraphContext.astro`
- [ ] `src/components/graph/GraphLegend.astro`

Tasks:

- [ ] Render the central entity.
- [ ] Render related claims.
- [ ] Render related mechanisms.
- [ ] Render related symptoms.
- [ ] Render related ingredients.
- [ ] Render regulatory status where present.
- [ ] Use chips/cards/list layout, not a force graph yet.

## 5.2 Decide first integration point

Choose one:

- [ ] ingredient detail pages
- [ ] claim detail pages
- [ ] both

Recommended first integration:

- [ ] start with claim pages because `ClaimContextModule.astro` already exists and provides a natural migration target

### Definition of done

- [ ] At least one live page type renders graph-backed context through shared graph helpers.

---

# Phase 6 — Add graph browsing pages

## 6.1 Scaffold graph pages

Create:

- [ ] `src/pages/graph.astro`
- [ ] `src/pages/en/graph.astro`

## 6.2 Implement useful v1 UX only

- [ ] search box
- [ ] filter by entity type
- [ ] select entity
- [ ] show neighborhood panel
- [ ] fetch graph data from `/data/graph*.json`

## 6.3 Explicitly postpone fancy visualization

Not required for v1:

- [ ] force-directed canvas
- [ ] pan/zoom
- [ ] Cytoscape / D3 integration
- [ ] graph physics tuning

### Definition of done

- [ ] The graph can be explored in a useful way without introducing visualization complexity too early.

---

# Phase 7 — Content-link validation

## 7.1 Add content ↔ graph validation script

Create:

- [ ] `scripts/validate-content-graph-links.ts`

Checks:

- [ ] every claim `ingredient` slug maps to a real ingredient entity
- [ ] every `claimEntityId` maps to a real claim entity
- [ ] graph-backed linked entities resolve to valid paths or intentionally no path
- [ ] claim pages do not reference deleted graph ids in deprecated fallback fields

## 7.2 Wire package scripts

- [ ] add `validate:content-links`
- [ ] extend `validate:all`

Recommended script set at this stage:

```json
{
  "scripts": {
    "validate:kg": "tsx scripts/validate-kg.ts",
    "validate:content-links": "tsx scripts/validate-content-graph-links.ts",
    "validate:all": "pnpm validate:ingredients && pnpm validate:kg && pnpm validate:content-links"
  }
}
```

### Definition of done

- [ ] Broken cross-links between MDX and KG are caught before deploy.

---

# Phase 8 — Bilingual hardening

## 8.1 Add bilingual validation script

Create:

- [ ] `scripts/validate-bilingual-content.ts`

Checks:

- [ ] priority DE ingredient has EN counterpart if required
- [ ] bilingual DE claim has EN counterpart if required
- [ ] DE and EN use the same base slug where intended
- [ ] EN page titles are not accidentally still DE where avoidable
- [ ] EN graph labels have explicit fallback behavior

## 8.2 Decide the bilingual policy explicitly

- [ ] full parity required for all pages
- [ ] parity required only for priority pages
- [ ] parity optional but report missing counterparts

Recommended v1 policy:

- [ ] report missing EN counterparts as warnings unless the content is marked priority/bilingual

### Definition of done

- [ ] EN support is validated without blocking the whole rollout on full parity.

---

# Phase 9 — Generator scripts for safer future expansion

## 9.1 Add generation scripts

Create:

- [ ] `scripts/new-ingredient.ts`
- [ ] `scripts/new-claim.ts`
- [ ] `scripts/new-bilingual-topic.ts`

## 9.2 Start with one generator that creates all critical files

Best first generator:

- [ ] `new-bilingual-topic.ts`

Command target:

```bash
pnpm tsx scripts/new-bilingual-topic.ts safran
```

Should create:

- [ ] `src/content/ingredients/safran.mdx`
- [ ] `src/content/en/ingredients/safran.mdx`
- [ ] `data/entities/ingredients/safran.json`
- [ ] `data/relations/by-entity/safran.json`

Optional:

```bash
pnpm tsx scripts/new-bilingual-topic.ts safran --claim
```

Should also create:

- [ ] claim content file(s)
- [ ] claim entity file(s)
- [ ] claim relation file(s)

### Definition of done

- [ ] New topics can be scaffolded without manual file drift between MDX and KG.

---

# Phase 10 — Migration and cleanup

## 10.1 Migrate claim pages gradually

- [ ] identify all claim pages using duplicated relation fields in frontmatter
- [ ] migrate one small batch first
- [ ] validate after each batch
- [ ] remove duplicated relation data only after graph rendering is confirmed stable

## 10.2 Clean up deprecated fields later, not now

Only after migration is complete:

- [ ] remove `relatedMechanisms` from schema
- [ ] remove `relatedSymptoms` from schema
- [ ] remove `relatedIngredients` from schema
- [ ] remove `regulatoryStatus` from schema if KG fully covers it

### Definition of done

- [ ] Frontmatter no longer carries graph structure except narrowly scoped display overrides.

---

# Recommended implementation order

## Batch 1 — highest leverage, lowest disruption

- [ ] create `src/lib/graph/*`
- [ ] add `data/schema/relation-types.json`
- [ ] add `src/lib/graph/validate.ts`
- [ ] add `scripts/validate-kg.ts`
- [ ] add `pnpm validate:kg`

## Batch 2 — remove duplication in active rendering path

- [ ] refactor `ClaimContextModule.astro` to use graph helpers
- [ ] keep frontmatter fallback
- [ ] verify current claim pages still render

## Batch 3 — expose graph as derived data product

- [ ] add `/data/graph.json`
- [ ] add `/data/graph.en.json`
- [ ] confirm output shape is stable enough for UI use

## Batch 4 — useful graph UI, no overengineering

- [ ] add `EntityGraphContext.astro`
- [ ] add `/graph`
- [ ] add `/en/graph`
- [ ] ship search + filters + neighborhood panel

## Batch 5 — future-proof authoring workflow

- [ ] add content/link validators
- [ ] add bilingual validator
- [ ] add generators
- [ ] migrate older content gradually

---

# Exact first PR scope recommendation

If the goal is to start implementation immediately, make PR 1 only this:

- [ ] `src/lib/graph/types.ts`
- [ ] `src/lib/graph/entities.ts`
- [ ] `src/lib/graph/relations.ts`
- [ ] `src/lib/graph/paths.ts`
- [ ] `src/lib/graph/validate.ts`
- [ ] `src/lib/graph/index.ts`
- [ ] `data/schema/relation-types.json`
- [ ] `scripts/validate-kg.ts`
- [ ] `package.json` script updates

PR 1 acceptance criteria:

- [ ] `pnpm validate:kg` passes
- [ ] graph helpers can load the current KG
- [ ] duplicate ids / broken targets / invalid relations are caught
- [ ] no page rendering behavior changes yet

PR 2 should then be:

- [ ] refactor `ClaimContextModule.astro`
- [ ] add `buildEntityNeighborhood()`
- [ ] keep old frontmatter fallback behavior

PR 3 should then be:

- [ ] add `/data/graph.json`
- [ ] add `/data/graph.en.json`
- [ ] add basic graph UI scaffold

---

# Commands to run during implementation

## After Batch 1

```bash
pnpm validate:kg
```

## After Batch 2

```bash
pnpm validate:kg
pnpm build
```

## After Batch 3+

```bash
pnpm validate:all
pnpm build
```

---

# Risks to watch

- [ ] path logic duplicated in multiple files
- [ ] EN labels promised before data actually supports them well
- [ ] relation vocabulary frozen too early without scanning repo reality
- [ ] `ClaimContextModule.astro` and graph library diverging
- [ ] premature graph visualization complexity slowing real progress

---

# Final recommendation

Start with **library + validation**, not UI.

The best first move is not a graph page.
The best first move is making the existing KG:

- loadable from one place
- validated from one command
- reusable across components, pages, and scripts

Once that exists, the rest becomes straightforward.