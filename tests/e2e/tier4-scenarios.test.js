/**
 * Tier 4: Real-World Application Scenarios
 * Simulates high-volume race days, runner re-submissions, and clinic event management.
 */
import {
  DEFAULT_ORG_ID,
  assert,
  assertEquals,
  assertNotNull,
  assertIncludes,
} from './harness.js';
import { findClosestEvent } from '../../src/db/index.ts';
import { exportParticipantesToCSV } from '../../src/services/csvExport.ts';

export const tier4Tests = {
  name: 'Tier 4: Real-World Application Scenarios',

  /**
   * T4.1: Race day high-volume batch ingestion (50 runners)
   * Contract: ORIGINAL_REQUEST §R2, PROJECT.md §F3
   */
  async test_race_day_high_volume_batch_ingestion(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    const eventName = 'Circuito das Estações - 10k';
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: eventName,
      status: 'ativo',
    });

    const totalRunners = 50;
    const runners = [];
    for (let i = 1; i <= totalRunners; i++) {
      const pad = String(i).padStart(4, '0');
      runners.push({
        id: crypto.randomUUID(),
        evento_id: eventId,
        nome: `Corredor Teste ${i}`,
        contato: `1199000${pad}`,
        instagram: `@corredor_${i}`,
        segue_perfil: i % 2 === 0,
        aceitou_comunicado: true,
        created_at: new Date(Date.now() - (totalRunners - i) * 60000).toISOString(),
      });
    }

    // Split into 2 chunks of 25 (matching CHUNK_SIZE in syncService)
    const chunk1 = runners.slice(0, 25);
    const chunk2 = runners.slice(25, 50);

    const res1 = await harness.invokeApiSync('POST', {
      body: { organization_id: DEFAULT_ORG_ID, participantes: chunk1 },
    });
    assertEquals(res1.status, 200, 'Batch 1 succeeded');

    const res2 = await harness.invokeApiSync('POST', {
      body: { organization_id: DEFAULT_ORG_ID, participantes: chunk2 },
    });
    assertEquals(res2.status, 200, 'Batch 2 succeeded');

    // Verify all 50 participants stored
    const storedParticipants = Array.from(db.participantes.values()).filter(p => p.evento_id === eventId);
    assertEquals(storedParticipants.length, 50, 'All 50 participants must be persisted in database');

    // Verify all 50 leads created with correct metadata
    const leads = Array.from(db.leads.values()).filter(l => l.metadata && l.metadata.evento_id === eventId);
    assertEquals(leads.length, 50, 'All 50 leads must be ingested into CRM');

    const optInLeads = leads.filter(l => l.metadata.segue_perfil === true);
    assertEquals(optInLeads.length, 25, 'Exact count of opt-in profile followers verified');
  },

  /**
   * T4.2: Runner re-submission with modified data preserving CRM stage
   * Contract: ORIGINAL_REQUEST §R2, PROJECT.md §Contract 3
   */
  async test_runner_resubmission_with_updated_data(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Meia Maratona Anual',
      status: 'ativo',
    });

    const runnerId = crypto.randomUUID();
    const runnerPhone = '11987771234';

    // 1. Morning registration
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Juliana Paes',
            contato: '(11) 98777-1234',
            instagram: '@juliana',
            segue_perfil: false,
            aceitou_comunicado: false,
          },
        ],
      },
    });

    // 2. Receptionist advances lead to 'avaliacao_agendada' in CRM
    const lead = Array.from(db.leads.values()).find(l => l.telefone === runnerPhone);
    assertNotNull(lead, 'Lead created');
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['avaliacao_agendada', lead.id]);
    assertEquals(lead.estagio, 'avaliacao_agendada', 'Lead advanced in CRM');

    // 3. Afternoon re-submission with updated Instagram and accepted LGPD
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Juliana Paes Runner',
            contato: '(11) 98777-1234',
            instagram: '@juliana.maratona',
            segue_perfil: true,
            aceitou_comunicado: true,
          },
        ],
      },
    });

    // Verify lead stage was NOT regressed to 'aguardando'
    const leadAfter = Array.from(db.leads.values()).find(l => l.telefone === runnerPhone);
    assertEquals(leadAfter.estagio, 'avaliacao_agendada', 'CRM lead stage must be preserved upon re-sync');

    // Verify participant updated
    const partAfter = db.participantes.get(runnerId);
    assertEquals(partAfter.instagram, '@juliana.maratona', 'Participant Instagram updated');
    assertEquals(partAfter.segue_perfil, true, 'Participant segue_perfil updated');
  },

  /**
   * T4.3: Multiple active races in clinic scheduling
   * Contract: ORIGINAL_REQUEST §R1, §R3, PROJECT.md §Contract 4 & 5
   */
  async test_multiple_active_races_clinic_scheduling(harness) {
    const today = new Date();
    const formatYMD = (offsetDays) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const raceTomorrow = {
      id: crypto.randomUUID(),
      nome: 'Corrida Ibirapuera - Amanhã',
      data_inicio: formatYMD(1),
      status: 'ativo',
    };
    const raceIn3Weeks = {
      id: crypto.randomUUID(),
      nome: 'Meia Maratona Mooca - 21 dias',
      data_inicio: formatYMD(21),
      status: 'ativo',
    };
    const raceIn2Months = {
      id: crypto.randomUUID(),
      nome: 'Maratona SP - 60 dias',
      data_inicio: formatYMD(60),
      status: 'ativo',
    };

    const races = [raceIn3Weeks, raceTomorrow, raceIn2Months];

    // Totem kiosk auto-selection
    const selected = findClosestEvent(races);
    assertNotNull(selected, 'Selected event exists');
    assertEquals(selected.id, raceTomorrow.id, 'Totem selects tomorrow race as closest');

    // Register runner under tomorrow's race
    const domShims = harness.getDomShims();
    const runner = {
      id: crypto.randomUUID(),
      evento_id: raceTomorrow.id,
      nome: 'Rodrigo Faro',
      contato: '11988889999',
      segue_perfil: true,
      aceitou_comunicado: true,
      synced: true,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
    };

    exportParticipantesToCSV([runner], raceTomorrow);
    const exports = domShims.getExportedFiles();
    assert(exports.length > 0, 'Export file produced');
    assertIncludes(exports[0].download, 'corrida-ibirapuera-amanha', 'CSV file name contains safe event name');
  },
};
