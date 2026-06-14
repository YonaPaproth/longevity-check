import { getCollection } from 'astro:content';

export async function GET() {
  const products = await getCollection('enProducts');
  const deProducts = await getCollection('products');

  // Merge: use EN if available, fall back to DE
  const allProducts = [...deProducts].map(p => {
    const en = products.find(ep => ep.data.slug === p.data.slug);
    const d = en?.data ?? p.data;
    return {
      slug: d.slug,
      title: d.title,
      vendor: d.vendor,
      ingredient: d.ingredient,
      containedIngredients: (d as any).containedIngredients?.map((ci: any) => ci.slug) ?? [d.ingredient],
      pricePerDayEur: d.pricePerDayEur,
      form: d.form,
      ratings: {
        evidence: d.ratings.evidenceForIngredient.score,
        value: d.ratings.valueForMoney.score,
        quality: d.ratings.productQuality.score,
      },
      summary: d.summary,
      availableInDE: d.availableInDE,
    };
  });

  return new Response(JSON.stringify(allProducts), {
    headers: { 'Content-Type': 'application/json' },
  });
}
