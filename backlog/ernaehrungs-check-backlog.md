# Ernährungs-Check — Product Backlog

Stand: 2026-05-25

Ziel dieses Backlogs: priorisierte UX-/Produktarbeit für `/ernaehrungs-check`, inkl. Empfehlung, welches Modell den Task am effizientesten umsetzen sollte.

## Modell-Flags

- **`gpt-5.1-mini`** → kleine Copy-/Content-Edits, einfache UI-Anpassungen, strukturierte Ergänzungen ohne tiefe Logik
- **`gpt-5.3-codex`** → fokussierte Frontend-Umsetzung, Komponenten-/Template-Edits, klar begrenzte UI-Logik
- **`claude-code-sonnet-4.6`** → komplexere UI-Logik, Scoring-/State-Änderungen, Refactors, riskantere Produktänderungen
- **`gpt-5.5`** → nur für strategisch heikle Entscheidungen, finale Produkt-/Methodik-Entscheidungen oder wenn mehrere Lösungswege gegeneinander abgewogen werden müssen

---

## P0 — Jetzt zuerst

### #0 Fix 20-nutrient mismatch and result consistency
**Problem:** Die Seite kommuniziert 20 Nährstoffe, der aktuelle Code zählt aber nur 19. Zusätzlich gibt es kleine Inkonsistenzen in der Logik (z. B. `vitaminK2`-Reason prüft auf einen `nie`-Wert, den es bei Frage 12 nicht gibt).
**Aufgabe:** Align copy, scoring model, result rendering and helper logic so the page consistently supports the intended nutrient set.
**Akzeptanzkriterien:**
- Exactly 20 nutrients are defined, scored, and rendered
- Result copy matches the actual implementation
- Helper logic (`getReason`, dossier links, labels) has no dead branches / stale values
- Quick manual QA for at least 3 answer paths
**Aufwand:** M | **Impact:** H | **Priorität:** P0-A
**Modell:** `claude-code-sonnet-4.6`
**Warum dieses Modell?** Cross-cutting logic + QA-sensitive consistency task.

---

### #1 Explain nutrient result cards
**Problem:** Results show risk, but users may not understand why.
**Aufgabe:** Add an explainable card for each high/medium-risk nutrient.
**Akzeptanzkriterien:**
- Show risk level, short reason, contributing answers, and next step
- Example: "Vitamin B12: erhöhtes Risiko, weil vegane Ernährung angegeben wurde."
- Link each nutrient to its Wirkstoff-Dossier where available
**Aufwand:** M | **Impact:** H | **Priorität:** P0-B
**Modell:** `gpt-5.3-codex`
**Warum dieses Modell?** Klar abgegrenzter Frontend-/Rendering-Task mit etwas Logik, aber ohne große Architekturarbeit.

---

### #2 Soften diagnostic-sounding headline copy
**Problem:** "bei welchen Mikronährstoffen und Supplements du möglicherweise unterversorgt bist" can imply deficiency detection.
**Aufgabe:** Reword intro and result copy to emphasize risk estimation.
**Suggested copy:**
> "Wir schätzen, bei welchen Mikronährstoffen ein erhöhtes Risiko für eine unzureichende Versorgung bestehen könnte."
**Akzeptanzkriterien:**
- Avoid "du bist unterversorgt" wording
- Use "Risiko", "Hinweis", "Schätzung", "keine Diagnose"
- Headline, intro, result intro, and footer disclaimer use one consistent framing
**Aufwand:** S | **Impact:** H | **Priorität:** P0-C
**Modell:** `gpt-5.1-mini`
**Warum dieses Modell?** Reiner Copy-/Messaging-Task.

---

### #3 Make privacy promise more visible
**Problem:** Local processing is a strong trust signal but hidden inside the disclaimer.
**Aufgabe:** Add a privacy badge above question 1.
**Akzeptanzkriterien:**
- Copy: "🔒 Deine Antworten bleiben lokal im Browser und werden nicht an MikroScore übermittelt."
- Link to Datenschutz
- Repeat briefly near the result
**Aufwand:** S | **Impact:** H | **Priorität:** P0-D
**Modell:** `gpt-5.1-mini`
**Warum dieses Modell?** Kleine, klar definierte UI-/Copy-Ergänzung.

---

### #4 Improve unanswered-question validation
**Problem:** The page says "Beantworte alle 15 Fragen", but does not clearly guide users to missing answers.
**Aufgabe:** Add accessible validation for incomplete checks.
**Akzeptanzkriterien:**
- Highlight unanswered questions
- Add "Zur nächsten unbeantworteten Frage" button
- Error text is readable by screen readers
- Progress indicator updates clearly: "12 von 15 beantwortet"
**Aufwand:** M | **Impact:** M | **Priorität:** P0-E
**Modell:** `gpt-5.3-codex`
**Warum dieses Modell?** Klassischer UX-/interaction-task im bestehenden Frontend.

---

## P1 — Danach

### #5 Add nutrient-specific next steps
**Problem:** "Was jetzt?" is useful, but generic.
**Aufgabe:** Show next steps per nutrient and risk level.
**Akzeptanzkriterien:**
- Low risk: maintain diet / monitor
- Medium risk: read dossier / check food sources
- High risk: consider blood test or medical clarification
- Product comparison is secondary, not the first action
**Aufwand:** M | **Impact:** H | **Priorität:** P1-A
**Modell:** `claude-code-sonnet-4.6`
**Warum dieses Modell?** Personalisierte Ergebnislogik mit UX-Priorisierung statt reinem Copy-Swap.

---

### #6 Expand lab-marker guidance
**Problem:** Ferritin, 25-OH-Vitamin D, and Holotranscobalamin are listed, but not mapped to specific nutrients.
**Aufgabe:** Add "Welche Blutwerte passen zu welchem Nährstoff?"
**Akzeptanzkriterien:**
- Vitamin D → 25-OH-Vitamin D
- Iron → Ferritin, with context note
- B12 → Holotranscobalamin / B12 markers
- Include disclaimer: "ärztlich abklären lassen"
**Aufwand:** S | **Impact:** M | **Priorität:** P1-B
**Modell:** `gpt-5.1-mini`
**Warum dieses Modell?** Vor allem strukturierte Content-/UI-Ergänzung.

---

### #7 Add confidence scoring
**Problem:** Users may overinterpret a 0–10 radar score.
**Aufgabe:** Add confidence level to the result.
**Akzeptanzkriterien:**
- Show "Aussagekraft: niedrig / mittel / hoch"
- Lower confidence if many proxy questions are uncertain or missing nuance
- Explain limitations: no blood values, no portion sizes, no medical history depth
**Aufwand:** M | **Impact:** M | **Priorität:** P1-C
**Modell:** `claude-code-sonnet-4.6`
**Warum dieses Modell?** Neue Meta-Logik über dem bestehenden Score, potenziell mit Auswirkungen auf mehrere UI-Bausteine.

---

### #8 Add food-first recommendations
**Problem:** The current flow can lead quickly from risk to supplements/products.
**Aufgabe:** Add food-first guidance before supplement CTAs.
**Akzeptanzkriterien:**
- For each nutrient, show relevant food sources first
- Vegan/vegetarian-specific alternatives where relevant
- Keep product comparison as optional next step
**Aufwand:** M | **Impact:** M | **Priorität:** P1-D
**Modell:** `gpt-5.3-codex`
**Warum dieses Modell?** Bestehende Result-UI ausbauen, ohne das Scoring selbst stark zu verändern.

---

### #9 Add primary personalized CTA
**Problem:** The result section offers multiple next actions, but not the single best next action for this user.
**Aufgabe:** Introduce one primary CTA based on the top risk signal.
**Akzeptanzkriterien:**
- One prominent CTA above generic next steps
- CTA adapts to top nutrient (e.g. dossier, blood test, food-first guidance)
- Product comparison is never the default CTA for high-risk results
**Aufwand:** M | **Impact:** H | **Priorität:** P1-E
**Modell:** `gpt-5.3-codex`
**Warum dieses Modell?** Gute Mischung aus UI + straightforward conditional rendering.

---

## P2 — Später

### #10 Add "unsure / not applicable" answer options
**Problem:** Some questions are binary, e.g. medication use or statins.
**Aufgabe:** Add uncertainty options to medication and demographic questions.
**Akzeptanzkriterien:**
- Add "Ich bin unsicher" where appropriate
- Add "Trifft nicht zu" where appropriate
- Uncertain answers reduce confidence rather than forcing a risk assumption
**Aufwand:** M | **Impact:** L | **Priorität:** P2-A
**Modell:** `claude-code-sonnet-4.6`
**Warum dieses Modell?** Greift in Fragenmodell, Scoring und künftige Confidence-Logik ein.

---

### #11 Improve question grouping
**Problem:** 15 questions jump between diet, lifestyle, medication, and demographics.
**Aufgabe:** Group questions into labeled sections.
**Akzeptanzkriterien:**
- Sections: Ernährung / Lifestyle / Medikamente / Person & Lebensphase
- Progress shown per section or overall
**Aufwand:** M | **Impact:** M | **Priorität:** P2-B
**Modell:** `gpt-5.3-codex`
**Warum dieses Modell?** Struktureller Frontend-Task, aber noch kein tiefer Produktumbau.

---

### #12 Add result export as PDF
**Problem:** Users may want to discuss results with a doctor.
**Aufgabe:** Add local-only export.
**Akzeptanzkriterien:**
- "Ergebnis kopieren" button
- "Als PDF speichern" via browser print
- Include timestamp and disclaimer
- No server-side storage
**Aufwand:** S | **Impact:** M | **Priorität:** P2-C
**Modell:** `gpt-5.3-codex`
**Warum dieses Modell?** Konkreter UI-/browser-flow task.

---

### #13 Add method/FAQ section below the tool
**Problem:** Users may not understand how the score is derived, and the page leaves SEO value on the table.
**Aufgabe:** Add a compact methodology/FAQ section below the checker.
**Akzeptanzkriterien:**
- Explain that the tool estimates relative risk, not deficiency
- Explain what the model uses and what it does not use
- Add short FAQ blocks for reliability, blood tests, and limitations
- Internal links to relevant dossiers where useful
**Aufwand:** M | **Impact:** M | **Priorität:** P2-D
**Modell:** `gpt-5.5`
**Warum dieses Modell?** Strategische Content-/trust layer mit methodischer und YMYL-naher Formulierung.

---

## Empfohlene Umsetzungsreihenfolge

1. #0 Fix 20-nutrient mismatch and result consistency — `claude-code-sonnet-4.6`
2. #2 Soften diagnostic-sounding headline copy — `gpt-5.1-mini`
3. #3 Make privacy promise more visible — `gpt-5.1-mini`
4. #1 Explain nutrient result cards — `gpt-5.3-codex`
5. #4 Improve unanswered-question validation — `gpt-5.3-codex`
6. #5 Add nutrient-specific next steps — `claude-code-sonnet-4.6`

## Quick take

Wenn wir streng auf ROI + Risiko schauen:
- **Sonnet 4.6** für alles, was Scoring-/Ergebnislogik berührt
- **GPT-5.3 Codex** für fokussierte Frontend-Umsetzungen
- **GPT-5.1 mini** für Copy-/Trust-Polish
- **GPT-5.5** nur für Methodik-/Trust-/Strategie-Texte, wo wir extra Sorgfalt wollen
