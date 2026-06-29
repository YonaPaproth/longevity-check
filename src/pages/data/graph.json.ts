import { buildFullGraph } from '../../lib/graph/builders.ts';

export async function GET() {
  const graph = buildFullGraph('de', { includeStudies: true });

  return new Response(JSON.stringify(graph, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
