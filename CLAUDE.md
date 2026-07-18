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

**Study-YAML Felder (ab 2026-07-18):**
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `study_type` | string | RCT, Meta-Analysis, Systematic Review, Review, Clinical Trial, etc. (aus PubMed pubtype) |
| `evidence_quality` | string | high / moderate / low (auto-gemappt aus study_type) |
| `n` | int | Teilnehmerzahl (aus Abstract extrahiert, falls vorhanden) |
| `coi` | string | none / industry / unclear (Conflict of Interest) |
| `effect_size` | string | Freitext Effektgröße, z.B. "HbA1c -2.0pp (95% CI: -2.8 to -1.2)" |

Felder `n`, `coi`, `effect_size` werden auf Dossier-Seiten als Badges/Text angezeigt (DE+EN).
Study-Index: `npx tsx data/scripts/build-study-index.ts` → `data/study-index.json` + `.csv`

**Neue Studie hinzufügen:**
1. Prüfe ob `data/sources/studies/pmid-XXXXX.yaml` schon existiert
2. Falls nein: erstelle mit `id`, `type: study`, `pmid`, `title`, `authors`, `year`, `url`
3. Im Ingredient-YAML: `- ref: pmid-XXXXX` + `finding: {de, en}`
4. Relation: `basiert_auf_studie` mit `target: studie-XXXXX`

**Batch-Update Study-Metadaten (für bestehende Studien):**
```bash
# study_type + evidence_quality aus PubMed pubtypes (3 API-Calls für ~400 Studien)
python3 scripts/batch-study-metadata.py

# n (Teilnehmerzahl) aus PubMed Abstracts extrahieren (nur high-quality study_types)
python3 scripts/batch-study-n.py
```

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

## Aktueller Stand (Juli 2026)

- **119 Wirkstoff-Dossiers** (DE + EN), alle YAML-basiert
- **293 Produkt-Reviews** (DE + EN) — 50+ Vendors
- **19 Claims-Checks** (DE + EN)
- **6 Research Reviews** (DE + EN) — wöchentliche Studienübersichten
- **438 Studien** im Registry, 196 mit study_type, 41 mit n
- **Knowledge Graph:** 903 Entities, 1929 Relations
- **1039 Seiten** total
- **Playwright Tests:** 12 Smoke Tests (6 Seiten × Desktop + Mobile) via `pnpm test`
- **Kategorien:** nad-precursors, senolytics, antioxidants, adaptogens, metabolic, cognitive, hormonal, general-health, other

**Nav-Struktur:**
Checks ▾ (Ernährungs-Check, Vegan-Check, Claims-Check) | Wirkstoffe | Produkte | Tools ▾ (Wissensgraph, Stack Builder) | Methodik | Studien

## Projektstruktur (Ergänzung)

```
scripts/
  product-index.cjs          # Generiert data/product-index.json (schnelle Lookups)
  add-product.cjs            # Template-basierte Produkt-Erstellung (DE+EN)
  pubmed-digest.js           # Wöchentlicher PubMed-Digest (Cron)
  audit-dossiers.cjs         # Dossier-Qualitäts-Audit
src/
  scripts/graph-viewer.ts    # KG Visualisierung (Cytoscape, multi-row structured layout)
  components/illustrations/  # SVG-Illustrationen im MikroScore-Stil
  components/VerdictBadge.astro  # Locale-aware Verdict-Anzeige (DE/EN)
```

## Backlog (priorisiert)

| # | Task | Priorität |
|---|------|-----------|
| 1 | EN-Übersetzung: ~224 Produkt-Reviews fehlen noch auf EN | hoch |
| 2 | Kinder-Nährstoff-Check (`/kinder-check`, `/en/children-check`) | mittel |
| 3 | Wirkstoff-Merkzettel: Nutzer markiert Wirkstoffe → Produkte filtern (localStorage) | mittel |
| 4 | Citrus Bergamot als Wirkstoff-Dossier anlegen | niedrig |
| 5 | Impressum-Adresse auf e.V. oder Briefkastendienst verlegen | niedrig |
| 6 | Affiliate-Links zu Produkten (Amazon.de, iHerb) — erst bei Traffic | niedrig |

## Produkt-Scoring-Rubrics (ab 2026-07-16)

**Verdict wird automatisch aus compositeScore berechnet** — nie manuell setzen!
- ≥ 7.0 → `empfehlenswert`
- 5.5–6.9 → `akzeptabel`
- < 5.5 → `nicht-empfehlenswert`

**Gewichte:** evidenceForIngredient 15% | valueForMoney 15% | productQuality 30% | labelHonesty 25% | thirdPartyTesting 15%

### evidenceForIngredient
| Score | Kriterium |
|-------|-----------|
| 9–10 | Mehrere unabhängige Meta-Analysen von RCTs; EFSA Health Claim zugelassen |
| 7–8 | Mindestens 2–3 methodisch gute RCTs; klare klinische Effekte |
| 5–6 | Einzelne RCTs oder begrenzte Humanstudien; plausible Wirkmechanismen |
| 3–4 | Hauptsächlich Tierstudien oder In-vitro; wenige oder schwache Humanstudien |
| 1–2 | Nur Traditionsanwendung, anekdotisch oder reine Spekulation |

### productQuality
| Score | Kriterium |
|-------|-----------|
| 9–10 | Pharmazeutische Qualität; premium Rohstoff (Niagen, KSM-66, Carnipure, MK-7…); optimale Darreichungsform; saubere Hilfsstoffe |
| 7–8 | Gute Formulierung; bekannte Qualitäts-Rohstoffe; cGMP; Darreichungsform sinnvoll |
| 5–6 | Standard-Rohstoff; solide Qualität ohne besonderen Mehrwert |
| 3–4 | Generischer Rohstoff unklarer Herkunft; schlechte Darreichungsform (z.B. Magnesiumoxid) |
| 1–2 | Zweifelhafte Formulierung; fehlende Grundstandards |

### labelHonesty
| Score | Kriterium |
|-------|-----------|
| 9–10 | Vollständige Deklaration; keine Übertreibungen; alle Warnhinweise vorhanden |
| 7–8 | Alle Mengen korrekt; nur leicht übertriebene Claims; Anbieter seriös |
| 5–6 | Wesentliche Angaben vorhanden; einige vage Claims |
| 3–4 | Unvollständige Angaben; fragwürdige Wirkversprechen |
| 1–2 | Falsche Angaben; irreführende Claims; Health Claims ohne Zulassung |

### thirdPartyTesting
| Score | Kriterium |
|-------|-----------|
| 9–10 | NSF Certified / USP Verified / Informed Sport / Labdoor A — mit Zertifikatnummer |
| 7–8 | COA öffentlich verfügbar; cGMP-zertifizierter Hersteller; HPLC-geprüft |
| 5–6 | Drittprüfung angegeben, COA auf Anfrage; ISO-Zertifizierung des Herstellers |
| 3–4 | Kein unabhängiges Testing; nur Hersteller-Claim ohne Nachweis |
| 1–2 | Keine Transparenz zur Prüfung |

### valueForMoney
| Score | Kriterium |
|-------|-----------|
| 9–10 | Deutlich günstiger als vergleichbare Produkte gleicher Qualität; < 0,20 €/Tag |
| 7–8 | Faire Marktpreise; 0,20–0,50 €/Tag |
| 5–6 | Etwas teurer; 0,50–1,00 €/Tag; durch Qualitätsmerkmale vertretbar |
| 3–4 | Deutlich teurer ohne klaren Mehrwert; > 1,00 €/Tag |
| 1–2 | Massiv überteuert für das Gebotene |

## Wichtige Konventionen

- **MDX in Astro v6**: `<` in Markdown muss als `&lt;` escaped werden (JSX-Parser)
- **Tailwind v4**: Kein `tailwind.config.js`, keine `@apply` mit config-Werten — nur Utility-Klassen direkt
- **Commits**: immer `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **Build vor Push**: immer `pnpm build` laufen lassen
- **Tests vor Push**: `pnpm test` (Playwright Smoke Tests, 12 Tests)
- **Slugs**: nur `[a-z0-9-]`, keine Umlaute
- **summary-Feld**: max. 200 Zeichen (Zod validiert hart)
- **Kein `@astrojs/tailwind`** installieren — inkompatibel mit Tailwind v4
- **YAML Quotes**: Python `yaml.dump` schreibt Single-Quotes (`'value'`). Der `parseSimpleYaml` in `build-study-index.ts` handhabt beide Quote-Typen. Bei eigenen YAML-Parse-Scripts immer `["']` im Regex verwenden.

## Schlüssel-Dateien

| Zweck | Datei |
|-------|-------|
| Zod-Schemas aller Collections | `src/content.config.ts` |
| Scoring-Logik | `src/utils/scoring.ts` |
| Ingredient Generator | `data/scripts/generate-from-source.ts` |
| Product Generator | `data/scripts/generate-products.ts` |
| Study Extraction | `data/scripts/extract-studies.ts` |
| KG Index Builder | `data/scripts/build-index.ts` |
| Study Index Builder | `data/scripts/build-study-index.ts` |
| Batch Study Metadata | `scripts/batch-study-metadata.py` |
| Batch Study N | `scripts/batch-study-n.py` |
| Playwright Tests | `tests/smoke.spec.ts` + `playwright.config.ts` |
| Produkt-Template-Script | `scripts/add-product.cjs` |
| Produkt-Index | `data/product-index.json` (via `scripts/product-index.cjs`) |
| Graph Viewer (Mobile-opt.) | `src/scripts/graph-viewer.ts` |
| i18n | `src/i18n/de.ts`, `src/i18n/en.ts` |
| Layout + Nav | `src/layouts/BaseLayout.astro` |
