# Research Cache Layer — Plan

Stand: 2026-05-30

## Problem

Dossier-Updates sind aktuell ad hoc, unstrukturiert und verlieren den Forschungsstand. Kein systematischer Weg um neue Studien zu verfolgen und gezielt zu updaten.

---

## Konzept: Strukturierte Zwischenschicht

```
PubMed / EFSA / ClinicalTrials
         ↓
  research-cache/{slug}.json    ← strukturiert, versioniert
         ↓
  Dossier-Update via Prompt
```

---

## JSON-Schema pro Wirkstoff

```json
// research-cache/omega-3.json
{
  "slug": "omega-3",
  "lastReviewed": "2026-05-30",
  "reviewer": "dobby-ai",
  "evidenceSummary": {
    "level": 1,
    "lastUpdated": "2026-05-30",
    "headline": "Starke Evidenz für kardiovaskuläre Effekte bei ≥1g EPA+DHA/Tag"
  },
  "keyFindings": [
    {
      "claim": "Reduktion Triglyzeride",
      "effectSize": "−15 bis −30% bei 3–4g/Tag",
      "quality": "meta-analysis",
      "pmid": "28829415",
      "year": 2017,
      "confirmed": true
    }
  ],
  "openQuestions": [
    "Langzeiteffekte bei jungen gesunden Erwachsenen unklar"
  ],
  "efsaStatus": {
    "claimsAllowed": false,
    "notes": "Kein zugelassener Health Claim für EPA/DHA bei Supplementen"
  },
  "newStudies": [],
  "flaggedForUpdate": false
}
```

---

## Umsetzungsstufen

### Stufe 1 — Snapshot (1 Tag Aufwand)
- `research-cache/` Ordner anlegen
- Skript schreibt für alle bestehenden Dossiers je ein `{slug}.json`
- Felder aus vorhandenem Frontmatter (key_studies, evidenceLevel, evidenceSummary, efsaStatus)
- Gibt sofort: Snapshot des aktuellen Wissensstands + Basis für Vergleich

### Stufe 2 — PubMed-Integration (1 Woche)
- `pubmed-digest.js` erweitern: neue Studien landen direkt im Cache statt nur im Telegram-Text
- Wenn neue relevante Studie gefunden → `newStudies` Array updaten + `flaggedForUpdate: true`

### Stufe 3 — Automatischer Update-Trigger (2+ Wochen)
- Wöchentlicher Cron prüft: `flaggedForUpdate === true` UND Cache neuer als Dossier `updatedAt`
- Spawnt Rewrite-Agent mit Cache als Kontext
- Nach Rewrite: `flaggedForUpdate: false`, `lastReviewed` aktualisiert

---

## Vorteile

- **Versionierbar:** Git trackt Wissensstand pro Wirkstoff über Zeit
- **Audit-fähig:** Klar nachvollziehbar warum ein Dossier wann geupdatet wurde
- **Effizienz:** Update-Prompts bekommen strukturierten Kontext statt rohem PubMed-Text
- **Skalierbar:** Gilt für alle 110+ Dossiers ohne manuelle Arbeit

---

## Nächste Schritte wenn bereit

1. Schema finalisieren (JSON-Datei)
2. `scripts/build-research-cache.cjs` schreiben → liest alle MDX, schreibt JSON
3. `pubmed-digest.js` um Cache-Update erweitern
4. Cron-Job für wöchentlichen Update-Check

---

## Abhängigkeiten

- Bestehendes `scripts/pubmed-digest.js` (EFSA + ClinicalTrials bereits integriert)
- Bestehendes `scripts/audit-dossiers.cjs` (Qualitätsscore-Logik)
- `src/content/ingredients/*.mdx` (110+ Dossiers)
