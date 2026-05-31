# MikroScore Knowledge Graph

Strukturierte Daten für alle Wirkstoffe, Mechanismen, Symptome, Biomarker und deren Relationen.

**Architektur:** File-per-entity + Relations-Index (Token-effizient für Agents)

## 📁 Struktur

```
data/
├── entities/                    # Alle Entities (168 Stück)
│   ├── ingredients/            # Wirkstoffe (110)
│   │   ├── nmn.json
│   │   ├── magnesium.json
│   │   └── ...
│   ├── mechanisms/             # Wirkmechanismen (19)
│   │   ├── nad-biosynthese.json
│   │   ├── atp-synthese.json
│   │   └── ...
│   ├── symptoms/               # Symptome/Use-Cases (23)
│   │   ├── schlaf.json
│   │   ├── energie.json
│   │   └── ...
│   ├── biomarkers/             # Biomarker (14)
│   │   ├── serum-magnesium.json
│   │   ├── nad-spiegel.json
│   │   └── ...
│   └── regulatory/             # Regulatorische Status (2)
│       ├── efsa-zugelassen.json
│       └── efsa-nicht-zugelassen.json
│
├── relations/                   # Alle Relationen (1429 Stück)
│   ├── by-entity/              # Index nach Entity (166 Files)
│   │   ├── magnesium.json      # Alle Relationen von/zu Magnesium
│   │   ├── sleep.json          # Alle Relationen von/zu Schlaf
│   │   └── ...
│   └── by-type/                # Index nach Relation-Typ (8 Files)
│       ├── wird_eingesetzt_fuer.json     (512 relations)
│       ├── wirkt_ueber.json              (126 relations)
│       ├── hat_interaktion_mit.json      (58 relations)
│       ├── kontraindiziert_bei.json      (61 relations)
│       ├── hat_nebenwirkung.json         (39 relations)
│       ├── benoetigt_biomarker_check.json (139 relations)
│       ├── hat_regulatorischen_status.json (110 relations)
│       └── basiert_auf_studie.json       (384 relations)
│
├── index.json                   # Kompakter Index (2KB)
├── schema/                      # JSON Schemas
│   ├── entity.schema.json
│   └── relation.schema.json
├── scripts/                     # Build-Scripts
│   ├── migrate-ingredients.ts   # Parse MDX → Entities + Relations
│   ├── build-index.ts           # Generiere Index + by-type Files
│   └── validate.ts              # Validierung gegen Schemas
└── README.md                    # Diese Datei
```

## 🔍 Entity-Format

**`entities/ingredients/magnesium.json`**
```json
{
  "id": "magnesium",
  "type": "ingredient",
  "name": "Magnesium",
  "aliases": ["Magnesiumglycinat", "Magnesiumcitrat"],
  "category": "metabolic",
  "evidenceLevel": 1,
  "safety": "safe",
  "efsa_approved": true,
  "typical_dose_mg": 300,
  "summary": "Essentielles Mineral, 300+ enzymatische Reaktionen."
}
```

**Typen:**
- `ingredient` — Wirkstoff/Supplement (110)
- `mechanism` — Wirkmechanismus (19)
- `symptom` — Symptom/Health Goal (23)
- `biomarker` — Biomarker/Lab-Wert (14)
- `regulatory` — Regulatorischer Status (2)

## 🔗 Relation-Format

**`relations/by-entity/magnesium.json`**
```json
{
  "entity": "magnesium",
  "relations": [
    {
      "relation": "wird_eingesetzt_fuer",
      "target": "sleep",
      "direction": "outgoing",
      "confidence": 0.9,
      "evidence_strength": "hoch",
      "source": "pmid:23853635",
      "note": "500 mg/Tag verbessert Schlafqualität..."
    },
    {
      "relation": "hat_interaktion_mit",
      "target": "zinc",
      "direction": "outgoing",
      "confidence": 0.7,
      "note": "Konkurrenz um Absorption bei hohen Dosen"
    }
  ]
}
```

**Relation-Typen:**
- `wird_eingesetzt_fuer` — Wirkstoff → Symptom (512)
- `wirkt_ueber` — Wirkstoff → Mechanismus (126)
- `hat_interaktion_mit` — Wirkstoff ↔ Wirkstoff (58)
- `kontraindiziert_bei` — Wirkstoff → Kontraindikation (61)
- `hat_nebenwirkung` — Wirkstoff → Nebenwirkung (39)
- `benoetigt_biomarker_check` — Wirkstoff → Biomarker (139)
- `hat_regulatorischen_status` — Wirkstoff → Regulatory (110)
- `basiert_auf_studie` — Wirkstoff → Studie (384)

**Direction:**
- `outgoing` — Relation startet von dieser Entity
- `incoming` — Relation zeigt auf diese Entity (für Rückwärts-Querys)

## 📊 Index-Format

**`index.json`** (2KB, kompakt)
```json
{
  "ingredients": ["nmn", "magnesium", "creatine", ...],
  "mechanisms": ["nad-biosynthese", "atp-synthese", ...],
  "biomarkers": ["serum-magnesium", "nad-spiegel", ...],
  "symptoms": ["schlaf", "energie", "kognition", ...],
  "regulatory": ["efsa-zugelassen", "efsa-nicht-zugelassen"],
  "stats": {
    "entities": 168,
    "relations": 1429,
    "relationTypes": 8,
    "lastUpdated": "2026-05-31"
  }
}
```

## 🚀 Nutzung in Astro

```ts
import { getKG } from '@/utils/knowledge-graph';

const kg = getKG();

// Entity laden
const magnesium = kg.entity('magnesium');

// Relationen abfragen
const sleepCases = kg.usesFor('magnesium');
const mechanisms = kg.mechanisms('magnesium');
const interactions = kg.interactions('magnesium');
const biomarkers = kg.biomarkers('magnesium');

// Umgekehrte Queries
const ingredientsForSleep = kg.ingredientsForSymptom('sleep');

// Alle Daten
const allIngredients = kg.allIngredients();
const allSymptoms = kg.allSymptoms();

// Relationen nach Typ
const allUses = kg.relationsByType('wird_eingesetzt_fuer');
```

## 🔄 Aktualisierung

### Neue Entities hinzufügen

1. Erstelle `src/content/ingredients/<slug>.mdx` wie gewohnt
2. Führe aus: `npx tsx data/scripts/migrate-ingredients.ts`
3. Führe aus: `npx tsx data/scripts/build-index.ts`

### Relationen manuell bearbeiten

Editiere direkt die `.json` Files in `data/relations/by-entity/`:

```json
{
  "entity": "magnesium",
  "relations": [
    // add/edit/remove relations here
  ]
}
```

Dann: `npx tsx data/scripts/build-index.ts` (um `by-type/` zu regenerieren)

## 🤖 Für Agents

**Token-Effizienz:**
- Read entity: ~500 Tokens (kleine JSON)
- Query "all ingredients for sleep": ~2000 Tokens (by-type/wird_eingesetzt_fuer.json)
- Full graph rebuild: ~80.000 Tokens (rebuild-Scripts)

**MCP Server (Zukunft):**
```
Agent: "Welche Supplements helfen bei Schlaf?"
→ MCP query: query('symptom=sleep', 'relation=wird_eingesetzt_fuer')
→ Antwort: [magnesium, melatonin, l-theanin, ...]
```

## 📋 Statistiken

- **110 Ingredients** gemigriert aus bestehendem Content
- **2264 Relationen** aus Frontmatter + Body-Text automatisch extrahiert
- **58 Auto-Created Entities** (Mechanisms, Symptoms, Biomarkers)
- **Keine manuellen Edits nötig** für Initial-Setup

## ✅ Next Steps

1. **Astro Pages** — Generiere Relations-Seiten (z.B. `/supplements/sleep` zeigt alle Wirkstoffe)
2. **Interaktions-Checker** — "Welche Wechselwirkungen hat diese Kombination?"
3. **Agent MCP Server** — Expose Graph als Tool für externe Agents
4. **Continuous Integration** — Validates on every change + auto-rebuilds

---

Generated: 2026-05-31 | Schema v1.0
