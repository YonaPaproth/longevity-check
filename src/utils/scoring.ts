type Ratings = {
  evidenceForIngredient: { score: number };
  valueForMoney:         { score: number };
  productQuality:        { score: number };
  labelHonesty:          { score: number };
  thirdPartyTesting:     { score: number };
};

const WEIGHTS = {
  evidenceForIngredient: 0.10,
  valueForMoney:         0.30,
  productQuality:        0.25,
  labelHonesty:          0.20,
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

export { WEIGHTS };
