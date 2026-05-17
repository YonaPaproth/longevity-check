# Claims-Check Backlog

## 🔬 Strategie: Dr. Sarah + eigenes Produkt-Testing

**Hintergrund:** Sarah hat einen Dr. in Physik / Bio Imaging – analytische Methoden (HPLC, Spektroskopie, Reinheitsanalyse) liegen in ihrem Fachgebiet.

**Kurzfristig:** Credentials noch nicht erwähnen (ohne Kontext verwirrend für Nutzer).

**Mittelfristig:** Wenn eigene Produkttests starten, Sarah als Leiterin der Analysemethoden positionieren:
> *„Unsere Analysemethoden werden von Dr. Sarah Rahmati, Physikerin mit Spezialisierung auf biomedizinische Bildgebung und analytische Messtechnik, entwickelt."*

**Langfristig USP:**
- Einzige deutschsprachige Seite die (1) Studien prüft + (2) Produkte wirklich analysiert + (3) akademische Credentials hat
- Moat gegenüber Konkurrenten, die nur PubMed zitieren

**Nächste Schritte wenn bereit:**
- [ ] "Über uns / Editorial"-Seite mit Methodik + Team anlegen
- [ ] Author-Attribution auf Artikeln einführen
- [ ] Erste 5-10 Produkte im Labor testen (Reinheit, Wirkstoffgehalt)
- [ ] Launch als Feature: "MikroScore Lab" o.ä.

---

## ⚡ TODO Morgen: Google Indexierung einrichten

- [ ] **Google Search Console** einrichten → https://search.google.com/search-console
  - Domain `mikroscore.com` verifizieren (DNS-TXT-Record über Vercel-Domain-Settings)
  - Sitemap einreichen: `https://mikroscore.com/sitemap-index.xml`
  - Einzelne wichtige URLs manuell zur Indexierung anmelden
- [ ] **Bing Webmaster Tools** (optional, aber lohnt sich) → https://www.bing.com/webmasters
- [ ] Nach Einrichtung: Status in Search Console beobachten (Crawling, Indexabdeckung)

---


Ziel: priorisierte Claim-Seiten für organischen Traffic über Google. Fokus auf suchbare, kontroverse oder häufig behauptete Supplement-Claims im deutschsprachigen Raum.

**Konventionen**
- `status`: `done` (Claim-Seite existiert) oder `todo`
- `slug`: geplanter bzw. vorhandener Content-Slug
- `priority`: `A` = zuerst bauen, `B` = sehr gute nächste Welle, `C` = später / ergänzend

| # | Claim / Keyword | slug | priority | status | notes |
|---:|---|---|---|---|---|
| 1 | Senkt Ashwagandha wirklich Cortisol? | ashwagandha-cortisol-senken | A | done | bereits live |
| 2 | Hilft Magnesium wirklich beim Schlafen? | magnesium-hilft-beim-schlafen | A | done | live seit 2026-05-16 |
| 3 | Ist Berberin wirklich wie Ozempic? | berberin-wie-ozempic | A | done | live seit 2026-05-16 |
| 4 | Bringt Kollagen wirklich etwas? | kollagen-bringt-wirklich-etwas | A | done | live seit 2026-05-16 |
| 5 | Muss man Vitamin D mit Fett einnehmen? | vitamin-d-ohne-fett-wirkungslos | A | done | bereits live |
| 6 | Macht Omega-3 wirklich schlauer? | omega-3-macht-schlau | A | done | bereits live |
| 7 | Ist NMN wirklich lebensverlängernd? | nmn-verlaengert-das-leben | A | done | bereits live |
| 8 | Hilft Curcumin wirklich gegen Entzündungen? | curcumin-besser-als-ibuprofen | A | done | aktueller Angle enger / provokanter |
| 9 | Muss man Zink morgens einnehmen? | zink-immer-morgens | A | done | bereits live |
| 10 | Ist Kreatin nur etwas für Muskeln? | kreatin-nur-fuer-muskeln | A | done | live seit 2026-05-16 |
| 11 | Hilft Magnesium gegen Stress? | magnesium-gegen-stress | B | todo | guter Longtail zu bestehendem Stoff |
| 12 | Hilft L-Theanin gegen Stress? | l-theanin-gegen-stress | B | done | live seit 2026-05-16 |
| 13 | Hilft Melatonin beim Durchschlafen? | melatonin-beim-durchschlafen | B | todo | sehr klare Consumer-Frage |
| 14 | Verbessert B12 wirklich die Energie? | b12-mehr-energie | B | todo | guter Alltagssuchintent |
| 15 | Hilft Eisen bei Müdigkeit? | eisen-bei-muedigkeit | B | todo | hoher Informationswert |
| 16 | Hilft Omega-3 gegen Depression? | omega-3-gegen-depression | B | todo | vorsichtig formulieren, YMYL-nah |
| 17 | Helfen Probiotika der Darmflora wirklich? | probiotika-darmflora-wirklich | B | todo | breiter Mainstream-Claim |
| 18 | Macht Spermidin Autophagie beim Menschen? | spermidin-autophagie-menschen | B | todo | guter Longevity-Intent |
| 19 | Macht Resveratrol wirklich jünger? | resveratrol-macht-juenger | B | todo | klassischer Anti-Aging-Claim |
| 20 | Hilft Quercetin gegen Entzündungen? | quercetin-gegen-entzuendungen | B | todo | Suchvolumen vermutlich moderat |
| 21 | Macht NAC die Leber sauber? | nac-leber-detox | B | todo | starker simplifizierter Claim |
| 22 | Hilft NAC bei Histamin? | nac-bei-histamin | B | todo | Nischen-Search, aber sehr konkret |
| 23 | Macht Magnesiumglycinat müde? | magnesiumglycinat-muede | B | todo | guter produktnaher Intent |
| 24 | Hilft Glycin beim Schlafen? | glycin-beim-schlafen | B | todo | growing topic |
| 25 | Verbessert Coenzym Q10 die Energie? | coenzym-q10-mehr-energie | B | todo | guter Consumer-Claim |
| 26 | Macht PQQ neue Mitochondrien? | pqq-neue-mitochondrien | C | todo | Biohacker / mechanistisch |
| 27 | Macht Urolithin A jüngere Mitochondrien? | urolithin-a-juengere-mitochondrien | C | todo | guter Longevity-Claim |
| 28 | Hilft Rhodiola gegen Stress? | rhodiola-gegen-stress | C | todo | solider Ergänzungsclaim |
| 29 | Hilft Tongkat Ali beim Testosteron? | tongkat-ali-testosteron | C | todo | vorsichtig formulieren |
| 30 | Hilft Maca bei Libido? | maca-libido | C | todo | guter Mainstream-Longevity-Mix |
| 31 | Hilft Ginseng gegen Müdigkeit? | ginseng-gegen-muedigkeit | C | todo | brauchbarer Adaptogen-Claim |
| 32 | Hilft Ginkgo dem Gedächtnis? | ginkgo-gedaechtnis | C | todo | breiter alter Suchintent |
| 33 | Macht Shilajit mehr Energie? | shilajit-mehr-energie | C | todo | eher Bubble-Content |
| 34 | Hilft Cistanche beim Altern? | cistanche-anti-aging | C | todo | frühes Longevity-Thema |
| 35 | Hilft Reishi dem Immunsystem? | reishi-immunsystem | C | todo | klassischer Pilz-Claim |
| 36 | Hilft Cordyceps bei Ausdauer? | cordyceps-ausdauer | C | todo | sportnah |
| 37 | Hilft Selen der Schilddrüse? | selen-schilddruese | C | todo | YMYL-näher, sauber formulieren |
| 38 | Braucht jeder Magnesium-Supplemente? | braucht-jeder-magnesium | C | todo | gute anti-hype Seite |

## Bereits live

Aktuell vorhandene Claim-Seiten in `src/content/claims/`:
- ashwagandha-cortisol-senken
- berberin-wie-ozempic
- curcumin-besser-als-ibuprofen
- kollagen-bringt-wirklich-etwas
- kreatin-nur-fuer-muskeln
- l-theanin-gegen-stress
- magnesium-hilft-beim-schlafen
- nmn-verlaengert-das-leben
- omega-3-macht-schlau
- vitamin-d-ohne-fett-wirkungslos
- zink-immer-morgens

## Nächster sinnvoller Batch

Empfohlene nächste 5:
1. magnesium-gegen-stress
2. melatonin-beim-durchschlafen
3. b12-mehr-energie
4. eisen-bei-muedigkeit
5. probiotika-darmflora-wirklich
