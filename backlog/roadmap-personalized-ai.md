# MikroScore → Personalized AI Supplement Engine

## Vision
MikroScore wird die datengetriebene Basis für personalisierte Supplement-Empfehlungen.
Nicht "nimm das", sondern "basierend auf deinem Profil, deinen Biomarkern und der aktuellen Evidenzlage, hier ist was Sinn macht — und hier die Produkte, sortiert nach Preis und Qualität."

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  USER LAYER                     │
│  Profile · Biomarkers · Goals · Interactions    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              RECOMMENDATION ENGINE              │
│  Personalized scoring · Contraindication check  │
│  Dosage optimization · Stack optimization       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│          KNOWLEDGE GRAPH (Layer 1)              │
│  Ingredients · Conditions · Mechanisms ·        │
│  Biomarkers · Interactions · Regulations        │
└──────────┬───────────┬──────────────────────────┘
           │           │
┌──────────▼───┐ ┌─────▼──────────────────────────┐
│ EVIDENCE     │ │ PRODUCT GRAPH (Layer 3)         │
│ ENGINE (L2)  │ │ Products · Brands · Pricing ·   │
│ Studies ·    │ │ Availability · Certifications · │
│ Scores ·    │ │ Lab Testing · Extract Types      │
│ Conflicts   │ │                                  │
└──────────────┘ └─────────────────────────────────┘
```

---

## Phase 1: Foundation (Wochen 1–3)
**Ziel:** Ontologie sauber, Evidence Engine differenziert, Daten-Pipeline steht

### 1.1 Ontology Upgrade
- [ ] **Conditions/Benefits als First-Class Entities**
  - Eigenes Schema: `data/entities/conditions/<slug>.json`
  - Felder: id, name_de, name_en, category (metabolic/cognitive/cardiovascular/immune/longevity/skin/joint/hormonal), icd10_code (optional), description
  - Migriere die 46 impliziten Symptom-Targets zu echten Entities
  - Aufwand: ~2h, kein LLM nötig

- [ ] **Brand Entity**
  - `data/entities/brands/<slug>.json`
  - Felder: id, name, country, website, certifications[], gmp_certified, lab_tested, founded_year, description_de, description_en
  - Verknüpfe alle Produkte via Brand-Slug statt Vendor-String
  - Aufwand: ~1h

- [ ] **Mechanism Entity aufwerten**
  - Die 19 existierenden Mechanismen (wirkt_ueber) um Beschreibungen erweitern
  - Pathway-Links (AMPK, mTOR, NRF2, Sirtuins, etc.)
  - Aufwand: ~1h

### 1.2 Evidence Engine v1
- [ ] **Study Entity als First-Class**
  - Schema: `data/entities/studies/<pmid>.json`
  - Felder: pmid, doi, title, authors, journal, year, study_type (rct|meta_analysis|cohort|case_control|in_vitro|review|umbrella_review), sample_size, duration_weeks, population, findings_de, findings_en, quality_score (1-5), effect_size, p_value, conflicts_of_interest
  - Aufwand: Schema ~30min, Befüllung über PubMed-API automatisierbar

- [ ] **Differenzierte Confidence Scores**
  - Ersetze das uniforme 0.7 durch berechnete Scores:
    ```
    confidence = f(study_count, study_type_weights, sample_sizes, consistency, recency)
    ```
  - Weights: umbrella_review=1.0, meta=0.9, rct=0.7, cohort=0.5, in_vitro=0.3
  - Script das pro Relation den Score aus verknüpften Studies berechnet
  - Aufwand: ~3h

- [ ] **Contradictory Findings Flag**
  - Pro Ingredient-Condition-Pair: wenn Studies in entgegengesetzte Richtungen zeigen
  - Feld: `contradictory: true/false`, `contradiction_note`
  - Aufwand: ~1h Implementierung, ~4h Review

### 1.3 PubMed-Digest → Knowledge Graph Pipeline
- [ ] **Auto-Update key_studies aus Weekly Digest**
  - pubmed-digest.js schreibt neue relevante PMIDs in `data/pending-studies/`
  - Review-Script erstellt Study-Entities und verknüpft mit Ingredients
  - Human-in-the-loop: Batch-Approval neuer Studien
  - Aufwand: ~4h

---

## Phase 2: Product Intelligence (Wochen 3–5)
**Ziel:** Automatisierte Produktdaten, echte Vergleichbarkeit

### 2.1 iHerb Scraper
- [ ] **iHerb Product Scraper**
  - Technisch: Playwright/Puppeteer headless browser
  - Daten: Preis, Dosierung, Form, Zutaten-Liste, Zertifizierungen, Bewertungen
  - Rate-limiting: max 1 req/5s, rotierender User-Agent
  - Output: `data/scraped/iherb/<product-id>.json`
  - Aufwand: ~6h (inkl. Anti-Bot-Handling)

- [ ] **Ingredient-Parsing aus Zutatenlisten**
  - NLP/Regex-Pipeline: "Vitamin D3 (as cholecalciferol) 50 mcg" → `{slug: "vitamin-d3", dose_mcg: 50, form: "cholecalciferol"}`
  - Mapping-Table: Rohstoffnamen → unsere 112 Slugs
  - Aufwand: ~4h (Haiku-assisted)

- [ ] **Preis-Monitoring Cron**
  - Wöchentlicher Preis-Check aller gelisteten Produkte
  - Preis-History: `data/price-history/<product-slug>.json`
  - Alert bei >15% Preisänderung
  - Aufwand: ~3h

### 2.2 Product Schema Upgrade
- [ ] **Extract Types als strukturierte Daten**
  - `extractType: "KSM-66"` / `"Longvida"` / `"Meriva"` / `"Creapure"`
  - Verknüpfung: Extract → Bioverfügbarkeits-Multiplikator
  - Aufwand: ~2h

- [ ] **Lab-Testing Scores**
  - Felder: heavy_metals_tested, microbial_tested, potency_verified, third_party_lab
  - Optional: Labdoor/ConsumerLab-Daten wo verfügbar
  - Aufwand: ~2h

- [ ] **EU Regulatory Status pro Produkt**
  - novel_food_status: approved | pending | not_applicable
  - max_daily_dose_eu: mg
  - health_claims_allowed: boolean
  - Aufwand: ~3h (EFSA-Daten parsen)

---

## Phase 3: Personalization Engine (Wochen 5–8)
**Ziel:** User-Profile, personalisierte Empfehlungen

### 3.1 Database Migration
- [ ] **SQLite/Turso für dynamische Daten**
  - User-Profiles, Biomarker-History, Saved Stacks
  - Statische Daten (Ingredients, Studies) bleiben in YAML/JSON → Compile-to-DB bei Build
  - Aufwand: ~6h

### 3.2 User Profile Schema
```typescript
interface UserProfile {
  id: string;
  diet: 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';
  age_bracket: '18-30' | '31-45' | '46-60' | '60+';
  sex: 'male' | 'female';
  goals: string[];        // slugs aus conditions: ['kognition', 'schlaf', 'herz-kreislauf']
  conditions: string[];   // diagnostizierte Bedingungen
  medications: string[];  // für Interaktions-Check
  biomarkers?: {
    vitamin_d_ngml?: number;
    ferritin_ngml?: number;
    omega3_index?: number;
    homocysteine?: number;
    // ...erweiterbar
  };
  budget_eur_per_month?: number;
  preferred_form?: 'capsule' | 'powder' | 'liquid' | 'any';
  country: 'DE' | 'AT' | 'CH' | 'EU';
}
```

### 3.3 Recommendation Algorithm
```
Score(ingredient, user) =
  evidence_score(ingredient, user.goals)
  × relevance(ingredient, user.diet, user.age)
  × safety(ingredient, user.medications)  // 0 if contraindicated
  × deficiency_risk(ingredient, user.biomarkers)
  × regulatory_ok(ingredient, user.country)
```

- [ ] **Implementierung als Edge Function (Vercel)**
  - Input: UserProfile JSON
  - Output: Ranked list of ingredients + optimal product stack
  - Aufwand: ~8h

### 3.4 Personalized Stack Builder v2
- [ ] **User-spezifische Optimierung**
  - Stack Builder berücksichtigt: Budget, Interaktionen, Bioverfügbarkeit, Ziele
  - "Du brauchst wahrscheinlich X weil..." (Begründung aus Evidence Engine)
  - Aufwand: ~6h UI + ~4h Backend

---

## Phase 4: Scale (Wochen 8–12)
**Ziel:** Wachstum, API, Partnerschaften

### 4.1 API
- [ ] **Public REST API**
  - `/api/v1/ingredients` — Alle Wirkstoffe mit Evidence Scores
  - `/api/v1/recommend` — Personalisierte Empfehlung
  - `/api/v1/interactions` — Interaktions-Check
  - `/api/v1/products/compare` — Produktvergleich
  - Rate-limited, API-Key, Free Tier
  - Aufwand: ~8h

### 4.2 Amazon DE Integration
- [ ] **Amazon Product API (PA-API 5.0)**
  - Affiliate-Links mit Tracking
  - Echtzeit-Preise
  - Aufwand: ~4h (API-Zugang beantragen, Integration)

### 4.3 AI Chat Interface
- [ ] **"Ask MikroScore" Chat**
  - RAG über den Knowledge Graph
  - User fragt: "Ich bin 45, vegan, schlafe schlecht — was soll ich nehmen?"
  - AI antwortet mit evidenzbasierten Empfehlungen + Produktlinks
  - Aufwand: ~12h

---

## Token-Budget Schätzung

| Phase | Geschätzter Token-Cost |
|-------|----------------------|
| Phase 1 (Ontology + Evidence) | ~$3-5 (Haiku für Study-Parsing) |
| Phase 2 (iHerb Scraper) | ~$2 (Ingredient-Parsing) |
| Phase 3 (Personalization) | ~$5-10 (Algorithmus-Entwicklung) |
| Phase 4 (API + Chat) | ~$10-15 (RAG Setup) |
| **Gesamt** | **~$20-30** |

---

## Prioritäten-Matrix

```
                    Impact
                    HIGH
                     │
   Evidence Engine   │   Personalization
   (differenzierte   │   Engine
    Scores)          │   (User Profiles)
                     │
  ───────────────────┼───────────────────
                     │
   Ontology Cleanup  │   iHerb Scraper
   (Conditions,      │   (Produkt-Pipeline)
    Brands)          │
                     │
                    LOW
         LOW ────────┼──────── HIGH
                   Effort
```

**Empfohlene Reihenfolge:**
1. Ontology Cleanup (low effort, foundational)
2. Evidence Engine v1 (medium effort, high impact)
3. iHerb Scraper (medium effort, enables scale)
4. Personalization (high effort, killer feature)

---

## Sofort umsetzbar (nächste Session)

1. ✅ Conditions als First-Class Entities migrieren
2. ✅ Brand Entity erstellen (BIOGENA, Sunday Natural, etc.)
3. ✅ Study-Type-Feld zu key_studies hinzufügen
4. ✅ Confidence Scores differenzieren (statt 0.7 überall)
