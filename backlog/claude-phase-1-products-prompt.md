# Claude Prompt — Phase 1 Product Affiliate Setup for MikroScore

You are working in the Astro project **MikroScore** at `/Users/yona/Projects/schwurbel-website`.

## Goal
Implement **Phase 1** of affiliate/product setup for the existing product review system.

Phase 1 means:
- prepare the site for affiliate links in a **safe, compliant, low-complexity way**
- use the existing **example products** as the working dataset
- **do not** build Amazon/iHerb/Shop Apotheke API integrations yet
- **do not** auto-import product images yet unless they are already safely local and explicitly present in the repo
- prefer **simple text links and structured fields** over fancy integrations

## Context
This project is:
- Astro v6
- Tailwind v4 via `@tailwindcss/vite`
- MDX content collections
- deployed on Vercel
- package manager: pnpm

Important files:
- `CLAUDE.md`
- `src/content.config.ts`
- `src/content/products/`
- `src/pages/produkte/index.astro`
- `src/pages/produkte/[slug].astro`
- `src/pages/wirkstoffe/[slug].astro`

There are already example products in `src/content/products/`, including:
- `do-not-age-nmn-500.mdx`
- `renue-by-science-nmn-500.mdx`
- `tru-niagen-nr-300.mdx`
- `thorne-berberine.mdx`
- `pure-encapsulations-magnesium.mdx`
- `norsan-omega-3-total.mdx`
- `life-extension-resveratrol.mdx`
- `doctors-best-quercetin.mdx`
- `jarrow-coq10-100.mdx`
- `jarrow-ashwagandha-ksm66.mdx`
- `fairvital-vitamin-d3-k2.mdx`

## Existing schema
The `products` collection already includes fields such as:
- `affiliateUrl` (optional)
- `featuredImage` (optional)
- `amazonAsin` (optional)
- `iherbId` (optional)
- ratings, verdict, summary, etc.

## What to build
Implement a practical **Phase 1 affiliate/product UX** with the following scope:

### 1. Product pages: affiliate CTA block
On each product detail page:
- add a clear product purchase / shop block
- if `affiliateUrl` exists, render a visible CTA like:
  - `Zum Shop`
  - or `Produkt ansehen`
- link should use:
  - `target="_blank"`
  - `rel="sponsored noopener noreferrer"`
- if no `affiliateUrl` exists, show no CTA block or a graceful fallback

### 2. Disclosure text
Add clear affiliate disclosure copy in a sensible place.
Good Phase 1 options:
- on product detail pages near the CTA
- and/or on the products overview page

Suggested meaning:
- some links may be affiliate links
- users pay no extra cost
- editorial judgment remains independent

Keep wording short, transparent, and German.

### 3. Product overview improvements
Improve the product overview page so the example products are easier to scan.
Add at least:
- vendor
- linked ingredient
- verdict badge
- price / day if available
- CTA if affiliateUrl exists

Do **not** over-engineer this.
A clean, useful list/cards UI is enough.

### 4. Product frontmatter readiness
Update the example product MDX files so they are ready for Phase 1.
For each example product, where reasonable, add placeholder or structured fields if missing, especially:
- `affiliateUrl` if available or a safe placeholder comment strategy
- `featuredImage` only if already local and valid
- `updatedAt` if you touch the file
- `lastPriceCheck` if you touch price-related data

Important:
- If you do not know the real affiliate URL, do **not invent one**.
- If needed, leave the field absent and make the UI degrade gracefully.
- You may add a short implementation note in comments or backlog if something must be filled manually later.

### 5. Keep compliance conservative
Do not do anything risky with:
- copied Amazon images
- scraped product images
- fake prices
- fake affiliate IDs
- hidden disclosure

Prefer a compliant, boring Phase 1 over a flashy risky one.

## Constraints
- Respect the schema in `src/content.config.ts`
- Do not install unnecessary dependencies
- Do not add external APIs in this phase
- Keep the UI consistent with the existing style
- Build before finishing: `pnpm build`
- Commit changes at the end

## Output expectations
Please:
1. inspect the relevant files first
2. make the minimal clean implementation for Phase 1
3. run `pnpm build`
4. summarize what was changed
5. mention any fields that still need manual affiliate URLs later

## Tone / Product philosophy
MikroScore is:
- evidence-based
- transparent
- no hype
- EU-regulatory-aware
- editorially independent

The product UX should feel trustworthy, simple, and not salesy.
