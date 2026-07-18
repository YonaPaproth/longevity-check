# MikroScore Site Audit — 2026-07-18

**Datenbasis:** 119 Ingredients, 275 Produkte, 438 Studien, 51 Symptome


## 1. Evidence-Score vs. Produkt-Ratings

### Niedrige Evidence (≤2) aber hohe Produktscores (≥7): 0

### Hohe Evidence (≥4) aber niedrige Produktscores (<6): 0


## 2. Studien-Abdeckung

### Ingredients ohne verlinkte Studien: 0 / 119

### Studien ohne Ingredient-Verknüpfung: 19 / 438


## 3. Symptom-Abdeckung

### Symptome mit ≤1 verlinkten Ingredients: 28 / 51
| Symptom | Ingredients |
|---|---|
| blase | 0 |
| kontra-autoimmunerkrankung | 0 |
| kontra-blutdruckmedikamente | 0 |
| kontra-blutgerinnungsstoerung | 0 |
| kontra-chemotherapie | 0 |
| kontra-diabetes-medikamente | 0 |
| kontra-immunsuppression | 0 |
| kontra-kinder | 0 |
| kontra-lebererkrankung | 0 |
| kontra-mao-hemmer | 0 |
| kontra-nierenerkrankung | 0 |
| kontra-organtransplantation | 0 |
| kontra-schilddruesenerkrankung | 0 |
| kontra-schwangerschaft | 0 |
| kontra-ssri-einnahme | 0 |
| nw-blutdruckabfall | 0 |
| nw-blutzuckerabfall | 0 |
| nw-flush | 0 |
| nw-hautausschlag | 0 |
| nw-kopfschmerzen | 0 |
| nw-lebertoxizitaet | 0 |
| nw-magen-darm-beschwerden | 0 |
| nw-metallischer-geschmack | 0 |
| nw-schilddruesenueberfunktion | 0 |
| nw-schlaflosigkeit | 0 |
| nw-serotonin-syndrom | 0 |
| prostata | 0 |
| schmerz | 0 |

### Ingredients ohne Symptom-Verknüpfung: 7 / 119
cdp-cholin, cistanche, kaempferol, l-tryptophan, lithium-orotat, piperin, tongkat-ali


## 4. Produkt-Abdeckung

### Ingredients ohne Produkte: 25 / 119
akg, akkermansia, astragalus, betain, cdp-cholin, cholin, ergothionein, ginseng, glynac, gynostemma, inulin, kaempferol, kalium, molybdaen, phosphor, piperin, rapamycin, safran, trehalose, vitamin-b1

### Ingredients mit nur 1 Produkt: 39
apigenin, baicalin, beta-alanin, bor, calcium, chrom, cistanche, cordyceps, dl-phenylalanin, flohsamenschalen, folsaeure, fucoidan, gaba, ginkgo, glucosamin


## 5. Datenqualität

| Feld | Fehlend | Total | % |
|---|---|---|---|
| study_type | 434 | 438 | 99% |
| evidence_quality | 434 | 438 | 99% |
| coi | 434 | 438 | 99% |
| n (Teilnehmer) | 438 | 438 | 100% |

| Produkt-Feld | Fehlend |
|---|---|
| pricePerDay | 0 |
| doseMg | 1 |


## 6. Vendor-Verteilung

| Vendor | Produkte |
|---|---|
| NOW Foods | 51 |
| Jarrow Formulas | 37 |
| Life Extension | 36 |
| Pure Encapsulations | 26 |
| Thorne | 22 |
| Sunday Natural | 11 |
| Double Wood | 10 |
| BIOGENA | 9 |
| MoleQlar | 7 |
| Nutricost | 6 |
| Doctor's Best | 5 |
| Fairvital | 5 |
| Sports Research | 5 |
| Nordic Naturals | 4 |
| NOW Sports | 3 |


## 7. Preis-Verteilung (pricePerDay)

| Preisklasse €/Tag | Produkte |
|---|---|
| <0.10 | 11 |
| 0.10-0.20 | 43 |
| 0.20-0.50 | 121 |
| 0.50-1.00 | 70 |
| >1.00 | 30 |


## 8. Prioritäten

### P0 — Sofort (SEO/Trust-Impact)
1. ~~**28 Symptom-Seiten mit ≤1 Ingredient**~~ — größtenteils kontra-*/nw-* Entities, keine echten Lücken. Echte Lücke: `blase`, `prostata`, `schmerz` (P2)
2. ~~**25 Ingredients ohne Produkte**~~ → **20 nach P0.3** (8 neue Produkte: Ginseng, Safran, Kalium, Inulin, Ginkgo) ✅
3. ~~**Study type fehlt bei 434 Studien** (99%)~~ → **196/438 haben study_type** (62 RCTs, 54 Reviews, 22 Meta-Analysen, etc.) ✅ Rest sind generische "Journal Article"

### P1 — Diese Woche
4. **0 Evidence-Verdict Mismatches** ✅ — keine Aktion nötig, Scores sind konsistent
5. ~~**39 Single-Product-Ingredients**~~ → **29 nach P1.4** (10 neue Produkte: Thorne, Sunday Natural, Pure Encapsulations, etc.) ✅
6. **COI-Feld befüllen** — 434 Studien ohne COI-Angabe (99%) — **nächster Schritt: LLM-Batch mit Kimi K3**
7. ~~**Playwright Tests**~~ → **12 Smoke Tests live** (Homepage, Dossier, Produkt, Graph, EN, Sitemap) ✅

### P2 — Nächste Wochen
8. ~~**19 Orphan Studies**~~ → **0 Orphans** (PMID 7649494 → alpha-liponsaeure verknüpft) ✅
9. **n (Teilnehmerzahl) befüllen** — 41/438 befüllt ✅, Rest hat kein n im Abstract (PubMed-Limitation)
10. **Echte Symptom-Lücken** — `blase`, `prostata`, `schmerz` haben 0 Ingredients
11. **Branch Protection** — main schützen, PR-Workflow einführen