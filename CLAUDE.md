# MikroScore — Projekt-Kontext für Claude

## Was ist das?

**MikroScore** (mikroscore.com) ist eine evidenzbasierte Longevity-Supplement-Bewertungsseite für den deutschen Markt. Positionierung: Finanzfluss für Supplements — kostenlos, transparent, kein Hype, EU-Regulatorik-Fokus (EFSA, BfR). Zielgruppe: DACH-Markt, später international.

Betreiber: Yona Paproth & Dr. Sarah Rahmati (Krefeld)

---

## Tech-Stack

| Was | Womit |
|-----|-------|
| Framework | **Astro v6** (static site, Content Collections) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` (NICHT `@astrojs/tailwind`) |
| Content | MDX-Dateien mit Zod-Schema-Validierung |
| Package Manager | **pnpm** |
| Deployment | **Vercel** (Auto-deploy aus GitHub `YonaPaproth/longevity-check`) |
| Analytics | **Vercel Analytics** (cookielos, in BaseLayout eingebunden) |

---

## Projektstruktur

```
data/
  sources/ingredients/       # YAML Single Source of Truth (112 Stück)
  entities/ingredients/      # KG Entity JSONs (118 Stück)
  entities/mechanisms/       # KG Mechanism Entities
  entities/biomarkers/       # KG Biomarker Entities
  entities/symptoms/         # KG Symptom + Kontraindikation Entities
  entities/regulatory/       # KG Regulatory Entities (EFSA)
  relations/by-entity/       # KG Relations JSONs (176 Stück)
  relations/by-type/         # KG Relations nach Typ
  schema/                    # JSON + YAML Schemas
  scripts/                   # Generator + Migration Scripts
  product-index.json         # Auto-generierter Produkt-Index (via scripts/product-index.cjs)
src/
  content/
    ingredients/             # 118 Wirkstoff-Dossiers (DE, MDX)
    en/ingredients/          # 118 Wirkstoff-Dossiers (EN, MDX)
    products/                # 265 Produkt-Reviews (DE, MDX)
    en/products/             # 41 Produkt-Reviews (EN, MDX)
    claims/                  # 19 Claims-Checks (DE, MDX)
    en/claims/               # 19 Claims-Checks (EN, MDX)
    research-review/         # 4 Wöchentliche Studienübersichten (DE, MDX)
    en/research-review/      # 3 Studienübersichten (EN, MDX)
  content.config.ts          # Zod-Schemas für alle Collections
  pages/
    wirkstoffe/              # Wirkstoff-Übersicht + Detail
    produkte/                # Produkt-Übersicht + Detail
    claims/                  # Claims-Check
    research-review/         # Wöchentliche Studien-Reviews
    graph.astro              # Knowledge Graph Viewer
    stack-builder.astro      # Supplement Stack Builder
    ernaehrungs-check.astro  # 10-Fragen-Check
    vegan-supplement-check   # Vegan-Check
    en/                      # Englische Seiten (Spiegelstruktur)
  layouts/BaseLayout.astro   # Nav, Footer, Vercel Analytics, i18n
  lib/graph/                 # KG Library (TypeScript)
  scripts/graph-viewer.ts    # KG Visualisierung (Cytoscape, structured layout)
  utils/scoring.ts           # compositeScore() + WEIGHTS
  i18n/de.ts, en.ts          # Übersetzungen
scripts/
  product-index.cjs          # Generiert data/product-index.json
  add-product.cjs            # Template-basierte Produkt-Erstellung (DE+EN)
  pubmed-digest.js           # Wöchentlicher PubMed-Digest (Cron)
  audit-dossiers.cjs         # Dossier-Qualitäts-Audit
```

---

## Content-Schema (wichtigste Felder)

### ingredients
- `category`: `nad-precursors | senolytics | antioxidants | adaptogens | metabolic | cognitive | hormonal | general-health | other`
- `evidenceLevel`: `'1'`–`'5'` (1 = stärkste Evidenz)
- `safety_rating`: `safe | likely-safe | caution | insufficient-data`
- `summary`: max. 200 Zeichen
- `key_studies`: max. 5 Einträge mit PMID

### products
- `ingredient`: Slug des verlinkten Wirkstoffs
- `ratings`: 5 Dimensionen (evidenceForIngredient, valueForMoney, productQuality, labelHonesty, thirdPartyTesting), je 0–10
- `verdict`: `empfehlenswert | akzeptabel | nicht-empfehlenswert`

---

## Aktueller Stand (Juni 2026)

- **118 Wirkstoff-Dossiers** (DE + EN)
- **265 Produkt-Reviews** (DE), 41 EN — 45 Vendors
- **19 Claims-Checks** (DE + EN)
- **4 Research Reviews** (wöchentliche Studienübersichten, DE), 3 EN
- **Knowledge Graph** mit 215 Entities, 176 Relations-Dateien
- **742 Seiten** total
- **Checks:** Ernährungs-Check, Vegan-Check, Claims-Check (alle im Checks-Dropdown)
- **Tools:** Wissensgraph, Stack Builder (im Tools-Dropdown)
- **Nav:** Checks ▾ | Wirkstoffe | Produkte | Tools ▾ | Methodik | Studien
- **Kategorien:** nad-precursors, senolytics, antioxidants, adaptogens, metabolic, cognitive, hormonal, general-health, other
- Flow: Check → Dossier → Produkte vollständig verknüpft

---

## YAML Single Source of Truth (ab Juni 2026)

**Neue Architektur für Wirkstoff-Dossiers:**

```
data/sources/ingredients/<slug>.yaml    ← EDIT THIS (Single Source of Truth)
        │
        ├── src/content/ingredients/<slug>.mdx          (DE, generiert)
        ├── src/content/en/ingredients/<slug>.mdx       (EN, generiert)
        ├── data/entities/ingredients/<slug>.json       (KG Entity, generiert)
        └── data/relations/by-entity/<slug>.json        (KG Relations, generiert)
```

**Workflow:**
1. Editiere nur `data/sources/ingredients/<slug>.yaml`
2. Generiere: `npx tsx data/scripts/generate-from-source.ts [slug]`
3. Build: `pnpm build`
4. Committe YAML + alle generierten Dateien zusammen

**Wichtig:** Generierte MDX-Dateien **nicht** manuell editieren! Änderungen gehen ins YAML.

**Schema-Doku:** `data/sources/schema.md`
**Formales Schema:** `data/schema/ingredient-source.schema.yaml`

**Status:** Alle 111 Dossiers sind auf YAML migriert. 90 davon brauchen noch EN-Übersetzung (markiert mit `NEEDS_EN_TRANSLATION` / `NEEDS_EN_BODY`).

### EN-Übersetzung: Workflow für Agents

**90 Dossiers brauchen EN-Prosa.** So geht's:

```bash
# 1. Finde Dossiers die EN brauchen:
grep -l "NEEDS_EN" data/sources/ingredients/*.yaml

# 2. Öffne das YAML und ersetze alle NEEDS_EN-Platzhalter:
#    - NEEDS_EN_TRANSLATION → Englische Übersetzung des DE-Texts
#    - NEEDS_EN_BODY → Komplettes englisches Dossier (800+ Wörter)
#
#    Qualitätsregeln für EN:
#    - Nicht wörtlich übersetzen, sondern für EN-Leser neu schreiben
#    - Konkrete Effektgrößen, CIs, Stichprobengrößen
#    - Ehrliche Limitationen
#    - EFSA-Status klar benennen
#    - Kein Marketing
#    - summary: max 200 Zeichen!

# 3. Generiere die MDX:
npx tsx data/scripts/generate-from-source.ts <slug>

# 4. Build testen:
pnpm build

# 5. Commit: YAML + generierte Dateien zusammen
```

**Batch-Migration-Script:** `python3 data/scripts/migrate-mdx-to-yaml.py`
- `--dry-run` — Preview ohne Schreiben
- `--list-missing-en` — Zeigt alle Slugs die EN brauchen
- Ohne Argumente: migriert alle noch nicht migrierten MDX

**Priorisierung für EN-Übersetzung:**
- **Top-Priorität:** Dossiers mit >800w DE (hohes Suchvolumen)
- **Mittel:** 400-800w DE
- **Niedrig:** <400w DE (oft nur Kurztexte wie Mineralien)

---

## Backlog (priorisiert)

| # | Task | Priorität |
|---|------|-----------|
| 1 | EN-Übersetzung: ~224 Produkt-Reviews fehlen noch auf EN | hoch |
| 2 | Kinder-Nährstoff-Check (`/kinder-check`, `/en/children-check`) | mittel |
| 3 | Wirkstoff-Merkzettel: Nutzer markiert Wirkstoffe → Produkte filtern (localStorage) | mittel |
| 4 | Impressum-Adresse auf e.V. oder Briefkastendienst verlegen | niedrig |
| 5 | Affiliate-Links zu Produkten (Amazon.de, iHerb) — erst bei Traffic | niedrig |
| 6 | Citrus Bergamot als Wirkstoff-Dossier anlegen | niedrig |

---

## Wichtige Konventionen

- **MDX in Astro v6**: `<` in Markdown muss als `&lt;` escaped werden (JSX-Parser)
- **Tailwind v4**: Kein `tailwind.config.js`, keine `@apply` mit config-Werten — nur Utility-Klassen direkt
- **Commits**: immer `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **Build vor Push**: immer `pnpm build` laufen lassen
- **Slugs**: nur `[a-z0-9-]`, keine Umlaute
- **summary-Feld**: max. 200 Zeichen (Zod validiert hart)
- **Kein `@astrojs/tailwind`** installieren — inkompatibel mit Tailwind v4
