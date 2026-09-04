/**
 * Cloudflare Pages Function: /api/health
 * Endpoint leve de health-check e medição de latência real para o iPad Totem.
 */

export async function onRequestGet(): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
      status: 'online',
      edge_node: 'sa-east-1',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export async function onRequestHead(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
