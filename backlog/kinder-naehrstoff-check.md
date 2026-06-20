# Backlog: Nährstoff-Check für Kleinkinder & Kinder

## Idee
Ein spezialisierter Check (wie der Ernährungs-Check und Vegan-Check) für Eltern, die wissen wollen, ob die Ernährung ihres Kindes alle wichtigen Nährstoffe abdeckt.

## Zielgruppe
- Eltern von Kleinkindern (1–3 Jahre)
- Eltern von Kindern (4–12 Jahre)
- Optional: Jugendliche (13–17)

## Mögliche Fragen
- Altersgruppe des Kindes
- Ernährungstyp (alles, vegetarisch, vegan, picky eater)
- Milchprodukte ja/nein, Menge
- Fisch ja/nein
- Obst/Gemüse-Vielfalt
- Sonnenlicht-Exposition
- Stillen / Formulanahrung (bei Kleinkindern)
- Bekannte Allergien/Unverträglichkeiten

## Relevante Nährstoffe für Kinder
- **Kritisch:** Vitamin D, Eisen, Jod, Omega-3 (DHA), Calcium
- **Bei Vegetariern/Veganern:** B12, Zink, Protein
- **Häufig unterschätzt:** Vitamin A, Folsäure, Selen
- **Picky Eaters:** Breitband-Mikronährstoffmangel

## Regulatorik
- EFSA-Referenzwerte für Kinder beachten (PRI/AI nach Altersgruppe)
- Dosierungen MÜSSEN altersgerecht sein (keine Erwachsenen-Dosierungen!)
- Disclaimer: "Kein Ersatz für kinderärztliche Beratung"
- BfR Höchstmengenempfehlungen für Kinder-Supplements

## Integration
- Neuer Eintrag in `checks.items` (i18n/de.ts + en.ts)
- Route: `/kinder-check` / `/en/children-check`
- Navbar: unter "Checks" Dropdown

## SEO-Potenzial
- "Nährstoffe Kinder" / "Vitamine Kinder" / "Vitamin D Kinder"
- "welche Vitamine brauchen Kinder" — hohes Suchvolumen
- "picky eater Nährstoffmangel"

## Abgrenzung
- Wir empfehlen KEINE konkreten Produkte für Kinder (Haftungsrisiko)
- Fokus: Aufklärung + Risiko-Einschätzung → "sprich mit dem Kinderarzt"
- Verlinkung zu unseren Wirkstoff-Dossiers für Hintergrundinfo

## Priorität
Mittel — nach den 3 fehlenden Marken (ZeinPharma, Orthomol, Sunday Natural) und Phase 1 Ontology
