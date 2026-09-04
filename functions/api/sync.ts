/**
 * Cloudflare Pages Function: /api/sync
 * Sincronizador transacional em lote para persistência no Neon PostgreSQL (ecossistema FisioFlow).
 */
import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL?: string;
  SYNC_SECRET?: string;
}

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidUuid(val?: string | null): string {
  if (val && UUID_REGEX.test(val)) {
    return val;
  }
  return crypto.randomUUID();
}

function formatDateYMD(val?: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const clean = val.trim().split('T')[0].split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return String(val);
}

/**
 * Limpa e higieniza o número de telefone para WhatsApp (DDD + dígitos, ex: 11987654321).
 * Remove o código de país 55 caso venha com 12 ou 13 dígitos.
 */
export function sanitizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const body = (await request.json()) as {
      action?: string;
      organization_id?: string;
      participantes?: any[];
      eventos?: any[];
      sync_timestamp?: string;
      contato_telefone?: string;
      participante_nome?: string;
      evento_id?: string;
      evento_nome?: string;
      novo_estagio?: string;
      template_name?: string;
      mensagem_texto?: string;
    };

    const bodyOrgId = (body.organization_id && UUID_REGEX.test(body.organization_id))
      ? body.organization_id
      : (body.participantes?.[0]?.organization_id && UUID_REGEX.test(body.participantes[0].organization_id)
        ? body.participantes[0].organization_id
        : DEFAULT_ORG_ID);

    // Tratamento de ação direta: disparo de template WhatsApp ou avanço de estágio no CRM
    if (body.action === 'send_template' || body.action === 'update_lead_stage') {
      const cleanPhone = sanitizePhoneDigits(body.contato_telefone);
      const novoEstagio = body.novo_estagio || 'em_contato';
      let updatedLeadId: string | null = null;
      let contactId: string | null = null;

      if (env.DATABASE_URL && cleanPhone) {
        const sql = neon(env.DATABASE_URL);
        try {
          // Localiza o lead e atualiza o estágio no CRM
          const leadRows = await sql`
            SELECT id, contact_id, estagio FROM leads
            WHERE organization_id = ${bodyOrgId}
              AND (
                telefone = ${cleanPhone}
                OR telefone = ${'55' + cleanPhone}
                OR telefone = ${cleanPhone.replace(/^55/, '')}
              )
            ORDER BY created_at DESC
            LIMIT 1
          `;

          if ((leadRows as any[]).length > 0) {
            const lead = (leadRows as any[])[0];
            updatedLeadId = lead.id;
            contactId = lead.contact_id;

            await sql`
              UPDATE leads
              SET estagio = ${novoEstagio}, updated_at = NOW()
              WHERE id = ${lead.id}
            `;
          }

          // Se fornecida mensagem, registra o histórico na tabela wa_messages do FisioFlow
          if (body.mensagem_texto) {
            try {
              await sql`
                INSERT INTO wa_messages (
                  id, organization_id, contact_id, direction, sender_type, message_type,
                  template_name, content, metadata, created_at
                ) VALUES (
                  ${crypto.randomUUID()},
                  ${bodyOrgId},
                  ${contactId},
                  'outbound',
                  'system',
                  'template',
                  ${body.template_name || 'pos_evento_parceria_v2'},
                  ${JSON.stringify({ text: body.mensagem_texto })}::jsonb,
                  ${JSON.stringify({
                    evento_id: body.evento_id,
                    evento_nome: body.evento_nome,
                    destinatario_nome: body.participante_nome,
                    destinatario_telefone: cleanPhone,
                    disparo_kiosk: true
                  })}::jsonb,
                  NOW()
                )
              `;
            } catch (msgErr) {
              console.warn('Aviso: Não foi possível registrar em wa_messages:', msgErr);
            }
          }
        } catch (dbErr) {
          console.warn('Erro ao atualizar estágio do lead no Neon:', dbErr);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: body.action,
          lead_id: updatedLeadId,
          estagio: novoEstagio,
          contato_telefone: cleanPhone,
          message_logged: !!body.mensagem_texto,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const participantes = body.participantes || [];
    const eventos = body.eventos || [];

    if (participantes.length === 0 && eventos.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          processed_count: 0,
          synced_count: 0,
          synced_leads: 0,
          synced_eventos: 0,
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    let syncedLeadsCount = 0;

    // Se DATABASE_URL estiver configurada no Cloudflare Pages / Workers
    if (env.DATABASE_URL) {
      const sql = neon(env.DATABASE_URL);

      // Mapa para converter ids de eventos caso venham em formatos legados e cache de nomes
      const eventIdMap = new Map<string, string>();
      const eventNamesMap = new Map<string, string>();

      // Carrega eventos existentes para mapear nome da corrida no interesse/metadata dos leads
      try {
        const existingEventRows = await sql`
          SELECT id, nome FROM eventos WHERE organization_id = ${bodyOrgId}
        `;
        for (const row of existingEventRows as any[]) {
          if (row.id && row.nome) {
            eventNamesMap.set(row.id, row.nome);
          }
        }
      } catch (err) {
        console.warn('Não foi possível pré-carregar eventos existentes:', err);
      }

      // 1. Sincroniza eventos primeiro em paralelo
      await Promise.all(
        eventos.map(async (ev) => {
          if (!ev.id || !ev.nome) return;
          const validEventId = ensureValidUuid(ev.id);
          eventIdMap.set(ev.id, validEventId);
          eventNamesMap.set(validEventId, ev.nome);

          const orgId = ensureValidUuid(ev.organization_id || bodyOrgId);
          const dataInicio = ev.data_inicio ? ev.data_inicio.split('T')[0] : null;

          await sql`
            INSERT INTO eventos (
              id, organization_id, nome, data_inicio, local, descricao, gratuito, status, created_at, updated_at
            ) VALUES (
              ${validEventId},
              ${orgId},
              ${ev.nome},
              ${dataInicio},
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
              descricao = EXCLUDED.descricao,
              updated_at = NOW();
          `;
        })
      );

      // Pré-garante a criação única dos eventos referenciados pelos participantes (evita queries redundantes em loop)
      const uniqueEventoIds = new Set<string>();
      for (const p of participantes) {
        if (p.evento_id) {
          const mapped = eventIdMap.get(p.evento_id) || ensureValidUuid(p.evento_id);
          uniqueEventoIds.add(mapped);
        }
      }

      await Promise.all(
        Array.from(uniqueEventoIds).map(async (mappedEventoId) => {
          const orgId = bodyOrgId;
          const defaultEventName = eventNamesMap.get(mappedEventoId) || 'Evento Totem Geral';
          await sql`
            INSERT INTO eventos (id, organization_id, nome, status, gratuito, created_at, updated_at)
            VALUES (${mappedEventoId}, ${orgId}, ${defaultEventName}, 'ativo', true, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `;
          if (!eventNamesMap.has(mappedEventoId)) {
            eventNamesMap.set(mappedEventoId, defaultEventName);
          }
        })
      );

      // 2. Sincroniza participantes e CRM sequencialmente para garantir idempotência intra-lote
      for (const p of participantes) {
        if (!p.id || !p.nome) continue;
          const validParticipantId = ensureValidUuid(p.id);
          const mappedEventoId = eventIdMap.get(p.evento_id) || ensureValidUuid(p.evento_id);
          const orgId = ensureValidUuid(p.organization_id || bodyOrgId);
          const eventNome = eventNamesMap.get(mappedEventoId) || 'Evento Totem Geral';

          const aceitouLgpd = p.aceitou_comunicado !== undefined && p.aceitou_comunicado !== null
            ? Boolean(p.aceitou_comunicado)
            : true;
          const obsFormatada = p.observacoes 
            ? `${p.observacoes} | LGPD: ${aceitouLgpd ? 'SIM' : 'NÃO'}`
            : `Cadastro Totem | LGPD: ${aceitouLgpd ? 'SIM' : 'NÃO'}`;

          await sql`
            INSERT INTO participantes (
              id, organization_id, evento_id, nome, contato, instagram, segue_perfil, aceitou_comunicado, observacoes, created_at, updated_at
            ) VALUES (
              ${validParticipantId},
              ${orgId},
              ${mappedEventoId},
              ${p.nome},
              ${p.contato ?? null},
              ${p.instagram ?? null},
              ${Boolean(p.segue_perfil)},
              ${aceitouLgpd},
              ${obsFormatada},
              ${p.created_at ? new Date(p.created_at) : new Date()},
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              contato = EXCLUDED.contato,
              instagram = EXCLUDED.instagram,
              segue_perfil = EXCLUDED.segue_perfil,
              aceitou_comunicado = EXCLUDED.aceitou_comunicado,
              observacoes = EXCLUDED.observacoes,
              updated_at = NOW();
          `;

          // 3. Higienização do telefone WhatsApp e resolução de Contato
          const cleanPhone = sanitizePhoneDigits(p.contato);
          if (!cleanPhone) continue;

          let contactId: string | null = null;
          const existingContacts = await sql`
            SELECT id, organization_id, telefone, lifecycle_stage 
            FROM contacts 
            WHERE organization_id = ${orgId} AND telefone = ${cleanPhone}
            LIMIT 1
          `;

          if (existingContacts && existingContacts.length > 0) {
            contactId = (existingContacts[0] as any).id;
          } else {
            const newContactId = crypto.randomUUID();
            const contactRows = await sql`
              INSERT INTO contacts (
                id, organization_id, nome, telefone, lifecycle_stage, created_at, updated_at
              ) VALUES (
                ${newContactId},
                ${orgId},
                ${p.nome},
                ${cleanPhone},
                'lead',
                NOW(),
                NOW()
              )
              ON CONFLICT (organization_id, telefone) DO UPDATE SET
                nome = EXCLUDED.nome,
                updated_at = NOW()
              RETURNING id, organization_id, nome, telefone, lifecycle_stage;
            `;
            contactId = (contactRows && (contactRows[0] as any)?.id) || newContactId;
          }

          // 4. Ingestão Atômica no CRM (tabela leads) com atribuição de corrida
          const leadInteresse = `Atendimento de Massagem Esportiva - ${eventNome}`;
          const leadMetadata = {
            evento_id: mappedEventoId,
            evento_nome: eventNome,
            categoria: 'corrida',
            segue_perfil: Boolean(p.segue_perfil),
            totem_kiosk: true,
          };

          const candidateLeads = await sql`
            SELECT id, organization_id, nome, telefone, origem, estagio, interesse, contact_id, metadata
            FROM leads
            WHERE telefone = ${cleanPhone}
          `;

          const existingLead = (candidateLeads as any[]).find((l: any) => {
            if (l.organization_id !== orgId || l.telefone !== cleanPhone) {
              return false;
            }
            let meta: any = {};
            if (typeof l.metadata === 'object' && l.metadata !== null) {
              meta = l.metadata;
            } else if (typeof l.metadata === 'string') {
              try {
                meta = JSON.parse(l.metadata);
              } catch {
                meta = {};
              }
            }

            const eventIdMatches = Boolean(meta.evento_id && mappedEventoId && meta.evento_id === mappedEventoId);
            const interesseMatches = Boolean(l.interesse && eventNome && l.interesse.includes(eventNome));

            return eventIdMatches || interesseMatches || (!meta.evento_id && !mappedEventoId);
          });

          if (existingLead) {
            await sql`
              UPDATE leads SET
                nome = ${p.nome},
                interesse = ${leadInteresse},
                contact_id = ${contactId},
                metadata = ${JSON.stringify(leadMetadata)}::jsonb,
                updated_at = NOW()
              WHERE id = ${existingLead.id}
            `;
            syncedLeadsCount++;
          } else {
            const newLeadId = crypto.randomUUID();
            await sql`
              INSERT INTO leads (
                id,
                organization_id,
                nome,
                telefone,
                origem,
                estagio,
                interesse,
                contact_id,
                metadata,
                created_at,
                updated_at
              ) VALUES (
                ${newLeadId},
                ${orgId},
                ${p.nome},
                ${cleanPhone},
                ${'totem_corrida'},
                ${'aguardando'},
                ${leadInteresse},
                ${contactId},
                ${JSON.stringify(leadMetadata)}::jsonb,
                NOW(),
                NOW()
              );
            `;
            syncedLeadsCount++;
          }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed_count: participantes.length,
        synced_count: participantes.length,
        synced_leads: syncedLeadsCount,
        synced_eventos: eventos.length,
        errors: [],
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

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const requestedOrg = url.searchParams.get('organization_id');
    const orgId = requestedOrg && UUID_REGEX.test(requestedOrg) ? requestedOrg : DEFAULT_ORG_ID;

    if (!env.DATABASE_URL) {
      return new Response(
        JSON.stringify({
          ok: true,
          eventos: [],
          funnel_stats: {},
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    const sql = neon(env.DATABASE_URL);

    // Query Neon PostgreSQL table eventos for organization_id and (status = 'ativo' OR status IS NULL)
    const rows = await sql`
      SELECT 
        id,
        organization_id,
        nome,
        descricao,
        categoria,
        local,
        data_inicio,
        data_fim,
        hora_inicio,
        hora_fim,
        gratuito,
        link_whatsapp,
        status,
        participantes_previstos,
        created_at,
        updated_at
      FROM eventos
      WHERE organization_id = ${orgId}
        AND (status = 'ativo' OR status IS NULL)
      ORDER BY data_inicio ASC
    `;

    const formattedEventos = rows.map((r: any) => ({
      id: ensureValidUuid(r.id),
      organization_id: r.organization_id || orgId,
      nome: r.nome,
      descricao: r.descricao ?? undefined,
      categoria: r.categoria ?? undefined,
      local: r.local ?? undefined,
      data_inicio: formatDateYMD(r.data_inicio) || new Date().toISOString().split('T')[0],
      data_fim: formatDateYMD(r.data_fim) ?? undefined,
      hora_inicio: r.hora_inicio ?? undefined,
      hora_fim: r.hora_fim ?? undefined,
      gratuito: r.gratuito !== undefined ? Boolean(r.gratuito) : true,
      link_whatsapp: r.link_whatsapp ?? undefined,
      status: (r.status || 'ativo') as 'ativo' | 'concluido' | 'rascunho',
      participantes_previstos: r.participantes_previstos ? Number(r.participantes_previstos) : undefined,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at || new Date().toISOString()),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : (r.updated_at || new Date().toISOString()),
    }));

    // Funnel stats aggregation if leads table has data for this organization
    let funnelStats: Record<string, { atendidos: number; em_contato: number; convertidos: number }> = {};
    try {
      const leadStats = await sql`
        SELECT 
          metadata->>'evento_id' as evento_id,
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE estagio IN ('em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado')) as em_contato,
          COUNT(*) FILTER (WHERE estagio = 'efetivado') as convertidos
        FROM leads
        WHERE organization_id = ${orgId} AND metadata->>'evento_id' IS NOT NULL
        GROUP BY metadata->>'evento_id'
      `;
      for (const s of leadStats) {
        if (s.evento_id) {
          funnelStats[s.evento_id] = {
            atendidos: Number(s.total_leads || 0),
            em_contato: Number(s.em_contato || 0),
            convertidos: Number(s.convertidos || 0),
          };
        }
      }
    } catch {
      // Ignora erro caso tabela leads não possua metadata estruturado ainda
    }

    return new Response(
      JSON.stringify({
        ok: true,
        eventos: formattedEventos,
        funnel_stats: funnelStats,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (err: any) {
    console.error('Erro na rota GET /api/sync:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || 'Falha ao buscar eventos no Neon',
        eventos: [],
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Totem-Sync-Version',
    },
  });
}

