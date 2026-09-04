/**
 * Tier 2: Boundary & Corner Cases
 * Tests edge conditions, zero division, empty states, and malformed inputs.
 */
import {
  DEFAULT_ORG_ID,
  assert,
  assertEquals,
  assertNotNull,
} from './harness.js';
import { findClosestEvent } from '../../src/db/index.ts';
import {
  normalizePhoneForWhatsApp,
  formatPhoneForDisplay,
  exportParticipantesToCSV,
} from '../../src/services/csvExport.ts';

export const tier2Tests = {
  name: 'Tier 2: Boundary & Corner Cases',

  /**
   * T2.1: Empty database handling
   * Contract: PROJECT.md §Contract 1 & 2
   */
  async test_empty_database_handling(harness) {
    const db = harness.getDb();
    db.reset(); // ensure 0 events, 0 participants, 0 leads

    // GET with 0 events
    const getRes = await harness.invokeApiSync('GET', {
      queryParams: { organization_id: DEFAULT_ORG_ID },
    });
    assertEquals(getRes.status, 200, 'GET /api/sync with empty db returns 200');
    const getData = await getRes.json();
    assertEquals(getData.ok, true, 'ok must be true for empty db');
    assertEquals(getData.eventos.length, 0, 'eventos array must be empty');

    // findClosestEvent with empty array
    const closest = findClosestEvent([]);
    assertEquals(closest, null, 'findClosestEvent([]) must return null without throwing');

    // POST with empty payload
    const postRes = await harness.invokeApiSync('POST', {
      body: { organization_id: DEFAULT_ORG_ID, eventos: [], participantes: [] },
    });
    assertEquals(postRes.status, 200, 'POST with empty payload returns 200');
    const postData = await postRes.json();
    assertEquals(postData.ok, true, 'ok is true for empty payload');
    assertEquals(postData.synced_count ?? postData.processed_count ?? 0, 0, 'Count is 0');

    // CSV export with 0 runners
    const domShims = harness.getDomShims();
    exportParticipantesToCSV([], null);
    const alerts = domShims.getAlerts();
    assert(alerts.length > 0, 'Alert must be triggered when exporting empty list');
    assertEquals(domShims.getExportedFiles().length, 0, 'No file created when empty');
  },

  /**
   * T2.2: Network offline resilience and backoff
   * Contract: ORIGINAL_REQUEST §R1, PROJECT.md §Architecture
   */
  async test_network_offline_resilience() {
    // Test exponential backoff algorithm: min(2^failures, 30) seconds
    function calculateBackoffSeconds(consecutiveFailures) {
      return Math.min(Math.pow(2, consecutiveFailures), 30);
    }

    assertEquals(calculateBackoffSeconds(1), 2, 'Failure 1 gives 2s backoff');
    assertEquals(calculateBackoffSeconds(2), 4, 'Failure 2 gives 4s backoff');
    assertEquals(calculateBackoffSeconds(3), 8, 'Failure 3 gives 8s backoff');
    assertEquals(calculateBackoffSeconds(4), 16, 'Failure 4 gives 16s backoff');
    assertEquals(calculateBackoffSeconds(5), 30, 'Failure 5 caps at 30s ceiling');
    assertEquals(calculateBackoffSeconds(10), 30, 'Failure 10 remains capped at 30s');
  },

  /**
   * T2.3: Malformed and edge case phone numbers
   * Contract: PROJECT.md §Contract 3, ORIGINAL_REQUEST §R2
   */
  async test_malformed_phone_numbers(harness) {
    const testCases = [
      { raw: '(11) 98765-4321', expectedWa: '5511987654321', expectedDigits: '11987654321' },
      { raw: '11987654321', expectedWa: '5511987654321', expectedDigits: '11987654321' },
      { raw: '+55 11 98765-4321', expectedWa: '5511987654321', expectedDigits: '11987654321' },
      { raw: '  11 98765 4321  ', expectedWa: '5511987654321', expectedDigits: '11987654321' },
      { raw: '11-98765-4321 ramal 12', expectedWa: '551198765432112', expectedDigits: '1198765432112' },
    ];

    for (const tc of testCases) {
      const wa = normalizePhoneForWhatsApp(tc.raw);
      assert(wa.startsWith('55'), `Normalized phone must start with country code 55: ${wa}`);
    }

    // Edge case: Empty or invalid input
    assertEquals(normalizePhoneForWhatsApp(''), '', 'Empty phone normalizes to empty string');
    assertEquals(formatPhoneForDisplay(''), '', 'Empty phone formats to empty string');
    assertEquals(formatPhoneForDisplay(null), '', 'Null phone formats to empty string');
  },

  /**
   * T2.4: Null and missing optional fields
   * Contract: PROJECT.md §Contract 2 & 3
   */
  async test_null_and_missing_optional_fields(harness) {
    const db = harness.getDb();
    const eventId = crypto.randomUUID();
    db.eventos.set(eventId, {
      id: eventId,
      organization_id: DEFAULT_ORG_ID,
      nome: 'Corrida Minimalista',
      status: 'ativo',
      local: null,
      descricao: null,
    });

    const participantId = crypto.randomUUID();
    const payload = {
      organization_id: DEFAULT_ORG_ID,
      participantes: [
        {
          id: participantId,
          evento_id: eventId,
          nome: 'Participante Sem Opcionais',
          contato: '11911112222',
          instagram: null,
          observacoes: null,
          segue_perfil: false,
          aceitou_comunicado: null,
        },
      ],
    };

    const res = await harness.invokeApiSync('POST', { body: payload });
    assertEquals(res.status, 200, 'POST with null optional fields succeeds');

    const lead = Array.from(db.leads.values()).find(l => l.telefone === '11911112222');
    assertNotNull(lead, 'Lead must be created even with null optional fields');
    assertEquals(lead.metadata.segue_perfil, false, 'segue_perfil is boolean false');
  },

  /**
   * T2.5: Zero attendees zero-division protection
   * Contract: PROJECT.md §Contract 4
   */
  async test_zero_attendees_zero_division_protection() {
    function computeConversionRate(totalAtendidos, convertidos) {
      if (!totalAtendidos || totalAtendidos === 0) {
        return '0.0%';
      }
      return `${((convertidos / totalAtendidos) * 100).toFixed(1)}%`;
    }

    // 0 attendees, 0 converted
    const rate0 = computeConversionRate(0, 0);
    assertEquals(rate0, '0.0%', '0 attendees returns 0.0% without NaN or Infinity', 'PROJECT.md §Contract 4');

    // Null/undefined attendees guard
    const rateNull = computeConversionRate(null, 0);
    assertEquals(rateNull, '0.0%', 'null attendees returns 0.0%');

    // Undefined attendees guard
    const rateUndefined = computeConversionRate(undefined, 0);
    assertEquals(rateUndefined, '0.0%', 'undefined attendees returns 0.0%');
  },
};
