import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString: string;
  };
}

export async function onRequestGet(context?: { request: Request; env: Env }): Promise<Response> {
  const request = context?.request;
  const env = context?.env;

  const url = request ? new URL(request.url) : null;
  const checkDb = url?.searchParams.get('check_db') === 'true';

  let dbStatus: 'connected' | 'not_configured' | 'error' = 'not_configured';
  let dbLatencyMs: number | null = null;
  const dbUrl = env?.HYPERDRIVE?.connectionString || env?.DATABASE_URL;

  if (checkDb && dbUrl) {
    const startTime = Date.now();
    try {
      const sql = neon(dbUrl);
      await sql`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  } else if (dbUrl) {
    dbStatus = 'connected';
  }

  // Identifica o data center / PoP da Cloudflare mais próximo
  const cf = (request as any)?.cf;
  const edgeNode = cf?.colo ? `${cf.colo} (${cf.country || 'BR'})` : 'sa-east-1';

  return new Response(
    JSON.stringify({
      ok: true,
      status: 'online',
      edge_node: edgeNode,
      db_status: dbStatus,
      db_latency_ms: dbLatencyMs,
      using_hyperdrive: Boolean(env?.HYPERDRIVE?.connectionString),
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
