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
  sources/ingredients/       # YAML Single Source of Truth (neue Architektur)
  entities/ingredients/      # KG Entity JSONs (111 Stück)
  relations/by-entity/       # KG Relations JSONs (169 Stück)
  relations/by-type/         # KG Relations nach Typ (8 Stück)
  schema/                    # JSON + YAML Schemas
  scripts/                   # Generator + Migration Scripts
src/
  content/
    ingredients/             # 111 Wirkstoff-Dossiers (DE, MDX)
    en/ingredients/          # 13 Wirkstoff-Dossiers (EN, MDX)
    products/                # ~100 Produkt-Reviews (MDX)
    claims/                  # 21 Claims-Checks (DE, MDX)
    en/claims/               # 19 Claims-Checks (EN, MDX)
    research-review/         # Wöchentliche Studienübersichten (MDX)
  content.config.ts          # Zod-Schemas für alle Collections
  pages/
    wirkstoffe/              # Wirkstoff-Übersicht + Detail
    produkte/                # Produkt-Übersicht + Detail
    claims/                  # Claims-Check
    research-review/         # Wöchentliche Research Reviews
    graph.astro              # Knowledge Graph Viewer
    ernaehrungs-check.astro  # 10-Fragen-Check
    interaktions-check.astro # Wechselwirkungen prüfen
    en/                      # Englische Seiten
  layouts/BaseLayout.astro   # Nav, Footer, Vercel Analytics, i18n
  lib/graph/                 # KG Library (TypeScript)
  utils/scoring.ts           # compositeScore() + WEIGHTS
```

---

## Content-Schema (wichtigste Felder)

### ingredients
- `category`: `nad-precursors | senolytics | antioxidants | adaptogens | metabolic | other`
- `evidenceLevel`: `'1'`–`'5'` (1 = stärkste Evidenz)
- `safety_rating`: `safe | likely-safe | caution | insufficient-data`
- `summary`: max. 200 Zeichen
- `key_studies`: max. 5 Einträge mit PMID

### products
- `ingredient`: Slug des verlinkten Wirkstoffs
- `ratings`: 5 Dimensionen (evidenceForIngredient, valueForMoney, productQuality, labelHonesty, thirdPartyTesting), je 0–10
- `verdict`: `empfehlenswert | akzeptabel | nicht-empfehlenswert`

---

## Aktueller Stand

- **111 Wirkstoff-Dossiers** (DE), **111 EN-Dossiers** (davon 90 noch NEEDS_EN-Platzhalter)
- **~100 Produkt-Reviews** mit Affiliate-Links
- **21 Claims-Checks** (DE), **19 EN**
- **2 Research Reviews** (wöchentliche Studienübersichten)
- **Knowledge Graph** mit 168 Entities, 1.429 Relationen
- Ernährungs-Check, Interaktions-Check, Vegan-Check
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
| 1 | Impressum-Adresse auf e.V. oder Briefkastendienst (Digitalcourage) verlegen | niedrig |
| 2 | Affiliate-Links zu Produkten hinzufügen (Amazon.de, iHerb) — erst wenn Traffic da | niedrig |
| 3 | Wirkstoff-Merkzettel: Nutzer markiert interessante Wirkstoffe → Produkte nach Match-Score filtern (localStorage, kein Login) | mittel |

---

## Wichtige Konventionen

- **MDX in Astro v6**: `<` in Markdown muss als `&lt;` escaped werden (JSX-Parser)
- **Tailwind v4**: Kein `tailwind.config.js`, keine `@apply` mit config-Werten — nur Utility-Klassen direkt
- **Commits**: immer `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **Build vor Push**: immer `pnpm build` laufen lassen
- **Slugs**: nur `[a-z0-9-]`, keine Umlaute
- **summary-Feld**: max. 200 Zeichen (Zod validiert hart)
- **Kein `@astrojs/tailwind`** installieren — inkompatibel mit Tailwind v4
