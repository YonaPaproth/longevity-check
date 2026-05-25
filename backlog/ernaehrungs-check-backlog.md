# Ernährungs-Check — Product Backlog

Stand: 2026-05-25

---

## P0 — High Priority

### #1 Explain nutrient result cards
**Problem:** Results show risk, but users may not understand why.
**Aufgabe:** Add an explainable card for each high/medium-risk nutrient.
**Akzeptanzkriterien:**
- Show risk level, short reason, contributing answers, and next step
- Example: "Vitamin B12: erhöhtes Risiko, weil vegane Ernährung angegeben wurde."
- Link each nutrient to its Wirkstoff-Dossier
**Aufwand:** M | **Impact:** H

---

### #2 Soften diagnostic-sounding headline copy
**Problem:** "bei welchen Mikronährstoffen und Supplements du möglicherweise unterversorgt bist" kann imply deficiency detection.
**Aufgabe:** Reword intro and result copy to emphasize risk estimation.
**Suggested copy:**
> "Wir schätzen, bei welchen Mikronährstoffen ein erhöhtes Risiko für eine unzureichende Versorgung bestehen könnte."
**Akzeptanzkriterien:**
- Avoid "du bist unterversorgt" wording
- Use "Risiko", "Hinweis", "Schätzung", "keine Diagnose"
**Aufwand:** S | **Impact:** H

---

### #3 Make privacy promise more visible
**Problem:** Local processing is a strong trust signal but hidden inside the disclaimer.
**Aufgabe:** Add a privacy badge above question 1.
**Akzeptanzkriterien:**
- Copy: "🔒 Deine Antworten bleiben lokal im Browser und werden nicht an MikroScore übermittelt."
- Link to Datenschutz
- Repeat briefly near the result
**Aufwand:** S | **Impact:** H

---

### #4 Improve unanswered-question validation
**Problem:** The page says "Beantworte alle 15 Fragen", but does not clearly guide users to missing answers.
**Aufgabe:** Add accessible validation for incomplete checks.
**Akzeptanzkriterien:**
- Highlight unanswered questions
- Add "Zur nächsten unbeantworteten Frage" button
- Error text is readable by screen readers
- Progress indicator updates clearly: "12 von 15 beantwortet"
**Aufwand:** M | **Impact:** M

---

## P1 — Medium Priority

### #5 Add nutrient-specific next steps
**Problem:** "Was jetzt?" is useful, but generic.
**Aufgabe:** Show next steps per nutrient and risk level.
**Akzeptanzkriterien:**
- Low risk: maintain diet / monitor
- Medium risk: read dossier / check food sources
- High risk: consider blood test or medical clarification
- Product comparison is secondary, not the first action
**Aufwand:** M | **Impact:** M

---

### #6 Expand lab-marker guidance
**Problem:** Ferritin, 25-OH-Vitamin D, and Holotranscobalamin are listed, but not mapped to specific nutrients.
**Aufgabe:** Add "Welche Blutwerte passen zu welchem Nährstoff?"
**Akzeptanzkriterien:**
- Vitamin D → 25-OH-Vitamin D
- Iron → Ferritin, with context note
- B12 → Holotranscobalamin / B12 markers
- Include disclaimer: "ärztlich abklären lassen"
**Aufwand:** S | **Impact:** M

---

### #7 Add confidence scoring
**Problem:** Users may overinterpret a 0–10 radar score.
**Aufgabe:** Add confidence level to the result.
**Akzeptanzkriterien:**
- Show "Aussagekraft: niedrig / mittel / hoch"
- Lower confidence if many proxy questions are uncertain or missing nuance
- Explain limitations: no blood values, no portion sizes, no medical history depth
**Aufwand:** M | **Impact:** M

---

### #8 Add food-first recommendations
**Problem:** The current flow can lead quickly from risk to supplements/products.
**Aufgabe:** Add food-first guidance before supplement CTAs.
**Akzeptanzkriterien:**
- For each nutrient, show relevant food sources first
- Vegan/vegetarian-specific alternatives where relevant
- Keep product comparison as optional next step
**Aufwand:** M | **Impact:** M

---

## P2 — Later Improvements

### #9 Add "unsure / not applicable" answer options
**Problem:** Some questions are binary, e.g. medication use or statins.
**Aufgabe:** Add uncertainty options to medication and demographic questions.
**Akzeptanzkriterien:**
- Add "Ich bin unsicher" where appropriate
- Add "Trifft nicht zu" where appropriate
- Uncertain answers reduce confidence rather than forcing a risk assumption
**Aufwand:** M | **Impact:** L

---

### #10 Improve question grouping
**Problem:** 15 questions jump between diet, lifestyle, medication, and demographics.
**Aufgabe:** Group questions into labeled sections.
**Akzeptanzkriterien:**
- Sections: Ernährung / Lifestyle / Medikamente / Person & Lebensphase
- Progress shown per section or overall
**Aufwand:** M | **Impact:** L

---

### #11 Add result export as PDF
**Problem:** Users may want to discuss results with a doctor.
**Aufgabe:** Add local-only export.
**Akzeptanzkriterien:**
- "Ergebnis kopieren" button
- "Als PDF speichern" via browser print
- Include timestamp and disclaimer
- No server-side storage
**Aufwand:** S | **Impact:** M
