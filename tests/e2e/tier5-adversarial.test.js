/**
 * Tier 5: Adversarial Stress Testing & Coverage Hardening
 * Empirical verification of:
 * 1. Race-day concurrency (batching runners, re-registering with changed details)
 * 2. Stage non-regression (preventing stage reversion on re-sync)
 * 3. Funnel math (zero attendees, 100% conversion, repeating decimals, cloud aggregation)
 * 4. CSV export (special characters, quotes, commas, Title Case prepositions, null handles)
 * 5. Phone parsing (Brazilian mobile formats, +55, DDD boundaries, landline rejection)
 */
import {
  DEFAULT_ORG_ID,
  assert,
  assertEquals,
  assertNotNull,
  assertIncludes,
} from './harness.js';
import {
  formatNameTitleCase,
  formatPhoneForDisplay,
  normalizePhoneForWhatsApp,
  isValidBrazilianCellPhone,
  calculateFunnelMetrics,
  exportParticipantesToCSV,
  resolveRaceOrigin,
  resolveCrmStatus,
} from '../../src/services/csvExport.ts';
import { sanitizePhoneDigits } from '../../functions/api/sync.ts';

export const tier5Tests = {
  name: 'Tier 5: Adversarial Stress Testing & Coverage Hardening',

  /**
   * T5.1: Race-day concurrency: high-volume batch rush and rapid re-registration
   * Contract: ORIGINAL_REQUEST §R2, PROJECT.md §F3 & §F4
   */
  async test_race_day_concurrency_and_batch_rush(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    const eventName = 'Maratona Noturna da Virada 2026';
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: eventName,
      status: 'ativo',
    });

    // 1. Concurrent batch ingestion: 4 parallel batches of 15 runners (60 runners total)
    const totalRunners = 60;
    const batchSize = 15;
    const allRunners = [];

    for (let i = 1; i <= totalRunners; i++) {
      const pad = String(i).padStart(4, '0');
      allRunners.push({
        id: crypto.randomUUID(),
        evento_id: eventId,
        nome: `Corredor Carga ${i}`,
        contato: `+55 (11) 98111-${pad}`,
        instagram: `@carga_${i}`,
        segue_perfil: i % 2 === 0,
        aceitou_comunicado: true,
        created_at: new Date(Date.now() - (totalRunners - i) * 1000).toISOString(),
      });
    }

    const batches = [];
    for (let i = 0; i < totalRunners; i += batchSize) {
      batches.push(allRunners.slice(i, i + batchSize));
    }

    // Fire all 4 batches concurrently via Promise.all
    const responses = await Promise.all(
      batches.map(batch =>
        harness.invokeApiSync('POST', {
          body: {
            organization_id: DEFAULT_ORG_ID,
            participantes: batch,
          },
        })
      )
    );

    for (let b = 0; b < responses.length; b++) {
      assertEquals(responses[b].status, 200, `Batch ${b + 1} must respond with HTTP 200`);
      const body = await responses[b].json();
      assertEquals(body.ok, true, `Batch ${b + 1} ok flag must be true`);
    }

    // Verify all 60 participants stored in database
    const storedParticipants = Array.from(db.participantes.values()).filter(p => p.evento_id === eventId);
    assertEquals(storedParticipants.length, 60, 'All 60 participants from concurrent batches must be saved');

    // Verify all 60 leads created in leads table
    const leads = Array.from(db.leads.values()).filter(
      l => l.metadata && l.metadata.evento_id === eventId
    );
    assertEquals(leads.length, 60, 'All 60 leads must exist in CRM leads table');

    // Verify all 60 contacts created in contacts table
    const contacts = Array.from(db.contacts.values());
    assertEquals(contacts.length, 60, 'All 60 contacts must be created in contacts table');

    // 2. Re-registering runner with changed details in sequential rush
    const targetRunner = allRunners[0];
    const updatedName = 'Corredor Carga 1 VIP Atualizado';
    const updatedInstagram = '@carga_1_vip';
    const cleanTargetPhone = '11981110001';

    const resUpdate = await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: targetRunner.id,
            evento_id: eventId,
            nome: updatedName,
            contato: '(11) 98111-0001',
            instagram: updatedInstagram,
            segue_perfil: true,
            aceitou_comunicado: true,
          },
        ],
      },
    });
    assertEquals(resUpdate.status, 200, 'Re-registration request must succeed');

    // Participant record must reflect updated data
    const partAfter = db.participantes.get(targetRunner.id);
    assertNotNull(partAfter, 'Participant must exist');
    assertEquals(partAfter.nome, updatedName, 'Participant name must be updated');
    assertEquals(partAfter.instagram, updatedInstagram, 'Participant Instagram must be updated');

    // Leads count for this phone must still be exactly 1 (no duplicates)
    const runnerLeads = Array.from(db.leads.values()).filter(l => l.telefone === cleanTargetPhone);
    assertEquals(runnerLeads.length, 1, 'Re-registering runner must NOT create duplicate lead in CRM');
    assertEquals(runnerLeads[0].nome, updatedName, 'Lead record name must be updated on re-registration');

    // 3. Multi-event participation: runner attends a second race
    const event2Id = crypto.randomUUID();
    const event2Name = 'Corrida São Silvestre 2026';
    db.eventos.set(event2Id, {
      id: event2Id,
      organization_id: DEFAULT_ORG_ID,
      nome: event2Name,
      status: 'ativo',
    });

    const runnerRace2Id = crypto.randomUUID();
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerRace2Id,
            evento_id: event2Id,
            nome: updatedName,
            contato: cleanTargetPhone,
            instagram: updatedInstagram,
            segue_perfil: true,
            aceitou_comunicado: true,
          },
        ],
      },
    });

    // Verify participant in second race
    const partRace2 = db.participantes.get(runnerRace2Id);
    assertNotNull(partRace2, 'Second race participant record must be stored');
    assertEquals(partRace2.evento_id, event2Id, 'Participant must be linked to race 2');

    // Verify distinct leads for distinct races, but single contact
    const allRunnerLeads = Array.from(db.leads.values()).filter(l => l.telefone === cleanTargetPhone);
    assertEquals(allRunnerLeads.length, 2, 'Runner participating in 2 distinct events must have 2 attributed leads');

    const leadRace1 = allRunnerLeads.find(l => l.metadata?.evento_id === eventId);
    const leadRace2 = allRunnerLeads.find(l => l.metadata?.evento_id === event2Id);
    assertNotNull(leadRace1, 'Lead for race 1 must exist');
    assertNotNull(leadRace2, 'Lead for race 2 must exist');

    // Single contact in contacts table for this phone
    const contactForPhone = Array.from(db.contacts.values()).filter(c => c.telefone === cleanTargetPhone);
    assertEquals(contactForPhone.length, 1, 'Only 1 contact must exist in contacts table for the runner phone');
    assertEquals(leadRace1.contact_id, contactForPhone[0].id, 'Race 1 lead must link to contact');
    assertEquals(leadRace2.contact_id, contactForPhone[0].id, 'Race 2 lead must link to same contact');
  },

  /**
   * T5.2: Stage non-regression: verify 'em_contato' or 'efetivado' never get reverted to 'aguardando'
   * Contract: ORIGINAL_REQUEST §R2, PROJECT.md §F4 & §Contract 3
   */
  async test_stage_non_regression_comprehensive(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Corrida Track&Field Mooca',
      status: 'ativo',
    });

    const runnerPhone = '11977778888';
    const runnerId = crypto.randomUUID();

    // 1. Initial registration -> stage = 'aguardando'
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Beatriz Vasconcelos',
            contato: '(11) 97777-8888',
            instagram: '@beatriz.vasc',
            segue_perfil: false,
          },
        ],
      },
    });

    const lead = Array.from(db.leads.values()).find(l => l.telefone === runnerPhone);
    assertNotNull(lead, 'Initial lead must be created');
    assertEquals(lead.estagio, 'aguardando', "Initial stage must be 'aguardando'");

    const contact = db.contacts.get(lead.contact_id);
    assertNotNull(contact, 'Contact must exist');
    assertEquals(contact.lifecycle_stage, 'lead', "Contact lifecycle must be 'lead'");

    // 2. Advance to 'em_contato' -> contact becomes 'mql'
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['em_contato', lead.id]);
    assertEquals(lead.estagio, 'em_contato', 'Lead stage is em_contato');
    assertEquals(contact.lifecycle_stage, 'mql', "Trigger must set contact lifecycle to 'mql'");

    // Re-sync runner with updated profile -> stage must NOT regress to 'aguardando'
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Beatriz Vasconcelos Runner',
            contato: '+55 11 97777-8888',
            instagram: '@beatriz.maratona',
            segue_perfil: true,
          },
        ],
      },
    });

    const leadAfterEmContatoSync = db.leads.get(lead.id);
    assertEquals(leadAfterEmContatoSync.estagio, 'em_contato', "Stage must remain 'em_contato' after re-sync");
    assertEquals(contact.lifecycle_stage, 'mql', "Contact lifecycle must remain 'mql'");

    // 3. Advance to 'avaliacao_agendada' -> contact becomes 'sql'
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['avaliacao_agendada', lead.id]);
    assertEquals(contact.lifecycle_stage, 'sql', "Contact lifecycle must be 'sql'");

    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Beatriz Vasconcelos Pro',
            contato: '11977778888',
            instagram: '@beatriz.maratona',
          },
        ],
      },
    });
    assertEquals(db.leads.get(lead.id).estagio, 'avaliacao_agendada', "Stage must remain 'avaliacao_agendada'");

    // 4. Advance to 'avaliacao_realizada' -> contact becomes 'opportunity'
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['avaliacao_realizada', lead.id]);
    assertEquals(contact.lifecycle_stage, 'opportunity', "Contact lifecycle must be 'opportunity'");

    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Beatriz Vasconcelos Pro',
            contato: '(11) 97777-8888',
          },
        ],
      },
    });
    assertEquals(db.leads.get(lead.id).estagio, 'avaliacao_realizada', "Stage must remain 'avaliacao_realizada'");

    // 5. Advance to 'efetivado' -> Patient created, contact becomes 'customer'
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['efetivado', lead.id]);
    assertEquals(lead.estagio, 'efetivado', "Lead is now 'efetivado'");
    assertEquals(contact.lifecycle_stage, 'customer', "Contact lifecycle must be 'customer'");
    assertNotNull(contact.primary_patient_id, 'Primary patient ID must be assigned by trigger');

    const patient = db.patients.get(contact.primary_patient_id);
    assertNotNull(patient, 'Patient row must be created in patients table');
    assertEquals(patient.telefone, runnerPhone, 'Patient phone must match lead');

    // Re-sync runner again -> verify stage remains 'efetivado' and patient unchanged
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerId,
            evento_id: eventId,
            nome: 'Beatriz Vasconcelos Paciente',
            contato: '+55 11 97777 8888',
            instagram: '@beatriz.paciente',
          },
        ],
      },
    });

    const leadFinal = db.leads.get(lead.id);
    assertEquals(leadFinal.estagio, 'efetivado', "Stage must NEVER regress from 'efetivado' to 'aguardando'");
    assertEquals(contact.lifecycle_stage, 'customer', "Contact lifecycle must remain 'customer'");
    assertEquals(contact.primary_patient_id, patient.id, 'Primary patient link must not be altered');

    // 6. Test 'nao_efetivado' non-regression
    const runnerLostId = crypto.randomUUID();
    const runnerLostPhone = '11966665555';
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerLostId,
            evento_id: eventId,
            nome: 'Renato Perdido',
            contato: runnerLostPhone,
          },
        ],
      },
    });
    const leadLost = Array.from(db.leads.values()).find(l => l.telefone === runnerLostPhone);
    await db.executeQuery("UPDATE leads SET estagio = $1 WHERE id = $2", ['nao_efetivado', leadLost.id]);
    assertEquals(leadLost.estagio, 'nao_efetivado', 'Lead marked as nao_efetivado');

    // Re-sync
    await harness.invokeApiSync('POST', {
      body: {
        organization_id: DEFAULT_ORG_ID,
        participantes: [
          {
            id: runnerLostId,
            evento_id: eventId,
            nome: 'Renato Perdido Tentativa 2',
            contato: runnerLostPhone,
          },
        ],
      },
    });
    assertEquals(db.leads.get(leadLost.id).estagio, 'nao_efetivado', "Stage 'nao_efetivado' must not regress");
  },

  /**
   * T5.3: Funnel math: zero attendees, 100% conversion, and repeating fraction edge cases
   * Contract: ORIGINAL_REQUEST §R3, PROJECT.md §Contract 4
   */
  async test_funnel_math_extreme_boundaries(harness) {
    // 1. Zero attendees: must return 0.0% without NaN or error
    const zeroCase = calculateFunnelMetrics(0, 0, 0);
    assertEquals(zeroCase.atendidos, 0, 'Zero attendees count');
    assertEquals(zeroCase.em_contato, 0, 'Zero em_contato count');
    assertEquals(zeroCase.convertidos, 0, 'Zero convertidos count');
    assertEquals(zeroCase.taxa_conversao, 0.0, 'Zero division yields 0.0');
    assertEquals(zeroCase.taxa_conversao_formatted, '0.0%', "Zero division yields '0.0%'");

    // Zero attendees with anomalous positive conversions
    const zeroAnomaly = calculateFunnelMetrics(0, 5, 2);
    assertEquals(zeroAnomaly.taxa_conversao, 0.0, 'Anomalous zero attendees still yields 0.0%');
    assertEquals(zeroAnomaly.taxa_conversao_formatted, '0.0%', 'Formatted output is 0.0%');

    // 2. 100% conversion
    const fullCase = calculateFunnelMetrics(88, 88, 88);
    assertEquals(fullCase.taxa_conversao, 100.0, '100% conversion rate number');
    assertEquals(fullCase.taxa_conversao_formatted, '100.0%', '100.0% formatted conversion rate');

    const singleFull = calculateFunnelMetrics(1, 1, 1);
    assertEquals(singleFull.taxa_conversao, 100.0, 'Single attendee 100% conversion');
    assertEquals(singleFull.taxa_conversao_formatted, '100.0%', 'Single attendee 100.0%');

    // 3. Zero conversions with positive attendees
    const noConversions = calculateFunnelMetrics(500, 150, 0);
    assertEquals(noConversions.taxa_conversao, 0.0, '0 conversions yields 0.0%');
    assertEquals(noConversions.taxa_conversao_formatted, '0.0%', "0 conversions yields '0.0%'");

    // 4. Repeating fractional decimals (rounding to 1 decimal place)
    // 1/3 = 33.333... -> 33.3%
    const oneThird = calculateFunnelMetrics(300, 150, 100);
    assertEquals(oneThird.taxa_conversao, 33.3, '1/3 converted is 33.3%');
    assertEquals(oneThird.taxa_conversao_formatted, '33.3%', '1/3 formatted is 33.3%');

    // 2/3 = 66.666... -> 66.7%
    const twoThirds = calculateFunnelMetrics(300, 250, 200);
    assertEquals(twoThirds.taxa_conversao, 66.7, '2/3 converted is 66.7%');
    assertEquals(twoThirds.taxa_conversao_formatted, '66.7%', '2/3 formatted is 66.7%');

    // 1/7 = 14.2857... -> 14.3%
    const oneSeventh = calculateFunnelMetrics(700, 200, 100);
    assertEquals(oneSeventh.taxa_conversao, 14.3, '1/7 converted is 14.3%');
    assertEquals(oneSeventh.taxa_conversao_formatted, '14.3%', '1/7 formatted is 14.3%');

    // 3/7 = 42.8571... -> 42.9%
    const threeSevenths = calculateFunnelMetrics(700, 400, 300);
    assertEquals(threeSevenths.taxa_conversao, 42.9, '3/7 converted is 42.9%');
    assertEquals(threeSevenths.taxa_conversao_formatted, '42.9%', '3/7 formatted is 42.9%');

    // 5/6 = 83.333... -> 83.3%
    const fiveSixths = calculateFunnelMetrics(600, 550, 500);
    assertEquals(fiveSixths.taxa_conversao, 83.3, '5/6 converted is 83.3%');
    assertEquals(fiveSixths.taxa_conversao_formatted, '83.3%', '5/6 formatted is 83.3%');

    // 5. Extreme large scale volume
    const megaScale = calculateFunnelMetrics(1000000, 350000, 75000);
    assertEquals(megaScale.atendidos, 1000000, 'Mega scale attendees count');
    assertEquals(megaScale.taxa_conversao, 7.5, 'Mega scale rate is 7.5%');
    assertEquals(megaScale.taxa_conversao_formatted, '7.5%', 'Mega scale formatted is 7.5%');

    // 6. Defensive handling of falsy / null inputs
    const falsyInput = calculateFunnelMetrics(null, undefined, NaN);
    assertEquals(falsyInput.atendidos, 0, 'Null atendidos coerced to 0');
    assertEquals(falsyInput.em_contato, 0, 'Undefined em_contato coerced to 0');
    assertEquals(falsyInput.convertidos, 0, 'NaN convertidos coerced to 0');
    assertEquals(falsyInput.taxa_conversao, 0.0, 'Falsy inputs return 0.0');
    assertEquals(falsyInput.taxa_conversao_formatted, '0.0%', "Falsy inputs return '0.0%'");

    // 7. GET /api/sync end-to-end Funnel Stats verification
    const db = harness.getDb();
    const ev1Id = crypto.randomUUID();
    const ev2Id = crypto.randomUUID();

    db.eventos.set(ev1Id, {
      id: ev1Id,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Corrida A - Funil Teste',
      status: 'ativo',
      data_inicio: '2026-10-01',
    });
    db.eventos.set(ev2Id, {
      id: ev2Id,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Corrida B - Funil Teste',
      status: 'ativo',
      data_inicio: '2026-10-15',
    });

    // Populate leads for Event 1: 4 aguardando, 2 em_contato, 2 avaliacao_agendada, 2 efetivado (10 total, 6 em_contato+, 2 efetivado)
    const populateEventLeads = (evId, evName, counts) => {
      let idx = 1;
      for (let i = 0; i < counts.aguardando; i++) {
        const id = crypto.randomUUID();
        db.leads.set(id, {
          id,
          organization_id: DEFAULT_ORG_ID,
          nome: `L_${idx++}`,
          telefone: `1199001${String(idx).padStart(4, '0')}`,
          estagio: 'aguardando',
          metadata: { evento_id: evId, evento_nome: evName },
        });
      }
      for (let i = 0; i < counts.em_contato; i++) {
        const id = crypto.randomUUID();
        db.leads.set(id, {
          id,
          organization_id: DEFAULT_ORG_ID,
          nome: `L_${idx++}`,
          telefone: `1199002${String(idx).padStart(4, '0')}`,
          estagio: 'em_contato',
          metadata: { evento_id: evId, evento_nome: evName },
        });
      }
      for (let i = 0; i < counts.avaliacao; i++) {
        const id = crypto.randomUUID();
        db.leads.set(id, {
          id,
          organization_id: DEFAULT_ORG_ID,
          nome: `L_${idx++}`,
          telefone: `1199003${String(idx).padStart(4, '0')}`,
          estagio: 'avaliacao_agendada',
          metadata: { evento_id: evId, evento_nome: evName },
        });
      }
      for (let i = 0; i < counts.efetivado; i++) {
        const id = crypto.randomUUID();
        db.leads.set(id, {
          id,
          organization_id: DEFAULT_ORG_ID,
          nome: `L_${idx++}`,
          telefone: `1199004${String(idx).padStart(4, '0')}`,
          estagio: 'efetivado',
          metadata: { evento_id: evId, evento_nome: evName },
        });
      }
    };

    populateEventLeads(ev1Id, 'Corrida A - Funil Teste', {
      aguardando: 4,
      em_contato: 2,
      avaliacao: 2,
      efetivado: 2,
    });

    populateEventLeads(ev2Id, 'Corrida B - Funil Teste', {
      aguardando: 1,
      em_contato: 1,
      avaliacao: 0,
      efetivado: 3,
    });

    const getRes = await harness.invokeApiSync('GET', {
      queryParams: { organization_id: DEFAULT_ORG_ID },
    });
    assertEquals(getRes.status, 200, 'GET /api/sync must succeed');
    const getData = await getRes.json();
    assertNotNull(getData.funnel_stats, 'funnel_stats must be present');

    const stats1 = getData.funnel_stats[ev1Id];
    assertNotNull(stats1, `Stats for event 1 (${ev1Id}) must exist`);
    assertEquals(stats1.atendidos, 10, 'Event 1 total attendees (leads) must be 10');
    assertEquals(stats1.em_contato, 6, 'Event 1 em_contato+ must be 6 (2 em_contato + 2 avaliacao + 2 efetivado)');
    assertEquals(stats1.convertidos, 2, 'Event 1 convertidos must be 2');

    const stats2 = getData.funnel_stats[ev2Id];
    assertNotNull(stats2, `Stats for event 2 (${ev2Id}) must exist`);
    assertEquals(stats2.atendidos, 5, 'Event 2 total attendees (leads) must be 5');
    assertEquals(stats2.em_contato, 4, 'Event 2 em_contato+ must be 4');
    assertEquals(stats2.convertidos, 3, 'Event 2 convertidos must be 3');
  },

  /**
   * T5.4: CSV export: special characters, quotes, commas, Title Case prepositions, null handles
   * Contract: ORIGINAL_REQUEST §R3, PROJECT.md §Contract 5
   */
  async test_csv_export_special_chars_and_injection_resilience(harness) {
    const domShims = harness.getDomShims();

    const complexEvent = {
      id: crypto.randomUUID(),
      nome: '2ª Corrida & Caminhada de São Paulo (10k)!',
      status: 'ativo',
    };

    const complexParticipants = [
      // 1. Participant with quotes in nickname and prepositions in name
      {
        id: crypto.randomUUID(),
        evento_id: complexEvent.id,
        nome: 'carlos "o tanque" de souza e silva dos passos',
        contato: '+55 11 99999-1111',
        instagram: '@carlos"tanque"',
        segue_perfil: true,
        aceitou_comunicado: true,
        synced: true,
        created_at: '2026-09-04T08:00:00Z',
      },
      // 2. Participant with semicolons and commas in fields
      {
        id: crypto.randomUUID(),
        evento_id: complexEvent.id,
        nome: 'Ana Maria, da Silva; Atleta',
        contato: '(21) 98888-2222',
        instagram: '@ana;maratona,rio',
        segue_perfil: false,
        aceitou_comunicado: false,
        synced: false,
        created_at: '2026-09-04T08:30:00Z',
      },
      // 3. Participant with null / undefined instagram and missing optional fields
      {
        id: crypto.randomUUID(),
        evento_id: complexEvent.id,
        nome: 'João Gonçalves Müller',
        contato: '11977773333',
        instagram: null,
        segue_perfil: false,
        aceitou_comunicado: true,
        synced: true,
        created_at: '2026-09-04T09:00:00Z',
      },
    ];

    const crmStatusMap = {
      [complexParticipants[0].id]: 'efetivado',
      [complexParticipants[1].id]: 'em_contato',
      [complexParticipants[2].id]: 'aguardando',
    };

    exportParticipantesToCSV(complexParticipants, complexEvent, crmStatusMap);

    const exportedFiles = domShims.getExportedFiles();
    assert(exportedFiles.length > 0, 'CSV export file must be triggered');

    const csvFile = exportedFiles[0];

    // File name must be sanitized
    assertIncludes(csvFile.download, 'participantes_2-corrida-caminhada-de-sao-paulo-10k-_', 'Filename slug must sanitize special characters');
    assertIncludes(csvFile.download, '.csv', 'File extension must be .csv');

    const content = csvFile.content;

    // UTF-8 BOM must be present as first character
    assert(content.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM (\\uFEFF) for Excel Brazilian character support');

    const lines = content.replace('\uFEFF', '').split('\r\n');
    assertEquals(lines.length, 4, 'CSV must contain exactly 1 header line + 3 data lines');

    // Header validation
    const header = lines[0];
    const expectedHeaders = [
      'Nome',
      'WhatsApp',
      'Instagram',
      'Segue Perfil',
      'Aceitou Termo',
      'Data/Hora',
      'Sincronizado',
      'Corrida de Origem',
      'ID da Corrida',
      'Status de Conversão CRM',
    ];
    assertEquals(header, expectedHeaders.join(';'), 'Header line must match schema with semicolon separators');

    // Data Row 1: Carlos "o Tanque" de Souza e Silva dos Passos
    const row1 = lines[1];
    // Quotes must be escaped as "" (RFC 4180)
    assertIncludes(row1, 'Carlos ""o Tanque"" de Souza e Silva dos Passos', 'Quotes in name must be doubled and prepositions preserved in lowercase');
    assertIncludes(row1, '@carlos""tanque""', 'Quotes in Instagram handle must be doubled');
    assertIncludes(row1, '5511999991111', 'WhatsApp must be formatted with 55 country code');
    assertIncludes(row1, 'Convertido em Cliente', "CRM status 'efetivado' resolved to 'Convertido em Cliente'");

    // Data Row 2: Ana Maria, da Silva; Atleta
    const row2 = lines[2];
    assertIncludes(row2, '"Ana Maria, da Silva; Atleta"', 'Semicolons and commas in name safely shielded by cell quotes');
    assertIncludes(row2, '"@ana;maratona,rio"', 'Semicolons and commas in Instagram safely shielded by cell quotes');
    assertIncludes(row2, 'Em Contato', "CRM status 'em_contato' resolved to 'Em Contato'");

    // Data Row 3: Null Instagram
    const row3 = lines[3];
    assertIncludes(row3, 'João Gonçalves Müller', 'Accented characters preserved');
    // Field 3 (Instagram) must be empty quotes "", NOT "null" or "undefined"
    assert(!row3.includes('"null"'), 'CSV must NOT export string "null" for null fields');
    assert(!row3.includes('"undefined"'), 'CSV must NOT export string "undefined" for undefined fields');
    assertIncludes(row3, '";"";"', 'Null Instagram exported as empty quoted string');
    assertIncludes(row3, 'Aguardando', "CRM status 'aguardando' resolved to 'Aguardando'");

    // Semicolon count verification across all lines: exactly 9 semicolons per row
    for (let i = 0; i < lines.length; i++) {
      // Count semicolons outside quoted fields (all rows should have 10 columns)
      // Since each cell is quoted, splitting by `";"` verifies 10 columns
      const cells = lines[i].split(';');
      // Every line has 9 semicolons separating the 10 headers/columns
      // Note that if field values contain semicolons inside quotes, raw split has >= 9
      assert(cells.length >= 10, `Line ${i + 1} must have at least 10 column segments`);
    }

    // Direct Title Case tests with all Brazilian prepositions
    assertEquals(
      formatNameTitleCase('joão da silva e souza do carmo dos passos das neves'),
      'João da Silva e Souza do Carmo dos Passos das Neves',
      'All Brazilian prepositions (da, de, do, dos, das, e) remain lowercase'
    );
    assertEquals(formatNameTitleCase(''), '', 'Empty string returns empty');
    assertEquals(formatNameTitleCase('   MARCELO   '), 'Marcelo', 'Trim extra spaces');
  },

  /**
   * T5.5: Phone parsing: Brazilian mobile numbers with +55, DDD prefixes, whitespace, formatting
   * Contract: ORIGINAL_REQUEST §R2, PROJECT.md §Contract 3
   */
  async test_phone_parsing_and_brazilian_formats() {
    // 1. sanitizePhoneDigits (functions/api/sync.ts)
    // Standard 11 digits
    assertEquals(sanitizePhoneDigits('11987654321'), '11987654321', 'Clean 11 digits');
    assertEquals(sanitizePhoneDigits('(11) 98765-4321'), '11987654321', 'Formatted with parentheses and dash');
    assertEquals(sanitizePhoneDigits('  11 9 8765 4321  '), '11987654321', 'Dirty spacing');
    // +55 international prefix (13 digits)
    assertEquals(sanitizePhoneDigits('+55 (11) 98765-4321'), '11987654321', '+55 with formatting stripped');
    assertEquals(sanitizePhoneDigits('5511987654321'), '11987654321', 'Raw 55 prefix stripped for 13 digits');
    // +55 with 12 digits (legacy 8-digit mobile: 55 + 2 DDD + 8 digits = 12 digits)
    assertEquals(sanitizePhoneDigits('551187654321'), '1187654321', 'Raw 55 stripped for 12 digits');
    // Different DDD regions across Brazil
    assertEquals(sanitizePhoneDigits('+55 (21) 99888-7777'), '21998887777', 'Rio de Janeiro (DDD 21)');
    assertEquals(sanitizePhoneDigits('+55 (31) 98888-1234'), '31988881234', 'Minas Gerais (DDD 31)');
    assertEquals(sanitizePhoneDigits('+55 (41) 99123-4567'), '41991234567', 'Curitiba (DDD 41)');
    assertEquals(sanitizePhoneDigits('+55 (51) 99999-0000'), '51999990000', 'Porto Alegre (DDD 51)');
    assertEquals(sanitizePhoneDigits('+55 (61) 98765-0000'), '61987650000', 'Brasília (DDD 61)');
    assertEquals(sanitizePhoneDigits('+55 (71) 98123-9999'), '71981239999', 'Salvador (DDD 71)');
    assertEquals(sanitizePhoneDigits('+55 (85) 99234-5678'), '85992345678', 'Fortaleza (DDD 85)');
    assertEquals(sanitizePhoneDigits('+55 (92) 98456-7890'), '92984567890', 'Manaus (DDD 92)');
    // Falsy / invalid inputs
    assertEquals(sanitizePhoneDigits(null), '', 'Null returns empty string');
    assertEquals(sanitizePhoneDigits(undefined), '', 'Undefined returns empty string');
    assertEquals(sanitizePhoneDigits(''), '', 'Empty string returns empty string');
    assertEquals(sanitizePhoneDigits('abc-xyz'), '', 'Non-numeric returns empty string');

    // 2. normalizePhoneForWhatsApp (src/services/csvExport.ts)
    assertEquals(normalizePhoneForWhatsApp('11987654321'), '5511987654321', '11 digits gets 55 prepended');
    assertEquals(normalizePhoneForWhatsApp('(11) 98765-4321'), '5511987654321', 'Formatted phone gets 55 prepended');
    assertEquals(normalizePhoneForWhatsApp('5511987654321'), '5511987654321', 'Already starts with 55 preserved');
    assertEquals(normalizePhoneForWhatsApp('+55 (11) 98765-4321'), '5511987654321', '+55 formatted normalized');
    assertEquals(normalizePhoneForWhatsApp('1187654321'), '551187654321', '10 digits gets 55 prepended');
    assertEquals(normalizePhoneForWhatsApp(''), '', 'Empty phone returns empty string');

    // 3. formatPhoneForDisplay (src/services/csvExport.ts)
    assertEquals(formatPhoneForDisplay('11987654321'), '(11) 98765-4321', 'Clean 11 digits formatted');
    assertEquals(formatPhoneForDisplay('5511987654321'), '(11) 98765-4321', '13 digits with 55 stripped and formatted');
    assertEquals(formatPhoneForDisplay('+55 (11) 98765-4321'), '(11) 98765-4321', 'International string formatted cleanly');
    assertEquals(formatPhoneForDisplay('1187654321'), '(11) 8765-4321', 'Clean 10 digits formatted');
    assertEquals(formatPhoneForDisplay(null), '', 'Null returns empty string');
    assertEquals(formatPhoneForDisplay(undefined), '', 'Undefined returns empty string');

    // 4. isValidBrazilianCellPhone (src/services/csvExport.ts)
    // Valid 11-digit mobile phones
    assert(isValidBrazilianCellPhone('11987654321'), 'Valid SP mobile');
    assert(isValidBrazilianCellPhone('(11) 98765-4321'), 'Valid SP mobile formatted');
    assert(isValidBrazilianCellPhone('21998765432'), 'Valid RJ mobile');
    assert(isValidBrazilianCellPhone('31988887777'), 'Valid MG mobile');
    assert(isValidBrazilianCellPhone('41991112222'), 'Valid PR mobile');
    assert(isValidBrazilianCellPhone('85992223333'), 'Valid CE mobile');
    assert(isValidBrazilianCellPhone('+55 (11) 98765-4321'), 'Valid mobile with +55');
    assert(isValidBrazilianCellPhone('5511987654321'), 'Valid mobile raw 13 digits');

    // Landline numbers (8-digit number, 9th digit != 9) -> must be rejected
    assert(!isValidBrazilianCellPhone('1133334444'), 'SP Landline starting with 3 rejected');
    assert(!isValidBrazilianCellPhone('(11) 2222-3333'), 'SP Landline starting with 2 rejected');
    assert(!isValidBrazilianCellPhone('1140040000'), 'SP Landline starting with 4 rejected');
    assert(!isValidBrazilianCellPhone('2138887777'), 'RJ Landline rejected');

    // Invalid DDDs (below 11 or non-existent Brazilian DDD)
    assert(!isValidBrazilianCellPhone('01987654321'), 'DDD 01 does not exist in Brazil');
    assert(!isValidBrazilianCellPhone('00987654321'), 'DDD 00 does not exist in Brazil');
    assert(!isValidBrazilianCellPhone('09987654321'), 'DDD 09 does not exist in Brazil');
    assert(!isValidBrazilianCellPhone('10987654321'), 'DDD 10 does not exist in Brazil');

    // Non-numeric / falsy
    assert(!isValidBrazilianCellPhone(''), 'Empty string is invalid');
    assert(!isValidBrazilianCellPhone(null), 'Null is invalid');
    assert(!isValidBrazilianCellPhone(undefined), 'Undefined is invalid');
    assert(!isValidBrazilianCellPhone('abcdefghijk'), 'Alphabetic string is invalid');
  },
};
