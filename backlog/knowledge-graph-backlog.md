# Knowledge Graph — Backlog (2026-07-18)

Basierend auf dem KG-Audit: 903 Entities, 1929 Relations (2782 inkl. Bidirectional).

## Ist-Zustand

| Kriterium | Status | Details |
|-----------|--------|---------|
| Kanten-Quellen | ⚠️ 14% | Nur `basiert_auf_studie` hat PMIDs (416/2782) |
| Evidenz-Differenzierung | ⚠️ implizit | Kein `evidence_level` auf Relations |
| Population/Dosis/Dauer/Endpunkt | ❌ 0% | Kein Relation hat klinische Metadaten |
| Widersprüchliche Studien | ✅ teilweise | 19 Ingredients mit gemischten Findings, kein `contradicts`-Type |
| Versionierung | ❌ 0% | Kein `updatedAt` auf KG Entities |
| API / Structured Access | ✅ | 5 JSON-Endpunkte (graph, wirkstoffe, products, claims) |

---

## Backlog Items

### B1 — `source` für alle Relation-Types
**Problem:** Nur `basiert_auf_studie` (416 Relations) hat Quellen-Angaben. Die Mehrheit (wird_eingesetzt_fuer, wirkt_ueber, benoetigt_biomarker_check, etc.) hat keine Herkunft.
**Lösung:** `source`-Feld auf allen Relations befüllen. Mögliche Werte: `pmid:XXXXX`, `efsa-register`, `expert-review`, `ingredient-yaml`.
**Aufwand:** Mittel — Generator anpassen + YAMLs ergänzen
**Impact:** Hoch (Trust + Traceability)

### B2 — `evidence_level` auf Relations
**Problem:** Keine Unterscheidung zwischen experimentellem Mechanismus (in vitro, Tiermodell) und belegtem klinischem Effekt (Human RCT, Meta-Analyse).
**Lösung:** Neues Feld `evidence_level` auf Relations: `in_vitro` | `animal` | `human_observational` | `human_rct` | `meta_analysis`. Kann teilweise aus `study_type` der verlinkten Studien abgeleitet werden.
**Aufwand:** Mittel — Schema + Generator + schrittweise befüllen
**Impact:** Hoch (Kernfeature für Agenten)

### B3 — Relation-Metadaten: dose, duration, population, endpoint
**Problem:** 0 von 2782 Relations haben klinische Kontext-Daten. Agenten können nicht beantworten "bei welcher Dosis, über welchen Zeitraum, bei welcher Population wurde der Effekt beobachtet?"
**Lösung:** Schema erweitern um optionale Felder: `dose_mg`, `duration_weeks`, `population` (z.B. "healthy adults", "T2DM patients"), `endpoint` (z.B. "HbA1c", "systolic BP"). Befüllung schrittweise bei wichtigsten Relations.
**Aufwand:** Hoch — Schema-Redesign + manuelle Datenpflege
**Impact:** Sehr hoch (differenziert uns von jedem anderen Supplement-KG)

### B4 — `contradicts` Relation-Type
**Problem:** 19 Ingredients haben widersprüchliche Studien-Findings, aber das ist nur implizit im Finding-Text sichtbar. Kein expliziter Relation-Type für Kontroversen.
**Lösung:** Neuer Relation-Type `contradicts` zwischen zwei Study-Nodes. Beispiel: Studie A zeigt Vitamin D reduziert Krebs, Studie B zeigt keinen Effekt → `studie-A contradicts studie-B`.
**Aufwand:** Niedrig — neuer Type + manuelle Identifikation der Top-20 Kontroversen
**Impact:** Mittel (wichtig für Seriosität)

### B5 — `updatedAt` auf allen KG Entities
**Problem:** Kein Entity hat einen Timestamp. Agenten können nicht wissen, ob die Daten aktuell sind.
**Lösung:** `generate-from-source.ts` und `generate-products.ts` setzen automatisch `updatedAt: <ISO-Date>` bei jeder Generierung.
**Aufwand:** Niedrig — 2 Generator-Scripts anpassen
**Impact:** Mittel (Frische-Signal)

### B6 — API-Versionierung
**Problem:** JSON-Endpunkte haben keine Versionsnummer. Breaking Changes wären nicht erkennbar.
**Lösung:** `schema_version` Feld in allen JSON-Responses. Optional: `/data/v1/` Prefix für zukünftige Versionen.
**Aufwand:** Niedrig — JSON-Templates anpassen
**Impact:** Niedrig (nice-to-have)

---

## Priorisierung

```
Sofort:     B5 (updatedAt) + B4 (contradicts) — klein, schnell
Q3 2026:    B1 (source) + B2 (evidence_level) — Kernfeatures
Q4 2026:    B3 (klinische Metadaten) — größtes Unterfangen, braucht Design-Phase
Später:     B6 (API-Versionierung)
```
