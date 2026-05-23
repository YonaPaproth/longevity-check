import { getCollection } from 'astro:content';

// Map German verdict values to standardised English keys
const verdictMap: Record<string, string> = {
  belegt: 'supported',
  uebertrieben: 'misleading',
  falsch: 'unsupported',
  'zu-frueh': 'unclear',
};

export async function GET() {
  const claims = await getCollection('claims');

  const data = claims.map(entry => {
    const d = entry.data;
    return {
      claim_id: d.slug,
      claimText: d.title,
      verdict: verdictMap[d.verdict] ?? d.verdict,
      verdictDe: d.verdict,
      reasoning: d.verdictNote,
      summary: d.summary,
      ingredientId: d.ingredient ?? null,
      references: d.sources.map(s => ({ label: s.label, url: s.url })),
      publishedAt: d.publishedAt,
      updatedAt: d.updatedAt ?? null,
      url: `https://mikroscore.com/claims/${d.slug}`,
    };
  }).sort((a, b) => a.claimText.localeCompare(b.claimText, 'de'));

  return new Response(JSON.stringify({ claims: data }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
