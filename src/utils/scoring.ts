type Ratings = {
  evidenceForIngredient: { score: number };
  valueForMoney:         { score: number };
  productQuality:        { score: number };
  labelHonesty:          { score: number };
  thirdPartyTesting:     { score: number };
};

// Weights: quality + honesty more important; value for money reduced
// Updated 2026-07-16 (was: evidence 10, value 30, quality 25, honesty 20, testing 15)
export const WEIGHTS = {
  evidenceForIngredient: 0.15,
  valueForMoney:         0.15,
  productQuality:        0.30,
  labelHonesty:          0.25,
  thirdPartyTesting:     0.15,
};

export function compositeScore(ratings: Ratings): number {
  return (
    ratings.evidenceForIngredient.score * WEIGHTS.evidenceForIngredient +
    ratings.valueForMoney.score         * WEIGHTS.valueForMoney +
    ratings.productQuality.score        * WEIGHTS.productQuality +
    ratings.labelHonesty.score          * WEIGHTS.labelHonesty +
    ratings.thirdPartyTesting.score     * WEIGHTS.thirdPartyTesting
  );
}

// Verdict is auto-computed from score — not set manually in YAMLs
// Thresholds: ≥7.0 empfehlenswert | 5.5–6.9 akzeptabel | <5.5 nicht-empfehlenswert
// Evidence cap (2026-07-24): prevents high-quality products with weak ingredient
// evidence from being rated "empfehlenswert" (e.g., lithium with evidence score 5).
export function autoVerdict(score: number, evidenceScore?: number): 'empfehlenswert' | 'akzeptabel' | 'nicht-empfehlenswert' {
  if (evidenceScore !== undefined) {
    if (evidenceScore < 3) return 'nicht-empfehlenswert';
    if (evidenceScore <= 5) return score >= 5.5 ? 'akzeptabel' : 'nicht-empfehlenswert';
  }
  if (score >= 7.0) return 'empfehlenswert';
  if (score >= 5.5) return 'akzeptabel';
  return 'nicht-empfehlenswert';
}
