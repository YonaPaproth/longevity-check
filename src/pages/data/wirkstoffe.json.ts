import { getCollection } from 'astro:content';

export async function GET() {
  const ingredients = await getCollection('ingredients');

  const data = ingredients.map(entry => {
    const d = entry.data;
    return {
      ingredient_id: d.slug,
      name: d.title,
      slug: d.slug,
      category: d.category,
      summary: d.summary,
      evidenceLevel: parseInt(d.evidenceLevel),
      evidenceSummary: d.evidenceSummary,
      efsaClaimsAllowed: d.efsa_health_claims_allowed,
      efsaNotes: d.efsa_notes ?? null,
      safetyRating: d.safety_rating,
      typicalDoseMg: d.typical_dose_mg ?? null,
      aliases: d.aliases,
      keyStudies: d.key_studies.map(s => ({
        title: s.title,
        authors: s.authors,
        year: s.year,
        pmid: s.pmid ?? null,
        url: s.url ?? null,
        finding: s.finding,
      })),
      publishedAt: d.publishedAt,
      updatedAt: d.updatedAt ?? null,
      url: `https://mikroscore.com/wirkstoffe/${d.slug}`,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return new Response(JSON.stringify({ ingredients: data }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
