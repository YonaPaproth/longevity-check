import { getCollection } from 'astro:content';
import { compositeScore } from '../../utils/scoring';

export async function GET() {
  const products = await getCollection('products');

  const data = products.map(entry => {
    const d = entry.data;
    const score = compositeScore(d.ratings);
    return {
      product_id: d.slug,
      name: d.title,
      brand: d.vendor,
      slug: d.slug,
      ingredientId: d.ingredient,
      priceEur: d.priceEur,
      servings: d.servingsPerPack,
      pricePerDay: d.pricePerDayEur,
      doseMg: d.doseMg,
      form: d.form,
      certifications: d.certifications,
      transparencyScore: parseFloat(score.toFixed(2)),
      verdict: d.verdict,
      summary: d.summary,
      availableInDE: d.availableInDE,
      publishedAt: d.publishedAt,
      updatedAt: d.updatedAt ?? null,
      url: `https://mikroscore.com/produkte/${d.slug}`,
    };
  }).sort((a, b) => b.transparencyScore - a.transparencyScore);

  return new Response(JSON.stringify({ products: data }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
