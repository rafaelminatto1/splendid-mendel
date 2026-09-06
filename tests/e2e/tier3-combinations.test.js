/**
 * Tier 3: Cross-Feature Combinations
 * Tests end-to-end integration workflows crossing Totem, Neon API, CRM triggers, and Analytics.
 */
import {
  DEFAULT_ORG_ID,
  assert,
  assertEquals,
  assertNotNull,
} from './harness.js';

export const tier3Tests = {
  name: 'Tier 3: Cross-Feature Combinations',

  /**
   * T3.1: Offline registration -> online sync -> CRM lead creation -> lead progression -> funnel update
   * Contract: ORIGINAL_REQUEST §R1, §R2, §R3
   */
  async test_offline_registration_to_crm_progression_lifecycle(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    const eventName = 'Circuito das Estações Outono';
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: eventName,
      status: 'ativo',
    });

    const participantId = crypto.randomUUID();
    const phone = '11988880001';

    // 1. Runner registers at Totem kiosk and data is synced to cloud
    const syncRes = await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: participantId,
            evento_id: eventId,
            nome: 'Guilherme Santos',
            contato: '(11) 98888-0001',
            instagram: '@gui.santos',
            segue_perfil: true,
            aceitou_comunicado: true,
          },
        ],
      },
    });
    assertEquals(syncRes.status, 200, 'Kiosk sync succeeds');

    // 2. Lead and Contact created
    const lead = Array.from(db.leads.values()).find(l => l.telefone === phone);
    assertNotNull(lead, 'Lead created in CRM');
    assertEquals(lead.estagio, 'aguardando', "Initial stage is 'aguardando'");

    const contact = db.contacts.get(lead.contact_id);
    assertNotNull(contact, 'Contact created in CRM');
    assertEquals(contact.lifecycle_stage, 'lead', "Contact lifecycle is initially 'lead'");

    // 3. CRM operator contacts runner on WhatsApp -> estagio: 'em_contato'
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['em_contato', lead.id]);
    assertEquals(contact.lifecycle_stage, 'mql', "Trigger converts contact to 'mql'");

    // 4. Runner schedules assessment and converts to patient -> estagio: 'efetivado'
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['efetivado', lead.id]);
    assertEquals(contact.lifecycle_stage, 'customer', "Trigger converts contact to 'customer'");
    assertNotNull(contact.primary_patient_id, 'Trigger links primary_patient_id');

    const patient = db.patients.get(contact.primary_patient_id);
    assertNotNull(patient, 'Patient record auto-created in patients table');
    assertEquals(patient.nome, 'Guilherme Santos', 'Patient name matches');

    // 5. Funnel stats calculation reflects the conversion
    const totalAtendidos = Array.from(db.participantes.values()).filter(p => p.evento_id === eventId).length;
    const leadsForEvent = Array.from(db.leads.values()).filter(l => l.metadata && l.metadata.evento_id === eventId);
    const emContato = leadsForEvent.filter(l => ['em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado'].includes(l.estagio)).length;
    const convertidos = leadsForEvent.filter(l => l.estagio === 'efetivado').length;

    assertEquals(totalAtendidos, 1, 'Total atendidos is 1');
    assertEquals(emContato, 1, 'Em contato is 1');
    assertEquals(convertidos, 1, 'Convertidos is 1');
    const taxa = ((convertidos / totalAtendidos) * 100).toFixed(1) + '%';
    assertEquals(taxa, '100.0%', 'Conversion rate is 100.0%');
  },

  /**
   * T3.2: Multi-event concurrent sync
   * Contract: PROJECT.md §Contract 2 & 4
   */
  async test_multi_event_concurrent_sync(harness) {
    const db = harness.getDb();
    const eventA = crypto.randomUUID();
    const eventB = crypto.randomUUID();

    db.eventos.set(eventA, { id: eventA, organization_id: DEFAULT_ORG_ID, nome: 'Corrida Mooca 10k', status: 'ativo' });
    db.eventos.set(eventB, { id: eventB, organization_id: DEFAULT_ORG_ID, nome: 'Corrida Ibirapuera 5k', status: 'ativo' });

    // Sync 2 runners for Event A and 1 runner for Event B
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          { id: crypto.randomUUID(), evento_id: eventA, nome: 'Corredor A1', contato: '11910000001' },
          { id: crypto.randomUUID(), evento_id: eventA, nome: 'Corredor A2', contato: '11910000002' },
          { id: crypto.randomUUID(), evento_id: eventB, nome: 'Corredor B1', contato: '11920000001' },
        ],
      },
    });

    const leadsA = Array.from(db.leads.values()).filter(l => l.metadata && l.metadata.evento_id === eventA);
    const leadsB = Array.from(db.leads.values()).filter(l => l.metadata && l.metadata.evento_id === eventB);

    assertEquals(leadsA.length, 2, 'Event A has 2 leads');
    assertEquals(leadsB.length, 1, 'Event B has 1 lead');
    assert(leadsA.every(l => l.interesse.includes('Corrida Mooca 10k')), 'Interesse references Event A');
    assert(leadsB.every(l => l.interesse.includes('Corrida Ibirapuera 5k')), 'Interesse references Event B');
  },

  /**
   * T3.3: Re-sync after partial failure
   * Contract: ORIGINAL_REQUEST §R2
   */
  async test_re_sync_after_partial_failure(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    db.eventos.set(eventId, { id: eventId, organization_id: DEFAULT_ORG_ID, nome: 'Corrida Noturna', status: 'ativo' });

    const runner1Id = crypto.randomUUID();
    const runner2Id = crypto.randomUUID();

    // Initial batch
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          { id: runner1Id, evento_id: eventId, nome: 'Runner Um', contato: '11933330001' },
        ],
      },
    });

    const countBefore = Array.from(db.participantes.values()).length;
    assertEquals(countBefore, 1, 'First runner persisted');

    // Re-sync with both runners (e.g. tablet reconnected and sent full queue)
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          { id: runner1Id, evento_id: eventId, nome: 'Runner Um', contato: '11933330001' },
          { id: runner2Id, evento_id: eventId, nome: 'Runner Dois', contato: '11933330002' },
        ],
      },
    });

    const allParts = Array.from(db.participantes.values()).filter(p => p.evento_id === eventId);
    assertEquals(allParts.length, 2, 'Total participants is exactly 2, no duplicates for Runner Um');
  },

  /**
   * T3.4: Offline registration form timestamp preservation
   * Verifies that when participants register offline at different times,
   * the sync records their actual form submission timestamps in leads, contacts, and participantes,
   * rather than the synchronization timestamp.
   */
  async test_offline_form_submission_timestamp_preservation(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    const eventName = 'Meia Maratona do Ibirapuera';
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: eventName,
      status: 'ativo',
    });

    const timeP1 = '2026-09-05T07:15:30.000Z';
    const timeP2 = '2026-09-05T08:45:10.000Z';
    const timeP3 = '2026-09-05T10:30:00.000Z';
    const syncTime = '2026-09-05T14:00:00.000Z';

    const p1Id = crypto.randomUUID();
    const p2Id = crypto.randomUUID();
    const p3Id = crypto.randomUUID();

    // Sincronização em lote horas após a corrida
    const syncRes = await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        sync_timestamp: syncTime,
        participantes: [
          {
            id: p1Id,
            evento_id: eventId,
            nome: 'Renato Oliveira',
            contato: '(11) 97111-2222',
            segue_perfil: true,
            aceitou_comunicado: true,
            created_at: timeP1,
          },
          {
            id: p2Id,
            evento_id: eventId,
            nome: 'Beatriz Costa',
            contato: '(11) 97333-4444',
            segue_perfil: true,
            aceitou_comunicado: true,
            created_at: timeP2,
          },
          {
            id: p3Id,
            evento_id: eventId,
            nome: 'Danilo Silva',
            contato: '(11) 97555-6666',
            segue_perfil: true,
            aceitou_comunicado: true,
            created_at: timeP3,
          },
        ],
      },
    });

    assertEquals(syncRes.status, 200, 'Batch sync must succeed');

    // 1. Validar participantes no banco
    const p1 = db.participantes.get(p1Id);
    const p2 = db.participantes.get(p2Id);
    const p3 = db.participantes.get(p3Id);
    assertEquals(p1.created_at, timeP1, 'Participante 1 must preserve form fill time');
    assertEquals(p2.created_at, timeP2, 'Participante 2 must preserve form fill time');
    assertEquals(p3.created_at, timeP3, 'Participante 3 must preserve form fill time');

    // 2. Validar leads no CRM
    const leads = Array.from(db.leads.values());
    const lead1 = leads.find(l => l.telefone === '11971112222');
    const lead2 = leads.find(l => l.telefone === '11973334444');
    const lead3 = leads.find(l => l.telefone === '11975556666');

    assertNotNull(lead1, 'Lead 1 must exist');
    assertNotNull(lead2, 'Lead 2 must exist');
    assertNotNull(lead3, 'Lead 3 must exist');

    assertEquals(lead1.created_at, timeP1, 'Lead 1 created_at must match form submission time (07:15)');
    assertEquals(lead2.created_at, timeP2, 'Lead 2 created_at must match form submission time (08:45)');
    assertEquals(lead3.created_at, timeP3, 'Lead 3 created_at must match form submission time (10:30)');

    // 3. Validar metadata de auditoria
    assertEquals(lead1.metadata.formulario_preenchido_em, timeP1, 'Metadata must record exact form fill time');
    assertNotNull(lead1.metadata.sincronizado_em, 'Metadata must record sync time');

    // 4. Validar contacts
    const contact1 = db.contacts.get(lead1.contact_id);
    const contact2 = db.contacts.get(lead2.contact_id);
    const contact3 = db.contacts.get(lead3.contact_id);
    assertEquals(contact1.created_at, timeP1, 'Contact 1 created_at must match form submission time');
    assertEquals(contact2.created_at, timeP2, 'Contact 2 created_at must match form submission time');
    assertEquals(contact3.created_at, timeP3, 'Contact 3 created_at must match form submission time');
  },
};
