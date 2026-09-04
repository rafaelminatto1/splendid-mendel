/**
 * Deep empirical reproduction script for intra-batch concurrency bug in onRequestPost
 */
import { TestHarness, DEFAULT_ORG_ID, assertEquals } from './harness.js';
import * as syncModule from '../../functions/api/sync.ts';

async function reproduce() {
  const harness = new TestHarness();
  harness.setup();
  const db = harness.getDb();

  const eventId = crypto.randomUUID();
  const phone = '11999990001';

  console.log('\n--- Scenario A: Sequential Syncs (Separate HTTP requests) ---');
  harness.reset();
  await harness.invokeApiSync('POST', {
    body: {
      eventos: [{ id: eventId, nome: 'Maratona A', data_inicio: '2026-10-01' }],
      participantes: [{
        id: crypto.randomUUID(),
        evento_id: eventId,
        nome: 'Carlos Corredor',
        contato: phone,
      }],
    },
  });
  await harness.invokeApiSync('POST', {
    body: {
      participantes: [{
        id: crypto.randomUUID(),
        evento_id: eventId,
        nome: 'Carlos Corredor Atualizado',
        contato: phone,
      }],
    },
  });
  const leadsSeq = Array.from(db.leads.values()).filter(l => l.telefone === phone);
  console.log(`Leads created in sequential syncs: ${leadsSeq.length} (Expected: 1)`);

  console.log('\n--- Scenario B: Intra-Batch Duplicate (Same HTTP request with multiple entries for same runner) ---');
  harness.reset();
  await harness.invokeApiSync('POST', {
    body: {
      eventos: [{ id: eventId, nome: 'Maratona A', data_inicio: '2026-10-01' }],
      participantes: [
        {
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Carlos Corredor',
          contato: phone,
        },
        {
          id: crypto.randomUUID(),
          evento_id: eventId,
          nome: 'Carlos Corredor Atualizado',
          contato: phone,
        },
      ],
    },
  });
  const leadsBatch = Array.from(db.leads.values()).filter(l => l.telefone === phone);
  console.log(`Leads created in intra-batch sync: ${leadsBatch.length} (Expected: 1)`);

  harness.teardown();
}

reproduce().catch(console.error);
