# MikroScore — Projekt-Kontext für Claude

## Was ist das?

**MikroScore** (mikroscore.com) ist eine evidenzbasierte Longevity-Supplement-Bewertungsseite für den DACH-Markt. Positionierung: Finanzfluss für Supplements — kostenlos, transparent, EU-Regulatorik-Fokus (EFSA, BfR).

Betreiber: Yona Paproth & Dr. Sarah Rahmati (Krefeld)

## Tech-Stack

| Was | Womit |
|-----|-------|
| Framework | **Astro v6** (static site, Content Collections) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` (NICHT `@astrojs/tailwind`) |
| Content | MDX-Dateien mit Zod-Schema-Validierung |
| Package Manager | **pnpm** |
| Deployment | **Vercel** (Auto-deploy aus GitHub `YonaPaproth/longevity-check`) |
| Analytics | **Vercel Analytics** (cookielos, in BaseLayout eingebunden) |

## YAML Single Source of Truth

**Kernarchitektur — gilt für Wirkstoffe UND Produkte:**

```
data/sources/ingredients/<slug>.yaml    ← Nur hier editieren!
data/sources/products/<slug>.yaml       ← Nur hier editieren!
        │
        ├── src/content/{ingredients,products}/<slug>.mdx      (DE, generiert)
        ├── src/content/en/{ingredients,products}/<slug>.mdx   (EN, generiert)
        ├── data/entities/{ingredients,products}/<slug>.json   (KG Entity, generiert)
        └── data/relations/by-entity/<slug>.json               (KG Relations, generiert)
```

**Produkt-YAML:** Strukturierter Body (description, pros[], cons[], usage statt Markdown).
Ratings mit bilingualen Explanations. Relationen auto-generiert aus `containedIngredients`.

**Study Registry:** Studien-Metadaten zentral in `data/sources/studies/pmid-XXXXX.yaml`.
Ingredient-YAMLs referenzieren per `ref: pmid-XXXXX` + ingredient-spezifischem `finding:`.
Studien ohne PMID (z.B. EFSA-Dokumente) bleiben inline im Ingredient-YAML.
KG-Entity-ID für Studien: `studie-XXXXX` (nicht `pmid-`!).

**Neue Studie hinzufügen:**
1. Prüfe ob `data/sources/studies/pmid-XXXXX.yaml` schon existiert
2. Falls nein: erstelle mit `id`, `type: study`, `pmid`, `title`, `authors`, `year`, `url`
3. Im Ingredient-YAML: `- ref: pmid-XXXXX` + `finding: {de, en}`
4. Relation: `basiert_auf_studie` mit `target: studie-XXXXX`

**Workflow Wirkstoffe:**
1. Editiere `data/sources/ingredients/<slug>.yaml` (Studien ggf. in `data/sources/studies/`)
2. Generiere: `npx tsx data/scripts/generate-from-source.ts <slug>` | `--changed` | ohne Arg (alle)
3. Index + Build + Commit (s.u.)

**Workflow Produkte:**
1. Editiere `data/sources/products/<slug>.yaml`
2. Generiere: `npx tsx data/scripts/generate-products.ts <slug>` | `--changed` | ohne Arg (alle)
3. Index + Build + Commit (s.u.)

**Nach jeder Generierung:**
1. Index: `npx tsx data/scripts/build-index.ts`
2. Build: `pnpm build`
3. Committe YAML + alle generierten Dateien zusammen

**Generierte MDX-Dateien nie manuell editieren!**

Schema-Doku: `data/sources/schema.md` | Formales Schema: `data/schema/ingredient-source.schema.yaml`

## Knowledge Graph

File-basierter KG unter `data/`:
- **Entities:** `data/entities/{ingredients,products,mechanisms,symptoms,biomarkers,regulatory,studies}/*.json`
- **Relations:** `data/relations/by-entity/<id>.json` (pro Entity) + `data/relations/by-type/<type>.json` (Aggregate)
- **Index:** `data/index.json` (kompakter Lookup, wird via `data/scripts/build-index.ts` generiert)
- **Library:** `src/lib/graph/` (TypeScript: types, entities, relations, paths, labels, builders)

## Wichtige Konventionen

- **MDX in Astro v6**: `<` in Markdown muss als `&lt;` escaped werden (JSX-Parser)
- **Tailwind v4**: Kein `tailwind.config.js`, keine `@apply` mit config-Werten — nur Utility-Klassen direkt
- **Commits**: immer `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **Build vor Push**: immer `pnpm build` laufen lassen
- **Slugs**: nur `[a-z0-9-]`, keine Umlaute
- **summary-Feld**: max. 200 Zeichen (Zod validiert hart)
- **Kein `@astrojs/tailwind`** installieren — inkompatibel mit Tailwind v4

## Schlüssel-Dateien

| Zweck | Datei |
|-------|-------|
| Zod-Schemas aller Collections | `src/content.config.ts` |
| Scoring-Logik | `src/utils/scoring.ts` |
| Ingredient Generator | `data/scripts/generate-from-source.ts` |
| Product Generator | `data/scripts/generate-products.ts` |
| Study Extraction | `data/scripts/extract-studies.ts` |
| KG Index Builder | `data/scripts/build-index.ts` |
| Produkt-Template-Script | `scripts/add-product.cjs` |
| Produkt-Index | `data/product-index.json` (via `scripts/product-index.cjs`) |
| i18n | `src/i18n/de.ts`, `src/i18n/en.ts` |
| Layout + Nav | `src/layouts/BaseLayout.astro` |
