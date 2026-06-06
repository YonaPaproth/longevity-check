# Mikroscore knowledge graph implementation checklist

_Status: implementation-ready (v1 architecture with studies as first-class KG entities)_

This checklist turns the higher-level plan into an execution sequence that fits the current repo.

## What exists today

- `data/entities/*` already exists for ingredients, claims, mechanisms, symptoms, regulatory, biomarkers.
- `data/relations/by-entity/*` already exists.
- `src/components/ClaimContextModule.astro` already reads KG JSON directly and falls back to frontmatter.
- `src/pages/data/*.json.ts` already exists for other derived APIs.
- `tsx` and `zod` are already installed.
- DE + EN content collections already exist in `src/content.config.ts`.
- Study metadata is currently split across MDX frontmatter:
  - ingredient pages use `key_studies`
  - claim pages use `sources`
  - KG does not yet model studies as first-class entities

## V1 architecture decision

**Studies belong in the KG from the start.**

That means:

- the KG becomes the canonical home for study metadata
- ingredient/claim pages reference studies by ID instead of duplicating title/PMID/link data
- editorial pages still control which studies to surface and how to describe them
- the public graph UI does **not** need to show study nodes by default

## Canonical ownership rules

### KG owns

- graph structure
- entity identity
- relation identity
- study metadata
- reusable labels/path resolution

### MDX owns

- prose
- verdicts and editorial framing
- page-specific display order
- optional page-specific study highlights or overrides

## Implementation rules

- Do **not** rebuild content architecture from scratch.
- Make the **knowledge graph canonical for relationships**.
- Make the **knowledge graph canonical for reusable study metadata**.
- Keep MDX canonical for **editorial prose and page-specific nuance**.
- Centralize graph logic in `src/lib/graph/*` so components/pages/scripts stop reimplementing file loading.
- Keep rollout backward-compatible until validation and migration are in place.
- Hide `study` nodes from default graph visualization unless explicitly enabled.

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
  - [ ] `study`
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
- [ ] Decide the canonical study ID rule:
  - [ ] prefer `pmid-<PMID>` when PMID exists
  - [ ] otherwise `doi-<normalized-doi>`
  - [ ] otherwise one explicit fallback rule, documented in schema

## 0.2 Define the study model up front

- [ ] Decide minimum required study fields for v1:
  - [ ] `id`
  - [ ] `type: "study"`
  - [ ] `title`
  - [ ] `authors`
  - [ ] `year`
  - [ ] `url`
- [ ] Decide recommended optional fields:
  - [ ] `pmid`
  - [ ] `doi`
  - [ ] `journal`
  - [ ] `studyType`
  - [ ] `summary`
- [ ] Decide whether study summaries are neutral data summaries or page-specific editorial summaries.
- [ ] Decide how claim pages distinguish between:
  - [ ] study-backed citations
  - [ ] non-study sources such as EFSA pages, regulator docs, reviews, news, product pages

### Recommended v1 rule

- Study entity = reusable bibliographic record
- MDX page = selects study IDs and may add short editorial note/highlight
- Claim `sources` remains available for non-study references

### Definition of done

- [ ] The allowed types and output shape are written down in code comments and schema files.
- [ ] No future task in this checklist depends on an undefined relation, locale rule, or study ID convention.

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
  - [ ] `StudyEntity`
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
- [ ] Include `data/entities/studies`.
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
- [ ] Study entities load exactly like other entity types.

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
- [ ] Ensure study relations are supported:
  - [ ] `ingredient -> study`
  - [ ] `claim -> study`
  - [ ] optionally later `mechanism -> study`, `symptom -> study`

### Definition of done

- [ ] Components no longer need to read `data/relations/by-entity/*.json` directly.

## 1.5 Implement label resolution

In `src/lib/graph/labels.ts`:

- [ ] Define how DE labels are resolved from entity JSON today.
- [ ] Define how EN labels are resolved in v1.
- [ ] Define study label behavior:
  - [ ] UI-friendly short label for a study node/card
  - [ ] fallback if title is very long
- [ ] Export:
  - [ ] `getEntityLabel(entity, locale)`
  - [ ] `getEntityDescription(entity, locale)`
  - [ ] `getRelationLabel(relation, locale)`
- [ ] If EN label data is incomplete, define deterministic fallback behavior.

### Recommended v1 fallback behavior

- DE:
  - Prefer `entity.name` for normal entities
  - Prefer `entity.title` for study entities
- EN:
  - Prefer explicit EN mapping if available later
  - Otherwise fall back to the stored entity title/name

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
- [ ] Decide study entity path behavior in v1:
  - [ ] return PubMed/DOI external URL only in study cards, not as normal site path
  - [ ] or return `undefined` and keep external links as separate fields

### Recommended v1 rule

- `getEntityPath()` returns internal site paths only
- studies expose `externalUrl` separately
- graph UI does not pretend study entities are first-class public pages yet

### Definition of done

- [ ] Path logic lives in one place and is reusable by endpoints, components, and future graph UI.

## 1.7 Implement graph builders

In `src/lib/graph/builders.ts`:

- [ ] Add `buildEntityNeighborhood(entityId, locale, depth = 1, options?)`.
- [ ] Add `buildIngredientGraph(slug, locale, options?)`.
- [ ] Add `buildClaimGraph(slug, locale, options?)`.
- [ ] Add `buildFullGraph(locale, options?)`.
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
- [ ] Add option flags such as:
  - [ ] `includeStudies?: boolean`
  - [ ] `includeExternalOnlyNodes?: boolean`

### Recommended v1 rule

- Detail views may include study nodes/cards when explicitly requested
- Full graph endpoint may include studies as data, but graph UI should be able to hide them by default

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
- [ ] `data/schema/study-entity.schema.json`

> A single generic `entity.schema.json` is still useful, but studies are structured enough to justify a dedicated schema early.

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
- [ ] Validate study ID format.
- [ ] Validate study identifier uniqueness:
  - [ ] no duplicate PMIDs
  - [ ] no duplicate DOIs after normalization
- [ ] Validate study required fields.
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
- [ ] every study entity has a valid canonical ID
- [ ] every study entity has at least one stable identifier or documented fallback
- [ ] no duplicate PMID/DOI records

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

# Phase 3 — Refactor content architecture to KG-backed studies and relations

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

## 3.2 Add study-backed content contracts in `src/content.config.ts`

### Ingredient collection

- [ ] Add `keyStudyIds: string[]` as the new canonical study reference field.
- [ ] Keep `key_studies` temporarily for backward compatibility.
- [ ] Mark `key_studies` as deprecated in comments.
- [ ] Optionally add `studyHighlights` keyed by study ID if page-level nuance is needed.

### Claim collection

- [ ] Add `studyIds: string[]` for claim pages when a claim relies on explicit study entities.
- [ ] Keep `sources` for non-study references and mixed references during migration.
- [ ] Decide whether `sources` may temporarily contain study URLs during migration.

### Recommended v1 field shape

Ingredient pages:

```yaml
keyStudyIds:
  - pmid-24299602
  - pmid-30036891
```

Claim pages:

```yaml
studyIds:
  - pmid-24299602
  - pmid-32221179
sources:
  - label: "EFSA Register entry"
    url: "..."
```

## 3.3 Add study rendering helpers/components

- [ ] Add graph helper(s) to resolve `studyIds` into study entities.
- [ ] Add a reusable study list/card renderer if needed.
- [ ] Decide where external links appear:
  - [ ] PubMed URL
  - [ ] DOI URL
  - [ ] both if available

### Definition of done

- [ ] Existing claim pages still render.
- [ ] New ingredient and claim pages can reference studies by ID.
- [ ] Duplicated study title/PMID/link metadata is no longer required in new MDX.

---

# Phase 4 — Add derived graph APIs

## 4.1 Create graph JSON endpoints

Create:

- [ ] `src/pages/data/graph.json.ts`
- [ ] `src/pages/data/graph.en.json.ts`

Tasks:

- [ ] Use `buildFullGraph('de', options)` for DE endpoint.
- [ ] Use `buildFullGraph('en', options)` for EN endpoint.
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
    "edgeCount": 0,
    "includesStudies": false
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

## 4.3 Decide study exposure policy in APIs

Choose explicitly:

- [ ] `/data/graph*.json` excludes studies by default
- [ ] `/data/graph*.json` includes studies by default
- [ ] `/data/graph*.json` includes a query flag or separate endpoint for studies

### Recommended v1 rule

- default `/data/graph*.json` excludes `study` nodes for public visualization simplicity
- add a future option such as `/data/graph.full.json` or query-flagged inclusion later
- page-level components may still fetch study data through graph helpers on the server side

### Definition of done

- [ ] `/data/graph.json` returns a complete public graph snapshot appropriate for visualization.
- [ ] Study data is available in the KG model even if hidden from the first public graph endpoint.

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
- [ ] Render linked studies as a supporting evidence section when useful.
- [ ] Use chips/cards/list layout, not a force graph yet.

## 5.2 Decide first integration point

Choose one:

- [ ] ingredient detail pages
- [ ] claim detail pages
- [ ] both

Recommended first integration:

- [ ] start with claim pages because `ClaimContextModule.astro` already exists and provides a natural migration target
- [ ] then add study-backed ingredient evidence sections

### Definition of done

- [ ] At least one live page type renders graph-backed context through shared graph helpers.
- [ ] At least one live page type renders KG-backed study references without duplicating citation metadata in MDX.

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
- [ ] study nodes in the default public visualization

### Definition of done

- [ ] The graph can be explored in a useful way without introducing visualization complexity too early.

---

# Phase 7 — Content-link and citation validation

## 7.1 Add content ↔ graph validation script

Create:

- [ ] `scripts/validate-content-graph-links.ts`

Checks:

- [ ] every claim `ingredient` slug maps to a real ingredient entity
- [ ] every `claimEntityId` maps to a real claim entity
- [ ] every `keyStudyIds[]` entry maps to a real study entity
- [ ] every `studyIds[]` entry maps to a real study entity
- [ ] graph-backed linked entities resolve to valid paths or intentionally no path
- [ ] claim pages do not reference deleted graph ids in deprecated fallback fields

## 7.2 Add study/citation consistency checks

- [ ] detect ingredient pages that still duplicate full `key_studies` metadata after migration
- [ ] detect claim pages whose `sources` duplicate a known study entity URL/PMID
- [ ] warn when a study is referenced by page frontmatter but not connected in KG relations
- [ ] warn when a KG study relation exists but the page never surfaces the study in any study ID list

## 7.3 Wire package scripts

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
- [ ] Duplicated study/citation drift is caught before deploy.

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
- [ ] study entities remain locale-neutral while labels/rendering stay deterministic

## 8.2 Decide the bilingual policy explicitly

- [ ] full parity required for all pages
- [ ] parity required only for priority pages
- [ ] parity optional but report missing counterparts

Recommended v1 policy:

- [ ] report missing EN counterparts as warnings unless the content is marked priority/bilingual
- [ ] keep study entities locale-neutral and reuse them across DE/EN pages

### Definition of done

- [ ] EN support is validated without blocking the whole rollout on full parity.

---

# Phase 9 — Generator scripts for safer future expansion

## 9.1 Add generation scripts

Create:

- [ ] `scripts/new-study.ts`
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

## 9.3 Add study scaffolding

Command target:

```bash
pnpm tsx scripts/new-study.ts --pmid 24299602
```

Should create:

- [ ] `data/entities/studies/pmid-24299602.json`
- [ ] optionally patch one or more `data/relations/by-entity/*.json` files when `--link ingredient:safran` or `--link claim:safran-preis-gesundheit` is supplied

### Definition of done

- [ ] New topics can be scaffolded without manual file drift between MDX and KG.
- [ ] New studies can be added once and reused across multiple pages/entities.

---

# Phase 10 — Migration and cleanup

## 10.1 Migrate ingredient pages gradually

- [ ] identify all ingredient pages still using `key_studies`
- [ ] create study entities for their referenced papers
- [ ] convert one small batch first from `key_studies` to `keyStudyIds`
- [ ] validate after each batch
- [ ] keep `key_studies` only until rendering and validation are stable

## 10.2 Migrate claim pages gradually

- [ ] identify claim pages where `sources` are actually studies
- [ ] convert reusable study citations into study entities + `studyIds`
- [ ] keep `sources` for non-study references
- [ ] validate after each batch

## 10.2b Bridge graph coverage before full claim migration

Problem observed in current repo:

- many claim MDX pages already exist in `src/content/claims/*`
- but only a small subset currently exists as `data/entities/claims/*`
- result: the graph UI only shows the migrated claims, which makes claim coverage feel incomplete

Add an interim backlog item:

- [ ] derive fallback claim graph nodes from `src/content/claims/*.mdx` when no matching `data/entities/claims/*.json` exists yet
- [ ] use claim page slug as fallback node `id`
- [ ] use frontmatter title / summary / verdict / ingredient / claimContext metadata for fallback node enrichment
- [ ] prefer canonical KG claim entity data whenever a real claim entity exists
- [ ] do **not** invent graph relations that are not present; only derive safe fallback metadata until claim entities are migrated
- [ ] clearly document that fallback claim nodes are transitional and should disappear as real KG claim entities are added

### Definition of done

- [ ] all existing claim pages can appear as graph nodes even before full KG claim migration
- [ ] migrated KG claim entities always win over fallback MDX-derived claim nodes
- [ ] the graph UI no longer looks artificially sparse just because claim migration is incomplete

## 10.3 Clean up deprecated fields later, not now

Only after migration is complete:

- [ ] remove `relatedMechanisms` from schema
- [ ] remove `relatedSymptoms` from schema
- [ ] remove `relatedIngredients` from schema
- [ ] remove `regulatoryStatus` from schema if KG fully covers it
- [ ] remove ingredient `key_studies` from schema once all migrated
- [ ] narrow claim `sources` docs to non-study sources only if desired

### Definition of done

- [ ] Frontmatter no longer carries graph structure except narrowly scoped display overrides.
- [ ] Study metadata is no longer duplicated across ingredient and claim MDX.

---

# Recommended implementation order

## Batch 1 — highest leverage, lowest disruption

- [ ] create `src/lib/graph/*`
- [ ] add `study` to graph types and entity loading
- [ ] add `data/schema/relation-types.json`
- [ ] add `data/schema/study-entity.schema.json`
- [ ] add `src/lib/graph/validate.ts`
- [ ] add `scripts/validate-kg.ts`
- [ ] add `pnpm validate:kg`

## Batch 2 — introduce study entities without changing all page rendering yet

- [ ] add `data/entities/studies/*`
- [ ] add initial study relation links for one pilot ingredient and one pilot claim
- [ ] verify validation catches duplicate/bad study IDs

## Batch 3 — remove duplication in active rendering paths

- [ ] refactor `ClaimContextModule.astro` to use graph helpers
- [ ] add `keyStudyIds` / `studyIds` support in schemas
- [ ] keep frontmatter fallback
- [ ] verify current claim pages still render

## Batch 4 — expose graph as derived data product

- [ ] add `/data/graph.json`
- [ ] add `/data/graph.en.json`
- [ ] keep studies hidden from default public graph endpoint unless explicitly included
- [ ] confirm output shape is stable enough for UI use

## Batch 5 — useful graph UI, no overengineering

- [ ] add `EntityGraphContext.astro`
- [ ] add `/graph`
- [ ] add `/en/graph`
- [ ] ship search + filters + neighborhood panel
- [ ] render study-backed evidence lists on entity pages

## Batch 6 — future-proof authoring workflow

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
- [ ] `data/schema/study-entity.schema.json`
- [ ] `scripts/validate-kg.ts`
- [ ] `package.json` script updates

PR 1 acceptance criteria:

- [ ] `pnpm validate:kg` passes
- [ ] graph helpers can load the current KG
- [ ] graph helpers are ready for `study` entities even if only a pilot set exists at first
- [ ] duplicate ids / broken targets / invalid relations are caught
- [ ] no page rendering behavior changes yet

PR 2 should then be:

- [ ] add pilot study entities
- [ ] connect one ingredient and one claim to studies via KG relations
- [ ] add `keyStudyIds` / `studyIds` schema support
- [ ] keep old fallback behavior

PR 3 should then be:

- [ ] refactor `ClaimContextModule.astro`
- [ ] add study-backed rendering helpers
- [ ] start using KG-backed studies on pages

PR 4 should then be:

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
- [ ] study nodes overwhelming the public graph view
- [ ] study entities with inconsistent PMID/DOI normalization
- [ ] duplicated study metadata lingering in MDX too long
- [ ] mixing study citations and non-study sources without a clear rule

---

# Final recommendation

Start with **library + validation + study entity support**, not UI.

The best first move is not a graph page.
The best first move is making the existing KG:

- loadable from one place
- validated from one command
- reusable across components, pages, and scripts
- ready to store studies once instead of duplicating them across MDX

Once that exists, the rest becomes straightforward.