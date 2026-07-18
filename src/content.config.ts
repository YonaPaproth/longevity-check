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
    category: z.enum(['nad-precursors', 'senolytics', 'antioxidants', 'adaptogens', 'metabolic', 'cognitive', 'hormonal', 'general-health', 'other']),
    summary: z.string().max(200),
    evidenceLevel,
    evidenceSummary: z.string(),
    efsa_health_claims_allowed: z.boolean(),
    efsa_notes: z.string().optional(),
    safety_rating: z.enum(['safe', 'likely-safe', 'caution', 'insufficient-data']),
    typical_dose_mg: z.number().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    // New canonical study reference field for KG-backed study entities.
    // Keep key_studies temporarily for backward compatibility during migration.
    keyStudyIds: z.array(z.string()).max(10).optional(),
    key_studies: z.array(z.object({
      title: z.string(),
      authors: z.string(),
      year: z.number(),
      pmid: z.string().optional(),
      url: z.string().url().optional(),
      finding: z.string(),
    })).max(10).optional(),
  }),
});

// ── Product collection ────────────────────────────────────────────────────────

const products = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    slug,
    ingredient: z.string(),
    containedIngredients: z.array(z.object({
      slug: z.string(),
    })).optional(),
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
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
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
    // KG-backed study references for claim pages. Keep sources for non-study references
    // and mixed migration states.
    studyIds: z.array(z.string()).max(10).optional(),
    claimContext: z.object({
      claimEntityId: z.string().optional(),
      ingredientEvidenceScore: z.number().min(0).max(10).optional(),
      animalEvidence: z.enum(['positiv', 'gemischt', 'begrenzt', 'negativ', 'keine-daten']).optional(),
      humanEvidence: z.enum(['stark', 'moderat', 'begrenzt', 'negativ', 'keine-daten']).optional(),
      regulatoryStatus: z.string().optional(),
      relatedMechanisms: z.array(z.string()).optional(),
      relatedSymptoms: z.array(z.string()).optional(),
      relatedIngredients: z.array(z.string()).optional(),
    }).optional(),
    sources: z.array(z.object({
      label: z.string(),
      url: z.string().url(),
    })),
  }),
});

// ── English content collections ───────────────────────────────────────────────
// Parallel collections for the /en site section.
// Schemas are identical to the DE versions; enum values (verdicts, etc.) are
// code identifiers — display strings are resolved via src/i18n/.

const enIngredients = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/en/ingredients' }),
  schema: z.object({
    title: z.string(),
    slug,
    aliases: z.array(z.string()),
    category: z.enum(['nad-precursors', 'senolytics', 'antioxidants', 'adaptogens', 'metabolic', 'cognitive', 'hormonal', 'general-health', 'other']),
    summary: z.string().max(200),
    evidenceLevel,
    evidenceSummary: z.string(),
    efsa_health_claims_allowed: z.boolean(),
    efsa_notes: z.string().optional(),
    safety_rating: z.enum(['safe', 'likely-safe', 'caution', 'insufficient-data']),
    typical_dose_mg: z.number().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    keyStudyIds: z.array(z.string()).max(10).optional(),
    key_studies: z.array(z.object({
      title: z.string(),
      authors: z.string(),
      year: z.number(),
      pmid: z.string().optional(),
      url: z.string().url().optional(),
      finding: z.string(),
    })).max(10).optional(),
  }),
});

const enProducts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/en/products' }),
  schema: z.object({
    title: z.string(),
    slug,
    ingredient: z.string(),
    containedIngredients: z.array(z.object({
      slug: z.string(),
    })).optional(),
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
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }),
});

const enClaims = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/en/claims' }),
  schema: z.object({
    title: z.string(),
    slug,
    ingredient: z.string().optional(),
    verdict: z.enum(['belegt', 'uebertrieben', 'falsch', 'zu-frueh']),
    verdictNote: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    summary: z.string().max(200),
    studyIds: z.array(z.string()).max(10).optional(),
    claimContext: z.object({
      claimEntityId: z.string().optional(),
      ingredientEvidenceScore: z.number().min(0).max(10).optional(),
      animalEvidence: z.enum(['positiv', 'gemischt', 'begrenzt', 'negativ', 'keine-daten']).optional(),
      humanEvidence: z.enum(['stark', 'moderat', 'begrenzt', 'negativ', 'keine-daten']).optional(),
      regulatoryStatus: z.string().optional(),
      relatedMechanisms: z.array(z.string()).optional(),
      relatedSymptoms: z.array(z.string()).optional(),
      relatedIngredients: z.array(z.string()).optional(),
    }).optional(),
    sources: z.array(z.object({
      label: z.string(),
      url: z.string().url(),
    })),
  }),
});

const researchReview = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/research-review' }),
  schema: z.object({
    title: z.string(),
    slug,
    publishedAt: z.coerce.date(),
    summary: z.string().max(220),
    status: z.enum(['draft', 'published', 'experimental']).default('draft'),
    tags: z.array(z.string()).default([]),
  }),
});

const enResearchReview = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/en/research-review' }),
  schema: z.object({
    title: z.string(),
    slug,
    publishedAt: z.coerce.date(),
    summary: z.string().max(220),
    status: z.enum(['draft', 'published', 'experimental']).default('draft'),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { ingredients, products, claims, enIngredients, enProducts, enClaims, researchReview, enResearchReview };
