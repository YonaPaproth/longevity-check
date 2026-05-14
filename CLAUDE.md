# MikroScore — Projekt-Kontext für Claude

## Was ist das?

**MikroScore** (mikroscore.com) ist eine evidenzbasierte Longevity-Supplement-Bewertungsseite für den deutschen Markt. Positionierung: Finanzfluss für Supplements — kostenlos, transparent, kein Hype, EU-Regulatorik-Fokus (EFSA, BfR). Zielgruppe: DACH-Markt, später international.

Betreiber: Yona Paproth & Dr. Sarah Rahmati (Krefeld)

---

## Tech-Stack

| Was | Womit |
|-----|-------|
| Framework | **Astro v6** (static site, Content Collections) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` (NICHT `@astrojs/tailwind`) |
| Content | MDX-Dateien mit Zod-Schema-Validierung |
| Package Manager | **pnpm** |
| Deployment | **Vercel** (Auto-deploy aus GitHub `YonaPaproth/longevity-check`) |
| Analytics | **Vercel Analytics** (cookielos, in BaseLayout eingebunden) |

---

## Projektstruktur

```
src/
  content/
    ingredients/   # 41 Wirkstoff-Dossiers (MDX)
    products/      # Produkt-Reviews (MDX)
    claims/        # Claims-Checks (MDX)
  content.config.ts  # Zod-Schemas für alle Collections
  pages/
    index.astro
    wirkstoffe/index.astro   # Mit Client-Side-Filter (Kategorie, Evidenz, Suche)
    wirkstoffe/[slug].astro  # Dossier-Detail mit Produkte-Section + Check-Teaser
    produkte/index.astro
    produkte/[slug].astro
    ernaehrungs-check.astro  # 10-Fragen-Check, 6 Nährstoffe, localStorage-frei
    methodik.astro
    impressum.astro
    datenschutz.astro
  layouts/BaseLayout.astro   # Nav, Footer, Vercel Analytics
  components/
    EvidenceBadge.astro      # Evidenzstufen 1-5 (Punkte + Label)
    RatingBar.astro
    VerdictBadge.astro
  utils/scoring.ts           # compositeScore() + WEIGHTS (single source of truth)
```

---

## Content-Schema (wichtigste Felder)

### ingredients
- `category`: `nad-precursors | senolytics | antioxidants | adaptogens | metabolic | other`
- `evidenceLevel`: `'1'`–`'5'` (1 = stärkste Evidenz)
- `safety_rating`: `safe | likely-safe | caution | insufficient-data`
- `summary`: max. 200 Zeichen
- `key_studies`: max. 5 Einträge mit PMID

### products
- `ingredient`: Slug des verlinkten Wirkstoffs
- `ratings`: 5 Dimensionen (evidenceForIngredient, valueForMoney, productQuality, labelHonesty, thirdPartyTesting), je 0–10
- `verdict`: `empfehlenswert | akzeptabel | nicht-empfehlenswert`

---

## Aktueller Stand

- **41 Wirkstoff-Dossiers** live (4 Batches à 10, +NMN als erstes)
- **1 Produkt-Review**: Do Not Age NMN 500
- **1 Claims-Check**: NMN verlängert das Leben
- Ernährungs-Check: 10 Fragen, 6 Nährstoffe (Vitamin D, Omega-3, Magnesium, Eisen, Zink, B12)
- Flow: Check → Dossier → Produkte vollständig verknüpft

---

## Backlog (priorisiert)

| # | Task | Priorität |
|---|------|-----------|
| 1 | Impressum-Adresse auf e.V. oder Briefkastendienst (Digitalcourage) verlegen | niedrig |
| 2 | Affiliate-Links zu Produkten hinzufügen (Amazon.de, iHerb) — erst wenn Traffic da | niedrig |
| 3 | Wirkstoff-Merkzettel: Nutzer markiert interessante Wirkstoffe → Produkte nach Match-Score filtern (localStorage, kein Login) | mittel |

---

## Wichtige Konventionen

- **MDX in Astro v6**: `<` in Markdown muss als `&lt;` escaped werden (JSX-Parser)
- **Tailwind v4**: Kein `tailwind.config.js`, keine `@apply` mit config-Werten — nur Utility-Klassen direkt
- **Commits**: immer `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **Build vor Push**: immer `pnpm build` laufen lassen
- **Slugs**: nur `[a-z0-9-]`, keine Umlaute
- **summary-Feld**: max. 200 Zeichen (Zod validiert hart)
- **Kein `@astrojs/tailwind`** installieren — inkompatibel mit Tailwind v4
