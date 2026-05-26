# Build Prompt: Vegan Supplement Check Landing Page

## Task

Create a new Astro page at `src/pages/vegan-supplement-check.astro`.

Use the existing `BaseLayout` from `src/layouts/BaseLayout.astro` and the `LegalNotice` component from `src/components/LegalNotice.astro`. Follow the visual style of `src/pages/ernaehrungs-check.astro` (Tailwind, slate/teal color palette, card-based layout).

---

## SEO Metadata

- **Title tag:** `Vegan Supplement Check: B12, Jod, Omega-3 & mehr | MikroScore`
- **Meta description:** `Welche Supplemente sind für vegane Ernährung wirklich relevant? Evidenzbasierter Überblick ohne Heilversprechen — B12, Jod, Omega-3 (Algenöl), Eisen, Calcium.`
- **Slug / URL:** `/vegan-supplement-check`
- **Language:** German (de)

Add FAQPage JSON-LD structured data for all FAQ questions, following the same pattern already used on product pages.

---

## Goal

An SEO-friendly, legally safe landing page for German vegan/plant-based users who want to understand which supplement ingredients are commonly relevant — without medical advice or health outcome promises.

---

## Audience

German users eating vegan or mostly plant-based, actively comparing supplements. They want clarity, not hype.

---

## Tone

Neutral, evidence-oriented, consumer-friendly, trustworthy, non-medical. German language throughout.

---

## Legal / Compliance

**Do NOT use:**
- "beste Mittel gegen Mangel", "heilt", "behandelt", "verhindert Krankheiten", "garantiert"
- "Symptome verbessern", "hilft gegen", "wirkt bei"
- Any language that implies diagnosis, treatment, or prevention of disease

**DO use:**
- "kritische Nährstoffe", "häufig relevant", "Etikett prüfen"
- "ärztlich oder labordiagnostisch abklären lassen"
- "in Studien gezeigt", "kann beitragen zu", "unter Umständen"

Do NOT rank products by medical benefit. Rank only by: transparency, formulation quality, and label clarity.

Use the existing `<LegalNotice>` component for the main disclaimer block:
> MikroScore hilft beim Vergleich von Supplement-Etiketten und Wirkstoffen. Es ersetzt keine ärztliche Beratung oder labordiagnostische Untersuchung.

---

## Page Structure

### 1. Hero
- **H1:** `Vegan Supplement Check: Was ist wirklich relevant?`
- **Subheadline:** `B12, Jod, Omega-3, Eisen & Calcium — evidenzbasierter Überblick für pflanzliche Ernährung`
- **CTA Button:** "Vegan-relevante Produkte vergleichen" → `/produkte`
- Include `<LegalNotice>` disclaimer directly below hero

---

### 2. Section: "Warum Veganer Supplemente anders bewerten sollten"
Short 2–3 paragraph intro explaining:
- Pflanzliche Ernährung schließt bestimmte Nährstoffquellen aus
- Nicht alle Nährstoffe sind aus Lebensmitteln gleich bioverfügbar
- MikroScore bewertet Produkte nach Formulierungsqualität, nicht nach Heilversprechen

---

### 3. Nährstoff-Karten (Nutrient Cards)

For each nutrient, create a card with:
- Name + icon
- 1-sentence relevance statement (legal-compliant)
- Typische Form/Quelle für Veganer
- Hinweis wann Abklärung sinnvoll ist
- Link to ingredient dossier

**Nutrient cards (in this order):**

#### Vitamin B12
- Relevanz: Kommt ausschließlich in tierischen Produkten vor — bei veganer Ernährung in der Regel supplementierungsbedürftig
- Vegane Form: Methylcobalamin oder Adenosylcobalamin
- Hinweis: Spiegel über Holotranscobalamin messen lassen
- Link: `/wirkstoffe/vitamin-b12`

#### Jod
- Relevanz: Pflanzliche Ernährung liefert oft wenig Jod — abhängig von Salzwahl und Meeresfrüchtekonsum
- Vegane Form: Jodiertes Speisesalz oder Algenpräparate (Dosierung beachten)
- Hinweis: Schilddrüsenfunktion beachten
- Link: `/wirkstoffe/jod`

#### Omega-3 (DHA/EPA)
- Relevanz: EPA und DHA kommen fast ausschließlich in Fisch vor — pflanzliche ALA-Quellen (Leinöl) werden kaum umgewandelt
- Vegane Form: Algenöl (direkte DHA/EPA-Quelle, ohne Fisch)
- Hinweis: Omega-3-Index messbar (Vollbluttest)
- Link: `/wirkstoffe/omega-3`

#### Eisen
- Relevanz: Pflanzliches Non-Häm-Eisen wird schlechter aufgenommen als tierisches Häm-Eisen
- Vegane Form: Eisenbisglycinat (gut verträglich)
- Hinweis: Nur nach Ferritin-Bluttest supplementieren — zu viel Eisen ist schädlich
- Link: `/wirkstoffe/eisen`

#### Calcium
- Relevanz: Ohne Milchprodukte hängt Calciumversorgung stark von Lebensmittelwahl ab
- Vegane Form: Calciumcitrat oder -carbonat; angereicherte Pflanzenmilch
- Hinweis: Kombination mit Vitamin D für Aufnahme relevant
- Link: `/wirkstoffe/calcium`

#### Vitamin D
- Relevanz: Unabhängig von Ernährungsweise — Sonnenexposition entscheidend
- Vegane Form: Vitamin D3 aus Flechten (vegan) + K2 MK-7
- Hinweis: 25-OH-Vitamin D im Blut messen lassen
- Link: `/wirkstoffe/vitamin-d3-k2`

#### Zink *(optional, secondary card)*
- Vegane Form: Zinkbisglycinat; Phytate in Hülsenfrüchten durch Einweichen reduzieren
- Link: `/wirkstoffe/zink`

#### Selen *(optional, secondary card)*
- Vegane Form: 1–2 Paranüsse/Tag oder Natriumselenit/Selenomethionin
- Link: `/wirkstoffe/selen`

#### Cholin *(optional, secondary card)*
- Relevanz: Hauptquelle Eigelb — bei veganer Ernährung schwer zu decken
- Link: `/wirkstoffe/cholin`

---

### 4. Produkt-Checkliste "Worauf beim Kauf achten"

Simple checklist card (no product rankings):
- ✅ Aktive Form und Dosierung angegeben
- ✅ Transparente Deklaration aller Zutaten
- ✅ Keine unnötigen Füllstoffe / Zusatzstoffe
- ✅ Laboranalyse / Drittprüfung vorhanden (COA)
- ✅ Preis pro Tagesdosis vergleichbar
- ✅ Vegane Kapsel, Algenquelle, jodfreie Variante verfügbar

---

### 5. "Was MikroScore bewertet"

Short section explaining the scoring approach:
- Transparenz der Inhaltsstoffe
- Formulierungsqualität (aktive Formen, Bioverfügbarkeit)
- Preis-Leistungs-Verhältnis (Preis pro Tagesdosis)
- Keine Bewertung nach medizinischem Nutzen

---

### 6. FAQ (with FAQPage JSON-LD)

Questions (write 3–4 sentence answers, legal-compliant):

1. **Welche Supplemente brauchen Veganer wirklich?**
2. **Ist Vitamin B12 für Veganer notwendig?**
3. **Brauchen Veganer Jod als Supplement?**
4. **Ist Algenöl sinnvoll als Omega-3-Quelle?**
5. **Sollte man Eisen vegan supplementieren?**
6. **Wie erkenne ich ein qualitativ hochwertiges veganes Supplement?**

---

### 7. CTA Bottom

- Button: "Vegan-relevante Produkte vergleichen" → `/produkte`
- Secondary link: "Zum Ernährungs-Check" → `/ernaehrungs-check`

---

## Internal Links Summary

| Nährstoff | Dossier-Link |
|-----------|-------------|
| Vitamin B12 | `/wirkstoffe/vitamin-b12` |
| Jod | `/wirkstoffe/jod` |
| Omega-3 | `/wirkstoffe/omega-3` |
| Eisen | `/wirkstoffe/eisen` |
| Calcium | `/wirkstoffe/calcium` |
| Vitamin D3+K2 | `/wirkstoffe/vitamin-d3-k2` |
| Zink | `/wirkstoffe/zink` |
| Selen | `/wirkstoffe/selen` |
| Cholin | `/wirkstoffe/cholin` |
| Produkte | `/produkte` |
| Ernährungs-Check | `/ernaehrungs-check` |

---

## After Implementation

1. `pnpm build` — must pass with 0 errors
2. `git commit -m "feat: add vegan supplement check landing page"`
3. `git push`
