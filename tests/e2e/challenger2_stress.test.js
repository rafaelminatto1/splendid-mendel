/**
 * Challenger 2: Empirical Backend & Database Stress Test Suite
 * Tests functions/api/sync.ts against:
 * 1. Malformed JSON, missing body, missing/invalid organization_id.
 * 2. Missing or broken DATABASE_URL (safe fallbacks).
 * 3. SQL injection attempts in metadata JSONB fields, participant names, and phone numbers.
 * 4. Strict relational consistency across contacts, participantes, and leads.
 */

import { neonConfig } from '@neondatabase/serverless';
import {
  TestHarness,
  DEFAULT_ORG_ID,
  assert,
  assertEquals,
  assertDeepEquals,
  assertIncludes,
  assertNotNull,
} from './harness.js';
import * as syncModule from '../../functions/api/sync.ts';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};

async function runVector(name, testFn) {
  const start = performance.now();
  try {
    await testFn();
    const duration = Math.round(performance.now() - start);
    console.log(`  ${colors.bold}${colors.green}✓ PASS${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
    return { name, pass: true, duration };
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    console.log(`  ${colors.bold}${colors.red}✗ FAIL${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}${err.message}${colors.reset}`);
    if (err.stack) {
      console.log(`    ${colors.gray}${err.stack}${colors.reset}`);
    }
    return { name, pass: false, duration, error: err.message };
  }
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════`);
  console.log(`  Challenger 2: Empirical Stress Test Suite (functions/api/sync.ts)`);
  console.log(`══════════════════════════════════════════════════════════════════════${colors.reset}\n`);

  const harness = new TestHarness();
  harness.setup();

  const results = [];

  // =========================================================================
  // VECTOR 1: Malformed JSON, missing body, missing organization_id
  // =========================================================================
  console.log(`${colors.bold}${colors.yellow}--- Vector 1: Malformed JSON, Empty/Missing Body, Missing/Invalid Org ID ---${colors.reset}`);

  results.push(await runVector('V1.1: POST with malformed JSON string returns HTTP 500 without crashing', async () => {
    const req = new Request('https://totem.fisioflow.local/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid_json": [ incomplete...',
    });
    const env = { DATABASE_URL: 'postgresql://mock:mock@mock.neon.tech/neondb?sslmode=require' };
    const res = await syncModule.onRequestPost({ request: req, env });
    assertEquals(res.status, 500, 'Expected status 500 on malformed JSON');
    const data = await res.json();
    assertEquals(data.ok, false, 'Expected data.ok to be false');
    assertNotNull(data.error, 'Expected error message in response');
  }));

  results.push(await runVector('V1.2: POST with empty string body returns HTTP 500 without unhandled rejection', async () => {
    const req = new Request('https://totem.fisioflow.local/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    const env = { DATABASE_URL: 'postgresql://mock:mock@mock.neon.tech/neondb?sslmode=require' };
    const res = await syncModule.onRequestPost({ request: req, env });
    assertEquals(res.status, 500, 'Expected status 500 on empty body');
    const data = await res.json();
    assertEquals(data.ok, false, 'Expected data.ok to be false');
  }));

  results.push(await runVector('V1.3: POST with empty object ({}) returns HTTP 200 with zero processed', async () => {
    const req = new Request('https://totem.fisioflow.local/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const env = { DATABASE_URL: 'postgresql://mock:mock@mock.neon.tech/neondb?sslmode=require' };
    const res = await syncModule.onRequestPost({ request: req, env });
    assertEquals(res.status, 200, 'Expected status 200 on empty object');
    const data = await res.json();
    assertEquals(data.ok, true, 'Expected data.ok to be true');
    assertEquals(data.processed_count, 0, 'Expected processed_count == 0');
    assertEquals(data.synced_leads, 0, 'Expected synced_leads == 0');
  }));

  results.push(await runVector('V1.4: POST with missing organization_id safely defaults to DEFAULT_ORG_ID', async () => {
    harness.reset();
    const eventId = crypto.randomUUID();
    const res = await harness.invokeApiSync('POST', {
      body: {
        eventos: [{ id: eventId, nome: 'Corrida Teste Sem Org', data_inicio: '2026-10-01' }],
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Corredor Sem Org',
          contato: '(11) 98765-4321',
          segue_perfil: true,
        }],
      },
    });
    assertEquals(res.status, 200, 'Expected status 200');
    const db = harness.getDb();
    const ev = db.eventos.get(eventId);
    assertNotNull(ev, 'Event should exist in db');
    assertEquals(ev.organization_id, DEFAULT_ORG_ID, 'Event organization_id should default to DEFAULT_ORG_ID');
    const lead = Array.from(db.leads.values())[0];
    assertNotNull(lead, 'Lead should exist in db');
    assertEquals(lead.organization_id, DEFAULT_ORG_ID, 'Lead organization_id should default to DEFAULT_ORG_ID');
  }));

  results.push(await runVector('V1.5: POST with invalid/malicious organization_id falls back to DEFAULT_ORG_ID', async () => {
    harness.reset();
    const eventId = crypto.randomUUID();
    const res = await harness.invokeApiSync('POST', {
      body: {
        organization_id: "invalid-org-uuid'; DROP TABLE users; --",
        eventos: [{ id: eventId, nome: 'Corrida Org Invalida', data_inicio: '2026-10-01' }],
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Corredor Org Invalida',
          contato: '(11) 98765-0000',
        }],
      },
    });
    assertEquals(res.status, 200, 'Expected status 200');
    const db = harness.getDb();
    const lead = Array.from(db.leads.values())[0];
    assertNotNull(lead, 'Lead should exist');
    assertEquals(lead.organization_id, DEFAULT_ORG_ID, 'Lead organization_id should fall back to DEFAULT_ORG_ID');
  }));

  results.push(await runVector('V1.6: GET /api/sync with invalid organization_id query parameter falls back to DEFAULT_ORG_ID', async () => {
    harness.reset();
    const eventId = crypto.randomUUID();
    harness.getDb().eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Corrida Padrao',
      status: 'ativo',
      data_inicio: '2026-10-01',
    });
    const res = await harness.invokeApiSync('GET', {
      queryParams: { organization_id: "invalid-uuid-attempt-or-1=1" },
    });
    assertEquals(res.status, 200, 'Expected status 200');
    const data = await res.json();
    assertEquals(data.ok, true, 'Expected data.ok == true');
    assertEquals(data.eventos.length, 1, 'Expected 1 event returned for default org');
  }));

  results.push(await runVector('V1.7: OPTIONS /api/sync returns 204 with CORS headers', async () => {
    const res = await harness.invokeApiSync('OPTIONS');
    assertEquals(res.status, 204, 'Expected status 204');
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*', 'CORS origin header present');
    assertIncludes(res.headers.get('Access-Control-Allow-Methods'), 'POST', 'CORS methods includes POST');
  }));

  // =========================================================================
  // VECTOR 2: Missing or broken DATABASE_URL (safe fallbacks)
  // =========================================================================
  console.log(`\n${colors.bold}${colors.yellow}--- Vector 2: Missing or Broken DATABASE_URL Safe Fallbacks ---${colors.reset}`);

  results.push(await runVector('V2.1: GET /api/sync with undefined DATABASE_URL returns 200 and empty events without crash', async () => {
    const req = new Request('https://totem.fisioflow.local/api/sync?organization_id=' + DEFAULT_ORG_ID, { method: 'GET' });
    const res = await syncModule.onRequestGet({ request: req, env: {} });
    assertEquals(res.status, 200, 'Expected status 200');
    const data = await res.json();
    assertEquals(data.ok, true, 'Expected ok == true');
    assertDeepEquals(data.eventos, [], 'Expected empty eventos array');
    assertDeepEquals(data.funnel_stats, {}, 'Expected empty funnel_stats object');
  }));

  results.push(await runVector('V2.2: GET /api/sync with empty string DATABASE_URL returns 200 without crash', async () => {
    const req = new Request('https://totem.fisioflow.local/api/sync', { method: 'GET' });
    const res = await syncModule.onRequestGet({ request: req, env: { DATABASE_URL: '' } });
    assertEquals(res.status, 200, 'Expected status 200');
    const data = await res.json();
    assertEquals(data.ok, true, 'Expected ok == true');
    assertDeepEquals(data.eventos, [], 'Expected empty eventos array');
  }));

  results.push(await runVector('V2.3: POST /api/sync with undefined DATABASE_URL returns 200 with persisted_to_neon: false', async () => {
    const eventId = crypto.randomUUID();
    const req = new Request('https://totem.fisioflow.local/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Corredor Local Offline',
          contato: '(11) 98888-7777',
        }],
      }),
    });
    const res = await syncModule.onRequestPost({ request: req, env: {} });
    assertEquals(res.status, 200, 'Expected status 200');
    const data = await res.json();
    assertEquals(data.ok, true, 'Expected ok == true');
    assertEquals(data.processed_count, 1, 'Expected processed_count == 1');
    assertEquals(data.persisted_to_neon, false, 'Expected persisted_to_neon == false');
  }));

  results.push(await runVector('V2.4: POST /api/sync with broken DATABASE_URL (DB outage/network fault) returns HTTP 500 gracefully', async () => {
    // Simulate database network error
    const savedFetch = neonConfig.fetchFunction;
    neonConfig.fetchFunction = async () => {
      throw new Error('Connection refused: Neon host unreachable (simulated DB outage)');
    };

    try {
      const req = new Request('https://totem.fisioflow.local/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantes: [{
            id: crypto.randomUUID(),
            evento_id: crypto.randomUUID(),
            nome: 'Corredor Outage',
            contato: '(11) 99999-1111',
          }],
        }),
      });
      const res = await syncModule.onRequestPost({
        request: req,
        env: { DATABASE_URL: 'postgresql://mockuser:mockpass@bad-host.neon.tech/mockdb?sslmode=require' },
      });
      assertEquals(res.status, 500, 'Expected status 500 on database failure');
      const data = await res.json();
      assertEquals(data.ok, false, 'Expected ok == false');
      assertIncludes(data.error, 'Connection refused', 'Expected error message to reflect DB failure');
    } finally {
      neonConfig.fetchFunction = savedFetch;
    }
  }));

  results.push(await runVector('V2.5: GET /api/sync with broken DATABASE_URL returns HTTP 500 gracefully', async () => {
    const savedFetch = neonConfig.fetchFunction;
    neonConfig.fetchFunction = async () => {
      throw new Error('SSL handshake failed: certificate expired (simulated)');
    };

    try {
      const req = new Request('https://totem.fisioflow.local/api/sync', { method: 'GET' });
      const res = await syncModule.onRequestGet({
        request: req,
        env: { DATABASE_URL: 'postgresql://mockuser:mockpass@bad-host.neon.tech/mockdb?sslmode=require' },
      });
      assertEquals(res.status, 500, 'Expected status 500 on database failure');
      const data = await res.json();
      assertEquals(data.ok, false, 'Expected ok == false');
      assertIncludes(data.error, 'SSL handshake failed', 'Expected error message to reflect DB failure');
    } finally {
      neonConfig.fetchFunction = savedFetch;
    }
  }));

  // =========================================================================
  // VECTOR 3: SQL injection attempts in metadata JSONB and participant names
  // =========================================================================
  console.log(`\n${colors.bold}${colors.yellow}--- Vector 3: SQL Injection Attempts in Metadata JSONB & Inputs ---${colors.reset}`);

  results.push(await runVector('V3.1: SQL injection in participant name and observations safely escaped', async () => {
    harness.reset();
    const eventId = crypto.randomUUID();
    const maliciousName = "Robert'); DROP TABLE leads; --";
    const maliciousObs = "'; DELETE FROM participantes WHERE '1'='1";

    const res = await harness.invokeApiSync('POST', {
      body: {
        eventos: [{ id: eventId, nome: 'Circuito Seguro 2026', data_inicio: '2026-10-10' }],
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: maliciousName,
          contato: '(11) 97777-6666',
          observacoes: maliciousObs,
          segue_perfil: true,
        }],
      },
    });

    assertEquals(res.status, 200, 'Expected status 200');
    const db = harness.getDb();
    // Verify tables still exist
    assert(db.leads.size > 0, 'Leads table must still contain records (not dropped)');
    assert(db.participantes.size > 0, 'Participantes table must still contain records (not deleted)');
    assert(db.contacts.size > 0, 'Contacts table must still contain records');

    // Verify stored name is verbatim, not executed
    const lead = Array.from(db.leads.values())[0];
    assertEquals(lead.nome, maliciousName, 'Participant name must be stored verbatim as string');
    const part = Array.from(db.participantes.values())[0];
    assertIncludes(part.observacoes, maliciousObs, 'Observations must be stored verbatim');
  }));

  results.push(await runVector('V3.2: SQL injection in phone number is sanitized to digits without executing injection', async () => {
    harness.reset();
    const eventId = crypto.randomUUID();
    const maliciousPhone = "(11) 98888-4444'; DROP TABLE contacts; --";

    const res = await harness.invokeApiSync('POST', {
      body: {
        eventos: [{ id: eventId, nome: 'Corrida Anti-Injection', data_inicio: '2026-10-10' }],
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Test Corredor',
          contato: maliciousPhone,
        }],
      },
    });

    assertEquals(res.status, 200, 'Expected status 200');
    const db = harness.getDb();
    assert(db.contacts.size > 0, 'Contacts table must not be dropped');
    const contact = Array.from(db.contacts.values())[0];
    assertEquals(contact.telefone, '11988884444', 'Phone number must be cleanly stripped of SQL injection payload');
  }));

  results.push(await runVector('V3.3: SQL injection in event name and JSONB metadata nesting', async () => {
    harness.reset();
    const eventId = crypto.randomUUID();
    const maliciousEventName = 'Meia Maratona\'; DROP TABLE eventos; SELECT pg_sleep(5); --';

    const res = await harness.invokeApiSync('POST', {
      body: {
        eventos: [{ id: eventId, nome: maliciousEventName, data_inicio: '2026-10-15' }],
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Corredor JSONB Test',
          contato: '(11) 95555-4444',
          instagram: '@runner_jsonb',
        }],
      },
    });

    assertEquals(res.status, 200, 'Expected status 200');
    const db = harness.getDb();
    assert(db.eventos.size > 0, 'Eventos table must not be dropped');
    const lead = Array.from(db.leads.values())[0];
    assertNotNull(lead, 'Lead must be created');
    assertEquals(lead.metadata.evento_nome, maliciousEventName, 'JSONB metadata must preserve event name verbatim without executing SQL');
    assertIncludes(lead.interesse, maliciousEventName, 'Lead interesse field must contain event name safely');
  }));

  // =========================================================================
  // VECTOR 4: Relational consistency across contacts, participantes, and leads
  // =========================================================================
  console.log(`\n${colors.bold}${colors.yellow}--- Vector 4: Strict Relational Consistency Across Entities ---${colors.reset}`);

  results.push(await runVector('V4.1: High-concurrency batch with multiple events and repeat registrations preserves relational integrity', async () => {
    harness.reset();
    const db = harness.getDb();

    const eventA = crypto.randomUUID();
    const eventB = crypto.randomUUID();

    // 10 runners across 2 events
    const runnersBatch = [
      // Event A
      { id: crypto.randomUUID(), evento_id: eventA, nome: 'Ana Silva', contato: '11911110001', instagram: '@ana' },
      { id: crypto.randomUUID(), evento_id: eventA, nome: 'Bruno Costa', contato: '11911110002', instagram: '@bruno' },
      { id: crypto.randomUUID(), evento_id: eventA, nome: 'Carlos Souza', contato: '11911110003', instagram: '@carlos' },
      { id: crypto.randomUUID(), evento_id: eventA, nome: 'Daniel Lima', contato: '11911110004', instagram: '@daniel' },
      { id: crypto.randomUUID(), evento_id: eventA, nome: 'Elena Rocha', contato: '11911110005', instagram: '@elena' },
      // Event B
      { id: crypto.randomUUID(), evento_id: eventB, nome: 'Fernanda Dias', contato: '11911110006', instagram: '@fernanda' },
      { id: crypto.randomUUID(), evento_id: eventB, nome: 'Gabriel Alves', contato: '11911110007', instagram: '@gabriel' },
      { id: crypto.randomUUID(), evento_id: eventB, nome: 'Helena Pinto', contato: '11911110008', instagram: '@helena' },
      // Cross-event runner: Ana Silva also runs Event B! Same phone, different event
      { id: crypto.randomUUID(), evento_id: eventB, nome: 'Ana Silva', contato: '11911110001', instagram: '@ana_b' },
      // Repeat registration in Event A with updated instagram
      { id: crypto.randomUUID(), evento_id: eventA, nome: 'Bruno Costa Updated', contato: '11911110002', instagram: '@bruno_new' },
    ];

    const res = await harness.invokeApiSync('POST', {
      body: {
        eventos: [
          { id: eventA, nome: 'Corrida A', data_inicio: '2026-10-01' },
          { id: eventB, nome: 'Corrida B', data_inicio: '2026-11-01' },
        ],
        participantes: runnersBatch,
      },
    });

    assertEquals(res.status, 200, 'Expected status 200');

    // Verification 1: Every participante has valid evento_id
    for (const p of db.participantes.values()) {
      assert(db.eventos.has(p.evento_id), `Participante ${p.id} references non-existent evento_id ${p.evento_id}`);
    }

    // Verification 2: Every lead has non-null contact_id pointing to contacts table
    for (const l of db.leads.values()) {
      assertNotNull(l.contact_id, `Lead ${l.id} has null contact_id`);
      assert(db.contacts.has(l.contact_id), `Lead ${l.id} references non-existent contact_id ${l.contact_id}`);
      const contact = db.contacts.get(l.contact_id);
      assertEquals(contact.telefone, l.telefone, `Lead phone ${l.telefone} does not match contact phone ${contact.telefone}`);
      assertEquals(contact.organization_id, l.organization_id, `Lead org ${l.organization_id} does not match contact org ${contact.organization_id}`);
    }

    // Verification 3: Contacts deduplication
    // Distinct phones: 11911110001, 11911110002, 11911110003, 11911110004, 11911110005, 11911110006, 11911110007, 11911110008 = 8 unique contacts
    assertEquals(db.contacts.size, 8, 'Expected exactly 8 unique contacts for 8 unique phone numbers');

    // Verification 4: Leads deduplication
    // Ana Silva ran both Event A and Event B -> 2 distinct leads (one per event) linked to SAME contact
    const anaLeads = Array.from(db.leads.values()).filter(l => l.telefone === '11911110001');
    assertEquals(anaLeads.length, 2, 'Ana Silva should have exactly 2 leads (1 per event)');
    assertEquals(anaLeads[0].contact_id, anaLeads[1].contact_id, 'Both leads for Ana Silva must link to the same contact_id');

    // Bruno Costa registered twice for Event A -> exactly 1 lead in Event A
    const brunoLeads = Array.from(db.leads.values()).filter(l => l.telefone === '11911110002');
    assertEquals(brunoLeads.length, 1, 'Bruno Costa should have exactly 1 lead in Event A despite repeat registration');
    assertEquals(brunoLeads[0].nome, 'Bruno Costa Updated', 'Bruno Costa lead should be updated with new name');
  }));

  results.push(await runVector('V4.2: Trigger progression integrity and prevention of stage regression on re-sync', async () => {
    harness.reset();
    const db = harness.getDb();
    const eventId = crypto.randomUUID();

    // 1. Initial kiosk registration
    await harness.invokeApiSync('POST', {
      body: {
        eventos: [{ id: eventId, nome: 'Corrida Funil Test', data_inicio: '2026-10-01' }],
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Marcos Oliveira',
          contato: '11988880001',
        }],
      },
    });

    let lead = Array.from(db.leads.values())[0];
    let contact = db.contacts.get(lead.contact_id);
    assertEquals(lead.estagio, 'aguardando', 'Initial stage must be aguardando');
    assertEquals(contact.lifecycle_stage, 'lead', 'Initial contact lifecycle must be lead');

    // 2. Advance lead in CRM to 'efetivado'
    lead.estagio = 'efetivado';
    db.triggerLeadStageToContactLifecycle(lead, 'aguardando');
    db.triggerLeadEfetivadoToPatient(lead);

    // Verify contact became 'customer' and patient was created
    contact = db.contacts.get(lead.contact_id);
    assertEquals(contact.lifecycle_stage, 'customer', 'Contact lifecycle must be customer');
    assertNotNull(contact.primary_patient_id, 'Contact primary_patient_id must be populated');
    const patient = db.patients.get(contact.primary_patient_id);
    assertNotNull(patient, 'Patient must exist in patients table');
    assertEquals(patient.telefone, '11988880001', 'Patient phone must match lead phone');

    // 3. Re-sync from Totem Kiosk (e.g. runner visits kiosk again)
    await harness.invokeApiSync('POST', {
      body: {
        participantes: [{
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Marcos Oliveira',
          contato: '11988880001',
          instagram: '@marcos_runner',
        }],
      },
    });

    // Verify lead DID NOT regress back to 'aguardando'
    lead = db.leads.get(lead.id);
    assertEquals(lead.estagio, 'efetivado', 'Lead estagio must NOT regress back to aguardando on kiosk re-sync');
    contact = db.contacts.get(lead.contact_id);
    assertEquals(contact.lifecycle_stage, 'customer', 'Contact lifecycle stage must remain customer');
    assertNotNull(contact.primary_patient_id, 'Patient relationship must remain intact');
  }));

  // =========================================================================
  // SUMMARY
  // =========================================================================
  harness.teardown();

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log(`\n${colors.bold}----------------------------------------------------------------------`);
  console.log(`CHALLENGER 2 STRESS TEST RESULTS`);
  console.log(`----------------------------------------------------------------------${colors.reset}`);
  console.log(`  Total Vectors:  ${total}`);
  console.log(`  Passed:         ${colors.green}${passed}${colors.reset}`);
  console.log(`  Failed:         ${failed > 0 ? colors.red : colors.gray}${failed}${colors.reset}`);
  console.log(`----------------------------------------------------------------------\n`);

  if (failed > 0) {
    console.error(`${colors.bold}${colors.red}CHALLENGE_FAILED: ${failed} vectors failed.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.bold}${colors.green}ALL 13 STRESS VECTORS PASSED EMPIRICALLY! Verdict: APPROVE${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
