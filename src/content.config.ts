import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ── Reusable sub-schemas ──────────────────────────────────────────────────────

const slug = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, {
  message: 'Slug darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten',
});

const ratingDimension = z.object({
  score: z.number().min(0).max(10),
  explanation: z.string(),
});

const evidenceLevel = z.enum(['1', '2', '3', '4', '5']);
// 1 = Multiple RCTs in humans, consistent
// 2 = Single RCT in humans
// 3 = Observational human studies
// 4 = Animal / in-vitro only
// 5 = No studies / testimonials only

// ── Wirkstoff-Dossier collection ─────────────────────────────────────────────

const ingredients = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/ingredients' }),
  schema: z.object({
    title: z.string(),
    slug,
    aliases: z.array(z.string()),
    category: z.enum(['nad-precursors', 'senolytics', 'antioxidants', 'adaptogens', 'metabolic', 'other']),
    summary: z.string().max(200),
    evidenceLevel,
    evidenceSummary: z.string(),
    efsa_health_claims_allowed: z.boolean(),
    efsa_notes: z.string().optional(),
    safety_rating: z.enum(['safe', 'likely-safe', 'caution', 'insufficient-data']),
    typical_dose_mg: z.number().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    key_studies: z.array(z.object({
      title: z.string(),
      authors: z.string(),
      year: z.number(),
      pmid: z.string().optional(),
      url: z.string().url().optional(),
      finding: z.string(),
    })).max(5),
  }),
});

// ── Product collection ────────────────────────────────────────────────────────

const products = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    slug,
    ingredient: z.string(),
    vendor: z.string(),
    vendorUrl: z.string().url().optional(),
    affiliateUrl: z.string().url().optional(),
    priceEur: z.number(),
    doseMg: z.number(),
    servingsPerPack: z.number(),
    pricePerDayEur: z.number(),
    featuredImage: z.string().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    summary: z.string().max(200),
    ratings: z.object({
      evidenceForIngredient: ratingDimension,
      valueForMoney:         ratingDimension,
      productQuality:        ratingDimension,
      labelHonesty:          ratingDimension,
      thirdPartyTesting:     ratingDimension,
    }),
    form: z.enum(['capsule', 'powder', 'liquid', 'gummy', 'softgel', 'tablet']).default('capsule'),
    availableInDE: z.boolean().default(true),
    lastPriceCheck: z.coerce.date().optional(),
    amazonAsin: z.string().optional(),
    iherbId: z.string().optional(),
    certifications: z.array(z.enum([
      'informed-sport', 'informed-choice', 'nsf', 'usp',
      'labdoor-verified', 'oekotest', 'stiftung-warentest',
    ])).default([]),
    verdict: z.enum(['empfehlenswert', 'akzeptabel', 'nicht-empfehlenswert']),
    verdictNote: z.string(),
  }),
});

// ── Claims-Check collection ───────────────────────────────────────────────────

const claims = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/claims' }),
  schema: z.object({
    title: z.string(),
    slug,
    ingredient: z.string().optional(),
    verdict: z.enum(['belegt', 'uebertrieben', 'falsch', 'zu-frueh']),
    verdictNote: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    summary: z.string().max(200),
    sources: z.array(z.object({
      label: z.string(),
      url: z.string().url(),
    })),
  }),
});

export const collections = { ingredients, products, claims };
