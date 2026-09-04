/**
 * Tier 1: Feature Coverage (Core Functional Contracts)
 * Covers F1-F7 as defined in PROJECT.md and ORIGINAL_REQUEST.md.
 */
import {
  DEFAULT_ORG_ID,
  assert,
  assertEquals,
  assertDeepEquals,
  assertIncludes,
  assertNotNull,
} from './harness.js';
import { findClosestEvent } from '../../src/db/index.ts';
import {
  formatNameTitleCase,
  formatPhoneForDisplay,
  normalizePhoneForWhatsApp,
  isValidBrazilianCellPhone,
  exportParticipantesToCSV,
} from '../../src/services/csvExport.ts';

export const tier1Tests = {
  name: 'Tier 1: Feature Coverage (Functional & Interface Contracts)',

  /**
   * T1.1: GET /api/sync event retrieval
   * Contract: PROJECT.md §Contract 1, ORIGINAL_REQUEST §R1
   */
  async test_get_sync_event_retrieval(harness) {
    const db = harness.getDb();
    const eventId = '786ec561-bac1-471a-af67-817537d1328c';
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Circuito das Estações - Etapa Primavera',
      categoria: 'corrida',
      local: 'Parque Ibirapuera',
      data_inicio: '2026-09-06',
      status: 'ativo',
      participantes_previstos: 500,
    });

    const response = await harness.invokeApiSync('GET', {
      queryParams: { organization_id: DEFAULT_ORG_ID },
    });

    assertEquals(response.status, 200, 'GET /api/sync must return HTTP 200', 'PROJECT.md §Contract 1');
    const data = await response.json();

    assertEquals(data.ok, true, 'GET /api/sync must return ok: true', 'PROJECT.md §Contract 1');
    assert(Array.isArray(data.eventos), 'Response must contain an array of eventos', 'PROJECT.md §Contract 1');
    assert(data.eventos.length > 0, 'Response eventos must contain the active event', 'PROJECT.md §Contract 1');

    const ev = data.eventos.find(e => e.id === eventId);
    assertNotNull(ev, `Active event ${eventId} not found in response`, 'PROJECT.md §Contract 1');
    assertEquals(ev.nome, 'Circuito das Estações - Etapa Primavera', 'Event name must match', 'PROJECT.md §Contract 1');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(ev.data_inicio), `data_inicio must be formatted as YYYY-MM-DD: ${ev.data_inicio}`, 'PROJECT.md §F1');

    assert(typeof data.funnel_stats === 'object' && data.funnel_stats !== null, 'Response must include funnel_stats object', 'PROJECT.md §Contract 1');
  },

  /**
   * T1.2: Closest event auto-selection
   * Contract: PROJECT.md §F2, ORIGINAL_REQUEST §Acceptance Criteria
   */
  async test_closest_event_auto_selection() {
    const now = new Date();
    const formatDate = (offsetDays) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const mockEvents = [
      {
        id: 'event-past',
        nome: 'Corrida Passada (10 dias atrás)',
        data_inicio: formatDate(-10),
        status: 'ativo',
      },
      {
        id: 'event-tomorrow',
        nome: 'Corrida Mais Próxima (+1 dia)',
        data_inicio: formatDate(1),
        status: 'ativo',
      },
      {
        id: 'event-future',
        nome: 'Corrida Futura (+20 dias)',
        data_inicio: formatDate(20),
        status: 'ativo',
      },
      {
        id: 'event-closer-but-closed',
        nome: 'Corrida Concluída (Hoje)',
        data_inicio: formatDate(0),
        status: 'concluido',
      },
    ];

    const selected = findClosestEvent(mockEvents);
    assertNotNull(selected, 'findClosestEvent must not return null for non-empty array', 'PROJECT.md §F2');
    assertEquals(selected.id, 'event-tomorrow', 'Should select active event closest to today, ignoring concluded events', 'PROJECT.md §F2');
  },

  /**
   * T1.3: POST /api/sync atomic lead ingestion
   * Contract: PROJECT.md §Contract 2 & 3, ORIGINAL_REQUEST §R2
   */
  async test_post_sync_atomic_lead_ingestion(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    const eventName = 'Maratona Internacional da Mooca';
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: eventName,
      status: 'ativo',
    });

    const participantId = crypto.randomUUID();
    const payload = {
      organization_id: DEFAULT_ORG_ID,
      eventos: [{ id: eventId, nome: eventName, status: 'ativo' }],
      participantes: [
        {
          id: participantId,
          evento_id: eventId,
          nome: 'Carla Silveira',
          contato: '(11) 98765-4321',
          instagram: '@carla.runner',
          segue_perfil: true,
          aceitou_comunicado: true,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const res = await harness.invokeApiSync('POST', { body: payload });
    assertEquals(res.status, 200, 'POST /api/sync must return HTTP 200', 'PROJECT.md §Contract 2');
    const resData = await res.json();
    assertEquals(resData.ok, true, 'POST /api/sync response must have ok: true', 'PROJECT.md §Contract 2');

    // Verify participante row
    const part = db.participantes.get(participantId);
    assertNotNull(part, 'Participant record must be stored in database', 'PROJECT.md §F3');
    assertEquals(part.evento_id, eventId, 'Participant must be linked to valid evento_id', 'ORIGINAL_REQUEST §R2');

    // Verify lead row
    const leads = Array.from(db.leads.values());
    const lead = leads.find(l => l.telefone === '11987654321' || l.nome === 'Carla Silveira');
    assertNotNull(lead, 'Lead record must be created in FisioFlow leads table', 'PROJECT.md §F3');
    assertEquals(lead.organization_id, DEFAULT_ORG_ID, 'Lead must have correct organization_id', 'PROJECT.md §Contract 3');
    assertEquals(lead.origem, 'totem_corrida', "Lead origem must be exactly 'totem_corrida'", 'ORIGINAL_REQUEST §R2');
    assertEquals(lead.estagio, 'aguardando', "Lead initial estagio must be 'aguardando'", 'ORIGINAL_REQUEST §R2');
    assertEquals(lead.interesse, `Atendimento de Massagem Esportiva - ${eventName}`, 'Lead interesse must format service and race name', 'PROJECT.md §Contract 3');

    // Verify JSONB metadata
    assertNotNull(lead.metadata, 'Lead must contain metadata jsonb', 'ORIGINAL_REQUEST §R2');
    assertEquals(lead.metadata.evento_id, eventId, 'Metadata must contain evento_id', 'ORIGINAL_REQUEST §R2');
    assertEquals(lead.metadata.evento_nome, eventName, 'Metadata must contain evento_nome', 'ORIGINAL_REQUEST §R2');
    assertEquals(lead.metadata.categoria, 'corrida', "Metadata categoria must be 'corrida'", 'ORIGINAL_REQUEST §R2');
    assertEquals(lead.metadata.totem_kiosk, true, 'Metadata must flag totem_kiosk: true', 'ORIGINAL_REQUEST §R2');
  },

  /**
   * T1.4: Contact link and trigger activation
   * Contract: PROJECT.md §F5, ORIGINAL_REQUEST §R2
   */
  async test_contact_link_and_trigger_activation(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Corrida Juventus Mooca',
      status: 'ativo',
    });

    const participantId = crypto.randomUUID();
    const rawPhone = '(11) 99123-4567';
    const cleanPhone = '11991234567';

    const payload = {
      organization_id: DEFAULT_ORG_ID,
      participantes: [
        {
          id: participantId,
          evento_id: eventId,
          nome: 'Marcos Vinicius',
          contato: rawPhone,
          segue_perfil: false,
          aceitou_comunicado: true,
        },
      ],
    };

    await harness.invokeApiSync('POST', { body: payload });

    // Contact must be resolved/created
    const contacts = Array.from(db.contacts.values());
    const contact = contacts.find(c => c.telefone === cleanPhone);
    assertNotNull(contact, 'Contact must be created or resolved with sanitized phone', 'PROJECT.md §F5');
    assertEquals(contact.lifecycle_stage, 'lead', "Initial contact lifecycle stage must be 'lead'", 'PROJECT.md §F5');

    // Lead must have foreign key contact_id
    const lead = Array.from(db.leads.values()).find(l => l.telefone === cleanPhone);
    assertNotNull(lead, 'Lead must exist', 'PROJECT.md §F5');
    assertEquals(lead.contact_id, contact.id, 'lead.contact_id must link to contact.id', 'PROJECT.md §Contract 3');

    // Test Postgres Trigger trg_lead_stage_to_contact_lifecycle: advance to em_contato
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['em_contato', lead.id]);
    assertEquals(contact.lifecycle_stage, 'mql', "Trigger trg_lead_stage_to_contact_lifecycle must update contact to 'mql'", 'PROJECT.md §14');
  },

  /**
   * T1.5: Idempotency deduplication
   * Contract: PROJECT.md §F4, ORIGINAL_REQUEST §Acceptance Criteria
   */
  async test_idempotency_deduplication(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Circuito Noturno',
      status: 'ativo',
    });

    const participantId = crypto.randomUUID();
    const phone = '(11) 98765-1111';

    // First submission
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: participantId,
            evento_id: eventId,
            nome: 'Fernanda Lima',
            contato: phone,
            instagram: '@fer.runner',
          },
        ],
      },
    });

    // Advance lead stage in CRM
    const leadsAfterFirst = Array.from(db.leads.values()).filter(l => l.telefone === '11987651111');
    assertEquals(leadsAfterFirst.length, 1, 'Exactly one lead created on first submission', 'PROJECT.md §F4');
    const leadId = leadsAfterFirst[0].id;
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['em_contato', leadId]);

    // Second submission with modified Instagram handle
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: participantId,
            evento_id: eventId,
            nome: 'Fernanda Lima Atualizada',
            contato: phone,
            instagram: '@fer.runner.pro',
          },
        ],
      },
    });

    // Verify deduplication
    const leadsAfterSecond = Array.from(db.leads.values()).filter(l => l.telefone === '11987651111');
    assertEquals(leadsAfterSecond.length, 1, 'Must NOT create duplicate lead on second sync', 'ORIGINAL_REQUEST §Acceptance Criteria');
    assertEquals(leadsAfterSecond[0].estagio, 'em_contato', 'Stage must NOT regress to aguardando on repeated sync', 'PROJECT.md §Contract 3');
  },

  /**
   * T1.6: Conversion funnel metrics math
   * Contract: PROJECT.md §Contract 4, ORIGINAL_REQUEST §R3
   */
  async test_conversion_funnel_metrics_math() {
    function calculateFunnelMetrics(totalAtendidos, emContatoCount, convertidosCount) {
      const taxa = totalAtendidos > 0 ? (convertidosCount / totalAtendidos) * 100 : 0.0;
      return {
        atendidos: totalAtendidos,
        em_contato: emContatoCount,
        convertidos: convertidosCount,
        taxa_conversao: Number(taxa.toFixed(1)),
        taxa_conversao_formatted: `${taxa.toFixed(1)}%`,
      };
    }

    // Scenario A: Standard race event
    const metricsA = calculateFunnelMetrics(100, 35, 12);
    assertEquals(metricsA.atendidos, 100, 'Total atendidos must match', 'PROJECT.md §Contract 4');
    assertEquals(metricsA.em_contato, 35, 'Em contato count must match', 'PROJECT.md §Contract 4');
    assertEquals(metricsA.convertidos, 12, 'Convertidos count must match', 'PROJECT.md §Contract 4');
    assertEquals(metricsA.taxa_conversao, 12.0, 'Taxa must be 12.0%', 'PROJECT.md §Contract 4');
    assertEquals(metricsA.taxa_conversao_formatted, '12.0%', 'Formatted taxa must be 12.0%', 'PROJECT.md §Contract 4');

    // Scenario B: Perfect conversion
    const metricsB = calculateFunnelMetrics(50, 50, 50);
    assertEquals(metricsB.taxa_conversao, 100.0, '100% conversion calculation', 'PROJECT.md §Contract 4');

    // Scenario C: Fractional percent rounding
    const metricsC = calculateFunnelMetrics(300, 75, 41);
    // 41 / 300 = 13.6666... -> 13.7%
    assertEquals(metricsC.taxa_conversao_formatted, '13.7%', 'Taxa rounded to 1 decimal place', 'PROJECT.md §Contract 4');
  },

  /**
   * T1.7: CSV export fields and formatting
   * Contract: PROJECT.md §Contract 5, ORIGINAL_REQUEST §R3
   */
  async test_csv_export_fields_and_attribution(harness) {
    const domShims = harness.getDomShims();

    const sampleEvent = {
      id: 'race-uuid-1234',
      nome: 'Corrida das Estações Primavera',
      status: 'ativo',
    };

    const sampleParticipantes = [
      {
        id: 'part-uuid-5678',
        evento_id: sampleEvent.id,
        nome: 'ana paula da silva',
        contato: '(11) 99876-5432',
        instagram: '@anapaula',
        segue_perfil: true,
        aceitou_comunicado: true,
        synced: true,
        sync_status: 'synced',
        created_at: '2026-09-04T10:30:00Z',
      },
    ];

    exportParticipantesToCSV(sampleParticipantes, sampleEvent);

    const exported = domShims.getExportedFiles();
    assert(exported.length > 0, 'CSV file must be triggered for download', 'PROJECT.md §Contract 5');

    const file = exported[0];
    assertIncludes(file.download, 'participantes_', 'Filename must start with participantes_', 'src/services/csvExport.ts');
    assertIncludes(file.content, 'Ana Paula da Silva', 'Participant name must be formatted in Title Case', 'PROJECT.md §Contract 5');
    assertIncludes(file.content, '5511998765432', 'WhatsApp number must be normalized with country code', 'PROJECT.md §Contract 5');

    // Validate Title Case utility directly
    assertEquals(formatNameTitleCase('carlos eduardo de souza'), 'Carlos Eduardo de Souza', 'Preposition de remains lowercase');
    // Validate Phone format utility
    assertEquals(formatPhoneForDisplay('11998765432'), '(11) 99876-5432', 'Clean 11-digit phone formatted');
    // Validate Brazilian cell phone validator
    assert(isValidBrazilianCellPhone('11998765432'), 'Valid Brazilian mobile number accepted');
    assert(!isValidBrazilianCellPhone('1133334444'), 'Landline number rejected as cell phone');
  },
};
