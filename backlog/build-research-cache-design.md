# Build Research Cache — Design

Stand: 2026-05-30

## Ziel

`build-research-cache.cjs` soll aus bestehenden `src/content/ingredients/*.mdx` Dateien einen **maschinenfreundlichen Bootstrap-Cache** erzeugen.

Der Build ist ausdrücklich **kein kompletter Research-Refresh** aus externen Quellen, sondern ein strukturierter Erstaufbau auf Basis der vorhandenen Dossiers.

---

## Input / Output

## Input
- `src/content/ingredients/*.mdx`
- optional später: bestehende `research-cache/*.json` zum Merge/Preserve bestimmter Felder

## Output
- `research-cache/{slug}.json`
- `research-cache/index.json`

---

## Verantwortung des Skripts

Das Skript soll:
- Frontmatter parsen
- definierte Body-Signale extrahieren
- Studien aus `key_studies` in `studyFeed` und `keyFindings` überführen
- vorhandene Evidenz- und Regulatory-Hinweise normalisieren
- Produkt-/Formfaktoren, soweit im Dossier klar erkennbar, strukturiert ablegen
- `index.json` mit kleinen Counts erzeugen
- deterministische, stabile JSON-Dateien schreiben

Das Skript soll **nicht**:
- externe APIs abfragen
- Volltexte nachladen
- Studienqualität neu wissenschaftlich bewerten
- Freitext „intelligent halluzinieren"

---

## CLI-Vorschlag

```bash
node scripts/build-research-cache.cjs
node scripts/build-research-cache.cjs --slug omega-3
node scripts/build-research-cache.cjs --outDir research-cache
node scripts/build-research-cache.cjs --dry-run
node scripts/build-research-cache.cjs --preserve-manual
```

### Flags
- `--slug <slug>` → nur ein Dossier bauen
- `--outDir <path>` → alternatives Zielverzeichnis
- `--dry-run` → keine Dateien schreiben, nur Preview/Validation
- `--preserve-manual` → bestehende manuelle Felder aus vorhandenem Cache bewahren

---

## Strenge Normalisierung

## 1) `studyType` kontrolliertes Enum

Erlaubte Werte:
- `meta-analysis`
- `systematic-review`
- `rct`
- `observational`
- `guideline`
- `animal`
- `in-vitro`
- `other`

### Regel
- `preclinical` wird **nicht** verwendet
- Tier-/In-vitro-Studien werden nur über `studyType` + `evidenceDomain` modelliert

## 2) `evidenceDomain` kontrolliertes Enum

Erlaubte Werte:
- `human`
- `animal`
- `in-vitro`
- `guideline`
- `mixed`
- `unknown`

## 3) Qualitätsfelder

Behalten werden:
- `quality`: `low | medium | high`
- `confidence`: `low | medium | high`
- `riskOfBias`: `low | medium | high | unknown`

### Bootstrap-Regel
Beim Build nur konservativ setzen.
Wenn nicht sauber ableitbar:
- `quality`: `medium`
- `confidence`: aus `evidenceLevel` ableiten
- `riskOfBias`: `unknown`

---

## Neues Subschema: `productFactors`

Bestimmte Wirkstoffe brauchen strukturierte Form-/Produktlogik.

```json
"productFactors": {
  "hasStructuredProductConsiderations": true,
  "forms": [
    {
      "name": "magnesiumglycinat",
      "category": "compound-form",
      "bioavailability": "high",
      "tolerability": "high",
      "notes": "Gut geeignet fuer Schlaf/Nerven; meist gut vertraeglich"
    },
    {
      "name": "magnesiumoxid",
      "category": "compound-form",
      "bioavailability": "low",
      "tolerability": "medium",
      "notes": "Oft guenstig, aber schwache Bioverfuegbarkeit"
    }
  ],
  "selectionNotes": [
    "Form beeinflusst Bioverfuegbarkeit deutlich",
    "Nicht nur mg-Zahl, sondern elementares Magnesium und Form beachten"
  ]
}
```

### Einsatz
Vor allem relevant für:
- Magnesium
- Omega-3
- CoQ10
- Curcumin
- Probiotika
- ggf. Kreatin

### Bootstrap-Regel
Nur füllen, wenn aus Frontmatter/Body klar und explizit ableitbar.

---

## Mapping MDX → Cache

## Frontmatter-Mapping

| MDX-Feld | Cache-Feld |
|---|---|
| `slug` | `slug` |
| `title` | `dossier.title` |
| `updatedAt` / `publishedAt` | `dossier.updatedAt` |
| `evidenceLevel` | `evidenceSummary.level` |
| `evidenceSummary` | `evidenceSummary.headline` |
| `efsa_notes` | `regulatory.notes` |
| `efsa_health_claims_allowed` | `regulatory.approvedClaims` / `regulatory.notes` abgeleitet |
| `key_studies` | `studyFeed` + `keyFindings` |
| `aliases` | optional `aliases` im Root |
| `summary` | optional `dossier.summary` |

---

## `key_studies` → `studyFeed`

Jeder `key_studies`-Eintrag wird in einen `studyFeed`-Eintrag transformiert.

### Ableitungen
- `id`: bevorzugt `pmid-<pmid>`, sonst slug-basierte Fallback-ID
- `sourceType`: `PubMed`, wenn PMID vorhanden, sonst `Unknown`
- `title`, `year`, `pmid` direkt übernehmen
- `summary`: aus `finding`
- `effectSummary`: heuristisch aus `finding`
- `studyType`: aus Titel/Finding über Regeln ableiten
- `evidenceDomain`: aus `studyType` ableiten

### Heuristik für `studyType`
Priorität der Erkennung:
1. `meta-analysis`, `metaanalyse`, `pooled analysis` → `meta-analysis`
2. `systematic review`, `review` → `systematic-review`
3. `rct`, `randomized`, `placebo-controlled`, `double-blind` → `rct`
4. `cohort`, `prospective`, `observational` → `observational`
5. `guideline`, `consensus`, `position statement` → `guideline`
6. `mouse`, `mice`, `rat`, `murine`, `animal` → `animal`
7. `cell`, `in vitro`, `cell culture` → `in-vitro`
8. sonst `other`

### Ableitung `evidenceDomain`
- `meta-analysis`, `systematic-review`, `rct`, `observational` → `human`
- `guideline` → `guideline`
- `animal` → `animal`
- `in-vitro` → `in-vitro`
- `other` → `unknown`

---

## `key_studies` → `keyFindings`

Nicht jeder `studyFeed`-Eintrag muss automatisch ein perfekter `keyFinding` werden.

### Bootstrap-Regel
Initial werden die ersten qualifizierten `key_studies` auch als `keyFindings` übernommen, aber kompakter:
- `claim` wird aus `finding` heuristisch verkürzt
- `effectSize` wird per Regex extrahiert, wenn vorhanden
- `includedInDossier: true`

### Wichtig
Diese `keyFindings` sind im Bootstrap ein **brauchbarer Startzustand**, aber keine finale Kuration.

---

## Regulatory-Mapping

### `regulatory` Objekt

```json
"regulatory": {
  "efsaCheckedAt": "2026-05-30",
  "approvedClaims": [],
  "rejectedClaims": [],
  "wordingConstraints": [],
  "notes": "..."
}
```

### Bootstrap-Regeln
- `efsa_notes` → `regulatory.notes`
- wenn `efsa_health_claims_allowed: true` und konkrete Claims im Text erkennbar → nach Möglichkeit in `approvedClaims`
- sonst `approvedClaims: []` und Hinweis in `notes`
- `wordingConstraints` heuristisch aus Claim-Sensitivität setzen, z. B.:
  - „Keine krankheitsbezogenen Heilclaims formulieren"
  - „Tierdaten nicht als Humanbeleg darstellen"

---

## Produkt-/Formfaktoren extrahieren

### Quellen
- `aliases`
- Tabellen im Body
- Abschnitte wie „Welche Form?“, „Auf welche Qualität achten?“, „Dosierung“, „Produktwahl"

### Erste Bootstrap-Regel
Nur einfache strukturierte Erkennung:
- Magnesiumformen: Glycinat, Citrat, Oxid, Threonat, Malat
- Omega-3-Formen: TG, EE, Krillöl, Algenöl
- CoQ10: Ubiquinon, Ubiquinol
- Curcumin: Standardextrakt, Phytosom, Piperin-Kombi
- Probiotika: Stamm-/CFU-Logik vorerst nur rudimentär

Wenn nichts Sicheres erkannt wird:
```json
"productFactors": {
  "hasStructuredProductConsiderations": false,
  "forms": [],
  "selectionNotes": []
}
```

---

## Root-Schema des Bootstrap-Outputs

Pflichtfelder:
- `slug`
- `cacheVersion`
- `status`
- `reviewStatus`
- `createdAt`
- `updatedAt`
- `lastReviewed`
- `reviewer`
- `lastSearchDate`
- `priority`
- `dossier`
- `evidenceSummary`
- `keyFindings`
- `studyFeed`
- `newEvidence`
- `openQuestions`
- `regulatory`
- `triage`
- `productFactors`

Optionale Felder:
- `aliases`
- `search`

### Bootstrap-Defaults
- `status`: `active`
- `reviewStatus`: `bootstrap`
- `reviewer`: `build-research-cache`
- `lastSearchDate`: heutiges Datum oder `null` (Empfehlung: heutiges Datum als Bootstrap-Stempel)
- `newEvidence`: `[]`
- `openQuestions`: `[]`
- `triage.needsReview`: `true`
- `triage.flaggedForRewrite`: `false`
- `triage.evidenceChangeSeverity`: `medium`
- `triage.reviewPriority`: aus SEO/Audit heuristisch

---

## Ableitungslogik für `confidence`

Aus `evidenceLevel`:
- `1` → `high`
- `2` → `high`
- `3` → `medium`
- `4` → `low`
- `5` oder unbekannt → `low`

---

## `index.json`-Design mit kleinen Counts

```json
{
  "cacheVersion": 1,
  "generatedAt": "2026-05-30",
  "totalSlugs": 110,
  "items": [
    {
      "slug": "omega-3",
      "title": "Omega-3 (EPA + DHA)",
      "reviewStatus": "bootstrap",
      "lastReviewed": "2026-05-30",
      "lastSearchDate": "2026-05-30",
      "auditScore": 100,
      "evidenceLevel": 1,
      "seoPriority": "high",
      "needsReview": true,
      "flaggedForRewrite": false,
      "evidenceChangeSeverity": "medium",
      "reviewPriority": "high",
      "keyFindingCount": 3,
      "studyFeedCount": 5,
      "newEvidenceCount": 0,
      "structuredProductFormsCount": 4
    }
  ]
}
```

### Nutzen der Counts
- schnelle Queue-Bildung
- Plausibilitätscheck
- Dashboarding / Cron-Auswertung

---

## Parsing-Strategie

## Schritt 1 — MDX laden
- Datei lesen
- Frontmatter parsen
- Body separat halten

## Schritt 2 — Basismetadata normalisieren
- Slug, Titel, UpdatedAt etc.
- Defaults setzen

## Schritt 3 — Studien extrahieren
- `key_studies` aus Frontmatter holen
- pro Studie `studyFeed`-Entry bauen
- daraus `keyFindings`-Bootstrap erzeugen

## Schritt 4 — Regulatory-Signale extrahieren
- EFSA-Felder mappen
- relevante Listen heuristisch erzeugen

## Schritt 5 — Produktfaktoren erkennen
- definierte Muster je Wirkstoff/Body anwenden

## Schritt 6 — Priority/Triage setzen
- SEO hoch, wenn Slug in High-Priority-Liste
- Audit-Score aus existierendem Audit ableiten, wenn verfügbar
- `needsReview: true` im Bootstrap standardmäßig setzen

## Schritt 7 — JSON stabil schreiben
- sortierte Schlüssel
- 2-space indentation
- deterministische Array-Reihenfolge

---

## Fehlerverhalten

### Hard fail
- fehlender Slug
- invalide JSON-Struktur beim Schreiben
- unlesbare Datei

### Soft warnings
- kein `updatedAt`
- keine `key_studies`
- unklare `studyType`-Erkennung
- keine EFSA-Hinweise
- keine Produktfaktoren erkannt

### Reporting
Am Ende Summary:
- Anzahl verarbeiteter Slugs
- Warnungen pro Typ
- Liste problematischer Dateien

---

## Preserve-Manual-Strategie

Wenn `--preserve-manual` aktiv ist und bereits ein Cache existiert:

### Erhalten bleiben sollen
- `openQuestions`
- manuell kuratierte `keyFindings`, wenn markiert
- `newEvidence`
- `triage`
- manuell gepflegte `regulatory.wordingConstraints`

### Neu generiert werden sollen
- `dossier`
- `evidenceSummary` Basisfelder
- `studyFeed` aus aktuellem MDX
- `productFactors` aus aktuellem Inhalt
- `index.json`

Empfehlung: manuelle Einträge später mit z. B. `manual: true` markieren.

---

## Grenzen des Bootstrap-Skripts

Das Skript kann gut:
- Struktur aufbauen
- vorhandene Studien ins Schema bringen
- konsistente Ausgangsdateien erzeugen

Das Skript kann nicht zuverlässig:
- echte Vollständigkeit garantieren
- Studienqualität belastbar neu bewerten
- alle Produktformen perfekt extrahieren
- saubere Kuration ohne menschliche/agentische Nacharbeit liefern

Deshalb ist Bootstrap nur **Phase 1**, nicht die Endlösung.

---

## Empfohlene Umsetzung in Dateien

- `scripts/build-research-cache.cjs`
- optional `scripts/lib/research-cache-schema.cjs`
- optional `scripts/lib/research-cache-normalize.cjs`
- optional `scripts/lib/research-cache-product-factors.cjs`

Wenn klein gehalten werden soll: erstmal alles in einer Datei, später aufteilen.

---

## Nächster Schritt nach diesem Design

1. 3 Beispiel-JSONs gegen dieses Design prüfen
2. kleine Schema-Anpassungen machen
3. `build-research-cache.cjs` implementieren
4. auf 3 Slugs testen
5. dann auf alle Dossiers laufen lassen
