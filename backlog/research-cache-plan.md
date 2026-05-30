# Research Cache Layer — Plan v3

Stand: 2026-05-30

## Zielbild

Mikroscore soll langfristig **wissenschaftlich saubere, nachvollziehbare und hochwertige Wirkstoff-Dossiers** pflegen, um über Zeit **Vertrauen, fachliche Substanz und stabile SEO-Signale** aufzubauen.

Nicht schnelle Klicks, sondern belastbarer Content.

Dafür entsteht eine strukturierte Forschungsschicht zwischen Rohquellen und Website-Text.

**Architekturentscheidung:**
- `src/content/ingredients/*.mdx` bleibt das **publizierte redaktionelle Endprodukt**
- `research-cache/{slug}.json` wird die **maschinenfreundliche, strukturierte Wissensbasis**
- Rewrites erfolgen **nur mit Review-Kette**:
  1. Rewrite-Agent
  2. Review-Agent / PR-Review
  3. menschlicher Final-Check bei wichtigen Dossiers

---

## Problem heute

Dossier-Updates sind aktuell oft ad hoc:
- Forschungsstand wird nicht systematisch konserviert
- Wissen verschwindet in Fließtexten, Chats oder Einmal-Prompts
- neue Studien sind schwer gegen den bisherigen Stand vergleichbar
- Rewrites verbrauchen unnötig viele Tokens, weil Recherche immer wieder neu aufgebaut wird
- Auditierbarkeit fehlt: Warum wurde ein Dossier wann geändert?

---

## Architektur

```text
PubMed / EFSA / ClinicalTrials / weitere Quellen
                  ↓
        research-cache/{slug}.json
     (maschinenfreundliche Wissensbasis)
                  ↓
        Triage / Rewrite-Entscheidung
                  ↓
           Rewrite-Agent erstellt Diff
                  ↓
         Review-Agent / Git PR Review
                  ↓
     Menschlicher Final-Check (selektiv)
                  ↓
      Dossier-Update in src/content/ingredients/*.mdx
```

---

## Leitprinzipien

### 1) Hybrid-Modell

- **Dossier** = öffentliche, redaktionelle Wahrheit
- **Research Cache** = interne, strukturierte Forschungswahrheit
- Dossiers werden **aus dem Cache informiert**, aber nicht rein mechanisch aus JSON generiert

### 2) Möglichst vollständig, aber qualifiziert

Der Cache soll **möglichst vollständig** sein — aber nicht im Sinn von „alles speichern, was irgendwie existiert“.

Erfasst werden **qualifizierte, fachlich relevante Studien** mit klaren Prioritätsregeln.

### 3) Maschinenfreundlichkeit vor Handpflege

Der Cache soll primär:
- stabil parsebar
- diffbar
- normalisiert
- skriptfreundlich
- promptfreundlich extrahierbar

sein.

Manuelle Bearbeitung bleibt möglich, aber das Format wird **für Automatisierung optimiert**, nicht für freie Notizpflege.

### 4) Review statt Auto-Livegang

Neue Evidenz löst **nicht direkt** Live-Content aus.

Stattdessen:
1. Cache wird aktualisiert
2. Triage bewertet Relevanz
3. Rewrite-Agent erstellt Vorschlag
4. Review-Agent / PR-Review prüft Änderungen
5. Mensch prüft kritische / wichtige Fälle final
6. Erst dann Merge / Livegang

### 5) Tokenfreundlichkeit durch strukturierte Evidenz

Rewrites sollen auf Basis von:
- altem Dossier
- strukturiertem Cache-Auszug
- `newEvidence`
- Regulatory-Daten

laufen — nicht jedes Mal auf Basis roher Recherche-Ergebnisse.

---

## Quellen- und Studienpolitik

## Welche Studien sollen erfasst werden?

### Priorität A — immer erfassen
- Meta-Analysen
- Systematic Reviews
- große Human-RCTs
- hochwertige Leitlinien / Positionspapiere, wenn fachlich relevant

### Priorität B — in der Regel erfassen
- kleinere Human-RCTs
- prospektive Beobachtungsstudien
- mechanistisch relevante Humanstudien

### Priorität C — selektiv erfassen
- Tierstudien
- In-vitro-Studien
- sehr kleine Pilotstudien

### Regel für Tier/In-vitro
Tier- und In-vitro-Daten dürfen in den Cache, aber:
- nur selektiv
- klar markiert
- nicht gleichrangig mit Human-Evidenz
- prominent nur dann, wenn Human-Evidenz schwach, uneinheitlich oder lückenhaft ist

---

## Zielstruktur im Dateisystem

```text
research-cache/
  index.json
  omega-3.json
  vitamin-d3.json
  magnesium.json
  ...
```

Optional später:

```text
research-cache-history/
  omega-3/
    2026-05-30.json
    2026-06-15.json
```

Für den Start reicht Git-Historie. Ein separates History-Layer ist optional.

---

## JSON-Schema pro Wirkstoff

```json
{
  "slug": "omega-3",
  "cacheVersion": 1,
  "status": "active",
  "reviewStatus": "reviewed",
  "createdAt": "2026-05-30",
  "updatedAt": "2026-05-30",
  "lastReviewed": "2026-05-30",
  "reviewer": "dobby-ai",
  "lastSearchDate": "2026-05-30",
  "priority": {
    "seo": "high",
    "business": "medium",
    "contentQuality": "high"
  },
  "search": {
    "pubmedQuery": "(omega-3 OR EPA OR DHA) AND humans",
    "clinicalTrialsQuery": "omega-3",
    "sourcePolicy": {
      "includeMetaAnalyses": true,
      "includeSystematicReviews": true,
      "includeHumanRCTs": true,
      "includeObservational": true,
      "includeAnimalSelective": true,
      "includeInVitroSelective": true
    },
    "notes": "Human evidence first; animal/in-vitro only selectively"
  },
  "dossier": {
    "path": "src/content/ingredients/omega-3.mdx",
    "title": "Omega-3",
    "updatedAt": "2026-05-26",
    "auditScore": 100
  },
  "evidenceSummary": {
    "level": 1,
    "confidence": "high",
    "headline": "Gute Evidenz für Triglyzerid-Senkung; gemischte Evidenz für harte Endpunkte",
    "updatedAt": "2026-05-30"
  },
  "keyFindings": [
    {
      "id": "pmid-28829415-triglycerides",
      "claim": "Omega-3 senkt Triglyzeride",
      "population": "Erwachsene mit erhöhten Triglyzeriden",
      "intervention": "3-4 g EPA/DHA pro Tag",
      "comparator": "Placebo oder Standardversorgung",
      "effectSize": "-15 bis -30%",
      "studyType": "meta-analysis",
      "sourceType": "PubMed",
      "pmid": "28829415",
      "year": 2017,
      "quality": "high",
      "riskOfBias": "moderate",
      "confidence": "high",
      "evidenceDomain": "human",
      "includedInDossier": true,
      "notes": "Nicht direkt auf harte klinische Endpunkte übertragbar"
    }
  ],
  "studyFeed": [
    {
      "id": "pmid-28829415",
      "sourceType": "PubMed",
      "pmid": "28829415",
      "doi": null,
      "title": "...",
      "year": 2017,
      "studyType": "meta-analysis",
      "evidenceDomain": "human",
      "population": "...",
      "intervention": "...",
      "comparator": "...",
      "outcomes": ["Triglyzeride"],
      "effectSummary": "Triglyzeride sinken unter 3-4 g EPA/DHA pro Tag deutlich",
      "summary": "Kurzzusammenfassung in eigenen Worten",
      "quality": "high",
      "riskOfBias": "moderate",
      "relevance": "high",
      "status": "included",
      "detectedAt": "2026-05-30",
      "reviewedAt": "2026-05-30"
    }
  ],
  "newEvidence": [
    {
      "id": "pmid-12345678",
      "sourceType": "PubMed",
      "detectedAt": "2026-06-12",
      "reason": "Neue Meta-Analyse mit potenziell relevanter Änderung bei Effektgrößen",
      "severity": "medium",
      "status": "pending-review",
      "linkedStudyIds": ["pmid-12345678"]
    }
  ],
  "openQuestions": [
    "Langzeiteffekte bei jungen gesunden Erwachsenen bleiben unklar"
  ],
  "regulatory": {
    "efsaCheckedAt": "2026-05-30",
    "approvedClaims": [],
    "rejectedClaims": [],
    "wordingConstraints": [
      "Keine krankheitsbezogenen Heil- oder Präventionsclaims formulieren"
    ],
    "notes": "Regulatorische Lage getrennt von wissenschaftlicher Evidenz pflegen"
  },
  "triage": {
    "needsReview": false,
    "flaggedForRewrite": false,
    "rewriteReason": "",
    "evidenceChangeSeverity": "medium",
    "reviewPriority": "high"
  }
}
```

---

## Warum dieses Schema?

### `keyFindings`
- klein, kuratiert, prompt-tauglich
- trägt die Kernaussagen des Dossiers
- ideal für Rewrite-Agenten

### `studyFeed`
- breiter, möglichst vollständiger Forschungsfeed
- dient als langfristiges Gedächtnis
- hält auch qualifizierte Studien, die nicht sofort ins Dossier wandern

### `newEvidence`
- trennt neue Signale vom Bestand
- gut für Diffs, Review und Trigger

### `regulatory`
- hält Evidenz und Claim-Lage sauber auseinander

### `triage`
- verhindert Rewrite-Spam
- steuert Review- und Rewrite-Reihenfolge

---

## Maschinenfreundliche Designregeln

Damit der Cache stabil bleibt:

- feste Feldnamen
- möglichst flache, vorhersehbare Struktur
- keine großen Freitextblöcke
- keine kopierten Vollabstracts
- Datumsfelder ISO-Format
- IDs deterministisch, wo möglich (`pmid-*`, `doi-*`, Slug-basierte IDs)
- Enumerationen für Statusfelder

### Empfohlene Enums

#### `reviewStatus`
- `bootstrap`
- `reviewed`
- `needs-human-review`

#### `studyFeed[].status`
- `candidate`
- `reviewed`
- `included`
- `excluded`
- `superseded`

#### `newEvidence[].status`
- `pending-review`
- `reviewed-no-action`
- `rewrite-needed`
- `incorporated`

#### `evidenceDomain`
- `human`
- `animal`
- `in-vitro`
- `guideline`

#### `quality`, `confidence`, `relevance`, `severity`, `reviewPriority`
- `low`
- `medium`
- `high`

---

## `index.json`-Schema

Neben den Einzeldateien braucht es eine schnelle Übersicht.

```json
{
  "cacheVersion": 1,
  "generatedAt": "2026-05-30",
  "totalSlugs": 110,
  "items": [
    {
      "slug": "omega-3",
      "title": "Omega-3",
      "reviewStatus": "reviewed",
      "lastReviewed": "2026-05-30",
      "lastSearchDate": "2026-05-30",
      "auditScore": 100,
      "evidenceLevel": 1,
      "seoPriority": "high",
      "needsReview": false,
      "flaggedForRewrite": false,
      "evidenceChangeSeverity": "medium",
      "reviewPriority": "high"
    }
  ]
}
```

## Zweck von `index.json`

- schnelle Übersicht ohne 110 Dateien einzeln zu lesen
- ideal für Cron, Triage und Dashboarding
- gute Basis für "welche Slugs sind dran?"

---

## Rewrite- und Review-Kette

## Empfohlener Workflow

### Stufe A — Refresh
Ein Skript aktualisiert den Cache aus Quellen.

### Stufe B — Triage
Es bewertet:
- ist die neue Evidenz relevant?
- braucht der Wirkstoff Review?
- ist ein Rewrite sinnvoll?

### Stufe C — Rewrite-Agent
Er bekommt:
- bestehendes MDX
- `research-cache/{slug}.json`
- nur relevante `newEvidence`
- klare Schreib- und Claim-Regeln

### Stufe D — Review-Agent / Git PR Review
Prüft:
- wissenschaftliche Treue
- Übergewichtung einzelner Studien
- Claim-Sicherheit
- Tonalität / redaktionelle Qualität
- saubere Limitierungen

### Stufe E — Menschlicher Final-Check
Vor allem bei:
- High-priority-SEO-Themen
- sensiblen gesundheitsbezogenen Themen
- größeren inhaltlichen Richtungswechseln

---

## Rewrite-Trigger-Regeln

Ein Rewrite soll **nicht** schon bei jeder neuen Studie loslaufen.

### Rewrite eher ja bei:
- neuer Meta-Analyse oder Systematic Review mit relevanter inhaltlicher Verschiebung
- starker neuer Human-RCT mit praktischer Relevanz
- bisherige Kernaussage muss abgeschwächt, differenziert oder korrigiert werden
- neue Regulatory-Information beeinflusst Claim-Sicherheit
- Dossier ist qualitativ schwach und neue Evidenz rechtfertigt Überarbeitung

### Rewrite eher nein bei:
- kleiner isolierter Bestätigungsstudie ohne praktische Änderung
- zusätzlicher Tier-/In-vitro-Studie ohne Einfluss auf Kernaussage
- Minimaländerungen ohne redaktionellen Mehrwert

---

## Tokenfreundliche Prompt-Strategie

### Rewrite-Prompt bekommt nur:
- aktuelles Dossier
- `keyFindings`
- relevante Teile aus `studyFeed`
- `newEvidence`
- `regulatory`
- klare Rewrite-Regeln

### Nicht standardmäßig mitgeben:
- kompletten `studyFeed`
- große Abstract-Sammlungen
- irrelevante Quellenhistorie

### Grundregel
Der Cache darf breit sein.
Der Prompt bleibt selektiv.

So bekommst du:
- Vollständigkeit im System
- geringe Prompt-Kosten
- stabile Outputs

---

## Umsetzungsphasen

## Phase 1 — Schema festziehen

**Ziel:** Das Datenmodell sauber finalisieren.

### Aufgaben
- Feldnamen finalisieren
- Enums festlegen
- `index.json` definieren
- Beispiel-JSONs für 2–3 Slugs bauen

**Ergebnis:** belastbare Spezifikation

**Aufwand:** 0.5–1 Tag

---

## Phase 2 — Bootstrap-Cache bauen

**Ziel:** Aus bestehenden Dossiers einen initialen Cache erzeugen.

### Aufgaben
- `research-cache/` anlegen
- `scripts/build-research-cache.cjs` erstellen
- pro MDX ein `{slug}.json` erzeugen
- aus Frontmatter / Body extrahieren:
  - Titel
  - `updatedAt`
  - `evidenceLevel`
  - `evidenceSummary`
  - `key_studies`
  - vorhandene EFSA-Hinweise
- `index.json` generieren

### Wichtiger Hinweis
Das ist ein **Bootstrap-Zustand**, kein perfekter Forschungsfeed.

**Aufwand:** 1–2 Tage

---

## Phase 3 — Refresh-Layer für neue Evidenz

**Ziel:** Neue Evidenz strukturiert in den Cache schreiben.

### Aufgaben
- `scripts/pubmed-digest.js` erweitern oder neues `scripts/refresh-research-cache.cjs`
- neue Studien in `studyFeed` aufnehmen
- Dedupe-Logik für PMID / DOI / ID
- `newEvidence` erzeugen
- `triage.needsReview` setzen
- `lastSearchDate` pflegen

**Ergebnis:** neue Evidenz verschwindet nicht mehr im Chat

**Aufwand:** ~1 Woche

---

## Phase 4 — Triage-Logik

**Ziel:** Nur relevante Änderungen lösen Arbeit aus.

### Aufgaben
- Regeln für `evidenceChangeSeverity`
- Regeln für `flaggedForRewrite`
- Priorisierungslogik aus:
  - SEO-Priorität
  - Business-Priorität
  - Audit-Score
  - Evidenzänderung

**Ergebnis:** brauchbare Rewrite-Queue

**Aufwand:** 2–4 Tage

---

## Phase 5 — Rewrite + Review-Pipeline

**Ziel:** Halbautomatische, reviewbare Content-Pflege.

### Aufgaben
- Rewrite-Prompt-Template bauen
- Review-Agent-Template bauen
- PR-Workflow definieren
- Status-Rückschreiben in Cache nach Review/Merge

**Ergebnis:** skalierbarer, kontrollierter Redaktionsprozess

**Aufwand:** 1–2 Wochen

---

## Risiken

### 1) Zu viel Vollständigkeit macht Prompts unbrauchbar
**Gegenmaßnahme:** Trennung `studyFeed` vs `keyFindings`

### 2) Tier/In-vitro wird übergewichtet
**Gegenmaßnahme:** `evidenceDomain` + klare Prioritätsregeln

### 3) Cache bleibt technisch sauber, aber redaktionell nutzlos
**Gegenmaßnahme:** Rewrite-Agent früh mit echten Test-Slugs evaluieren

### 4) Review wird zum Bottleneck
**Gegenmaßnahme:** Review-Agent als Vorfilter vor menschlichem Final-Check

### 5) Bootstrap wird mit echter Vollständigkeit verwechselt
**Gegenmaßnahme:** `reviewStatus: bootstrap` als Startzustand verwenden

---

## Erfolgskriterien

Das System ist erfolgreich, wenn:
- pro Wirkstoff ein diffbarer, strukturierter Forschungsstand existiert
- qualifizierte neue Evidenz nicht verloren geht
- Rewrite-Prompts weniger Tokens brauchen
- PR-Review sauber möglich ist
- wissenschaftliche Qualität und Claim-Sicherheit steigen
- Dossiers konsistenter und belastbarer werden

---

## Konkrete nächsten Schritte

1. JSON-Schema final festziehen
2. `index.json`-Schema finalisieren
3. `scripts/build-research-cache.cjs` bauen
4. Test mit 3 Slugs:
   - `omega-3`
   - `vitamin-d3`
   - `magnesium`
5. Bootstrap-Output prüfen
6. danach Refresh-Skript bauen
7. danach Rewrite-/Review-Pipeline

---

## Kurzfazit

Für Mikroscore ist der richtige Weg:
- **möglichst vollständiger, aber qualifizierter Research Cache**
- **maschinenfreundliche JSON-Struktur**
- **Rewrite-Agent → Review-Agent → menschlicher Final-Check**
- **Prompt-Selektion aus strukturierter Evidenz statt Rohrecherche**

Das ist nicht der schnellste Weg, aber der robusteste für langfristige Qualität, Vertrauen und SEO.
