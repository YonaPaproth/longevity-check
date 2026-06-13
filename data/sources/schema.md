# MikroScore Ingredient Source Schema

Single Source of Truth design for ingredient content.  
Schema version: 1.0 — Last updated: 2026-06-13

---

## Overview

Each ingredient is authored once in a YAML file under `data/sources/ingredients/<slug>.yaml`.
The generator (`data/scripts/generate-from-source.ts`) derives four output files from it:

```
data/sources/ingredients/berberine.yaml          ← EDIT THIS
        │
        ├── src/content/ingredients/berberine.mdx          (DE dossier)
        ├── src/content/en/ingredients/berberine.mdx       (EN dossier)
        ├── data/entities/ingredients/berberine.json       (KG entity)
        └── data/relations/by-entity/berberine.json        (KG relations)
```

Generated files carry this marker on line 1 and must not be edited manually:

```
<!-- Generated from data/sources/ingredients/berberine.yaml — do not edit directly -->
```

---

## YAML Top-Level Structure

```
id                    string    kebab-case slug, matches filename
type                  string    always "ingredient"
meta                  object    language-neutral frontmatter facts
efsa_notes            object    per-locale EFSA status text
key_studies           array     up to 5 studies, findings per locale
locales               object    per-locale prose (summary, evidenceSummary, body)
relations             array     KG relations for this ingredient
```

---

## Section: `meta` — Language-Neutral Facts

These fields are identical across locales. They appear in both MDX frontmatter files
and in the KG entity JSON.

| Field                       | Type    | Constraints                                              |
|-----------------------------|---------|----------------------------------------------------------|
| `title.de`                  | string  | Required                                                 |
| `title.en`                  | string  | Required                                                 |
| `aliases`                   | string[] | Trade names, alternate spellings, common search terms   |
| `category`                  | string  | `nad-precursors \| senolytics \| antioxidants \| adaptogens \| metabolic \| other` |
| `evidenceLevel`             | string  | `"1"–"5"` (1 = multiple consistent RCTs, 5 = no studies) |
| `safety_rating`             | string  | `safe \| likely-safe \| caution \| insufficient-data`   |
| `efsa_health_claims_allowed`| boolean | Whether EFSA has approved any health claims              |
| `typical_dose_mg`           | number  | Single dose in mg as used in key studies                |
| `publishedAt`               | string  | ISO date YYYY-MM-DD                                      |
| `updatedAt`                 | string  | ISO date YYYY-MM-DD                                      |

---

## Section: `efsa_notes` — Per-Locale Regulatory Text

```yaml
efsa_notes:
  de: >-
    EFSA hat keine Health Claims für Berberin zugelassen …
  en: >-
    EFSA has approved no health claims for berberine …
```

Maps to MDX frontmatter field `efsa_notes` in each locale.

---

## Section: `key_studies` — Per-Locale Study Findings

Up to 5 studies. All bibliographic metadata is language-neutral; only `finding` is per-locale.

```yaml
key_studies:
  - pmid: "19800084"
    title: "Efficacy of Berberine in Patients with Type 2 Diabetes Mellitus"
    authors: "Yin J et al."
    year: 2008
    url: "https://pubmed.ncbi.nlm.nih.gov/19800084/"
    finding:
      de: >-
        RCT (n=116): Berberin 500 mg 3x täglich senkte HbA1c um 2,0 PP …
      en: >-
        RCT (n=116): Berberine 500 mg three times daily reduced HbA1c by 2.0 PP …
```

Maps to the `key_studies` array in both MDX files. The `finding.de` / `finding.en` is
selected per locale during generation.

---

## Section: `locales` — Per-Locale Prose

```yaml
locales:
  de:
    summary: "..."        # max 200 chars — shown in ingredient cards (Zod-validated)
    evidenceSummary: "..."  # 2-4 sentence evidence header
    body: |               # Full MDX body, 900+ words
      ## Section heading
      …
  en:
    summary: "..."
    evidenceSummary: "..."
    body: |
      …
```

`summary` and `evidenceSummary` map to MDX frontmatter fields.  
`body` becomes the MDX body below the closing `---`.

**MDX escaping:** The generator replaces bare `<` with `&lt;` in all prose output to
satisfy the Astro v6 / MDX JSX parser. Write `<5 %` in the YAML; the output MDX will
have `&lt;5 %`. Do not pre-escape in the source file.

---

## Section: `relations` — Knowledge Graph Relations

All KG relations are authored here and written verbatim to
`data/relations/by-entity/<slug>.json`.

```yaml
relations:
  - relation: wird_eingesetzt_fuer   # see data/schema/relation-types.json
    target: blutzucker               # target entity ID
    direction: outgoing              # outgoing (default) | incoming
    confidence: 0.85                 # 0.0–1.0
    evidence_strength: hoch          # hoch | moderat | niedrig
    source: "pmid:19800084"          # optional citation
    note: "..."                      # max 300 chars; human-readable context
```

Valid `relation` values (from `data/schema/relation-types.json`):
- `wird_eingesetzt_fuer` — ingredient → symptom/use-case
- `wirkt_ueber` — ingredient → mechanism
- `hat_interaktion_mit` — ingredient ↔ ingredient/drug
- `kontraindiziert_bei` — ingredient → contraindication
- `hat_nebenwirkung` — ingredient → side-effect
- `benoetigt_biomarker_check` — ingredient → biomarker
- `hat_regulatorischen_status` — ingredient → regulatory entity
- `basiert_auf_studie` — ingredient → study entity

---

## Field → Output Mapping

### → KG Entity JSON (`data/entities/ingredients/<slug>.json`)

| YAML path                        | JSON field          |
|----------------------------------|---------------------|
| `id`                             | `id`                |
| `type`                           | `type`              |
| `meta.title.de`                  | `name`              |
| `locales.de.summary`             | `summary`           |
| `meta.aliases`                   | `aliases`           |
| `meta.category`                  | `category`          |
| `meta.evidenceLevel` (as int)    | `evidenceLevel`     |
| `meta.safety_rating`             | `safety`            |
| `meta.efsa_health_claims_allowed`| `efsa_approved`     |
| `meta.typical_dose_mg`           | `typical_dose_mg`   |

### → KG Relations JSON (`data/relations/by-entity/<slug>.json`)

```json
{
  "entity": "<id>",
  "relations": [ /* verbatim copy of the relations array */ ]
}
```

### → MDX Frontmatter (both locales)

| YAML path                        | MDX frontmatter field  | Note              |
|----------------------------------|------------------------|-------------------|
| `meta.title.<locale>`            | `title`                |                   |
| `id`                             | `slug`                 |                   |
| `meta.aliases`                   | `aliases`              |                   |
| `meta.category`                  | `category`             |                   |
| `locales.<locale>.summary`       | `summary`              | max 200 chars     |
| `meta.evidenceLevel`             | `evidenceLevel`        |                   |
| `locales.<locale>.evidenceSummary` | `evidenceSummary`    | MDX-escaped       |
| `meta.efsa_health_claims_allowed`| `efsa_health_claims_allowed` |             |
| `efsa_notes.<locale>`            | `efsa_notes`           | MDX-escaped       |
| `meta.safety_rating`             | `safety_rating`        |                   |
| `meta.typical_dose_mg`           | `typical_dose_mg`      | omitted if absent |
| `meta.publishedAt`               | `publishedAt`          |                   |
| `meta.updatedAt`                 | `updatedAt`            | omitted if absent |
| `key_studies[*]` (locale finding)| `key_studies`          | finding per locale|

### → MDX Body

`locales.<locale>.body` is written verbatim (after MDX escaping) below the closing `---`.

---

## Abbreviated Berberine Example

Full source: `data/sources/ingredients/berberine.yaml`

```yaml
---
id: berberine
type: ingredient

meta:
  title:
    de: Berberin
    en: Berberine
  aliases: [Berberine, Berberinhydrochlorid, Berberine HCl, Natur-Metformin]
  category: metabolic
  evidenceLevel: "2"
  safety_rating: caution
  efsa_health_claims_allowed: false
  typical_dose_mg: 500
  publishedAt: "2026-05-14"
  updatedAt: "2026-06-13"

efsa_notes:
  de: >-
    EFSA hat keine Health Claims für Berberin zugelassen. In der EU ist Berberin
    als Supplement rechtlich uneinheitlich reguliert …
  en: >-
    EFSA has approved no health claims for berberine. Across the EU, berberine
    as a supplement is regulated inconsistently …

key_studies:
  - pmid: "19800084"
    title: "Efficacy of Berberine in Patients with Type 2 Diabetes Mellitus"
    authors: "Yin J et al."
    year: 2008
    url: "https://pubmed.ncbi.nlm.nih.gov/19800084/"
    finding:
      de: >-
        RCT (n=116): Berberin 500 mg 3x täglich senkte HbA1c um 2,0 PP …
      en: >-
        RCT (n=116): Berberine 500 mg three times daily reduced HbA1c by 2.0 PP …
  # up to 4 more studies

locales:
  de:
    summary: >-
      Berberin zeigt in RCTs relevante Blutzucker- und LDL-Effekte bei Typ-2-Diabetikern.
      Erhebliche Wechselwirkungen mit Medikamenten und ungeklärter EU-Status erfordern Vorsicht.
    evidenceSummary: >-
      Mehrere RCTs und eine Meta-Analyse (14 Studien, n=1.068) belegen klinisch relevante
      Senkungen von HbA1c, Nüchternblutzucker und LDL-Cholesterin bei Typ-2-Diabetikern …
    body: |
      ## „Natur-Metformin" — Was steckt hinter dem Vergleich?
      …  # full 1000+ word dossier
  en:
    summary: >-
      Berberine shows clinically relevant blood glucose and LDL effects in RCTs for type 2
      diabetes. Significant drug interactions and unclear EU regulatory status require caution.
    evidenceSummary: >-
      Multiple RCTs and a meta-analysis (14 studies, n=1,068) document clinically relevant
      reductions in HbA1c, fasting blood glucose, and LDL-cholesterol …
    body: |
      ## "Nature's Metformin" — What Is Behind the Claim?
      …  # full 1000+ word dossier

relations:
  - relation: wird_eingesetzt_fuer
    target: blutzucker
    direction: outgoing
    confidence: 0.85
    evidence_strength: hoch
    source: "pmid:19800084"
    note: "RCT (n=116): HbA1c -2,0 PP, Nüchternblutzucker -3,5 mmol/L, vergleichbar mit Metformin"
  - relation: hat_interaktion_mit
    target: warfarin
    direction: outgoing
    confidence: 0.8
    note: "CYP2C9-Hemmung → erhöhte Antikoagulantien-Spiegel → Blutungsrisiko"
  - relation: hat_regulatorischen_status
    target: efsa-nicht-zugelassen
    direction: outgoing
    confidence: 1.0
  # … 19 more relations
---
```

---

## Adding a New Ingredient

1. Create `data/sources/ingredients/<slug>.yaml` following this schema.
2. Run: `npx tsx data/scripts/generate-from-source.ts <slug>`
3. Run: `pnpm build` to verify the Astro build passes.
4. Commit all five files together (YAML + 4 generated outputs).

Do **not** edit the generated files. Any prose or data corrections go into the YAML.

---

## Machine-Readable Schema

The formal field-type schema is at `data/schema/ingredient-source.schema.yaml`.  
TypeScript interfaces are inlined in `data/scripts/generate-from-source.ts` (lines 35–86).
