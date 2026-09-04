/**
 * Cloudflare Pages Function: /api/sync
 * Sincronizador transacional em lote para persistência no Neon PostgreSQL (ecossistema FisioFlow).
 */
import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL?: string;
  SYNC_SECRET?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const body = (await request.json()) as {
      participantes?: any[];
      eventos?: any[];
      sync_timestamp?: string;
    };

    const participantes = body.participantes || [];
    const eventos = body.eventos || [];

    if (participantes.length === 0 && eventos.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced_count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Se DATABASE_URL estiver configurada no Cloudflare Pages / Workers
    if (env.DATABASE_URL) {
      const sql = neon(env.DATABASE_URL);

      // 1. Sincroniza eventos primeiro (chave estrangeira)
      for (const ev of eventos) {
        if (!ev.id || !ev.nome) continue;
        await sql`
          INSERT INTO eventos (
            id, nome, data_inicio, local, descricao, gratuito, status, created_at, updated_at
          ) VALUES (
            ${ev.id},
            ${ev.nome},
            ${ev.data_inicio ? new Date(ev.data_inicio) : null},
            ${ev.local ?? null},
            ${ev.descricao ?? null},
            ${ev.gratuito ?? true},
            ${ev.status ?? 'ativo'},
            NOW(),
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            data_inicio = EXCLUDED.data_inicio,
            local = EXCLUDED.local,
            updated_at = NOW();
        `;
      }

      // 2. Sincroniza participantes com upsert idempotente
      for (const p of participantes) {
        if (!p.id || !p.nome) continue;
        await sql`
          INSERT INTO participantes (
            id, evento_id, nome, contato, instagram, segue_perfil, observacoes, created_at, updated_at
          ) VALUES (
            ${p.id},
            ${p.evento_id},
            ${p.nome},
            ${p.contato},
            ${p.instagram ?? null},
            ${Boolean(p.segue_perfil)},
            ${p.observacoes ?? null},
            ${p.created_at ? new Date(p.created_at) : new Date()},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            contato = EXCLUDED.contato,
            segue_perfil = EXCLUDED.segue_perfil,
            updated_at = NOW();
        `;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced_count: participantes.length,
        synced_eventos: eventos.length,
        persisted_to_neon: Boolean(env.DATABASE_URL),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    console.error('Erro na rota /api/sync:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || 'Falha ao sincronizar dados',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Totem-Sync-Version',
    },
  });
}
