/**
 * E2E Test Harness for Totem Kiosk ↔ FisioFlow CRM Integration.
 * Provides:
 * 1. MockPostgresDB: In-memory relational store with schema validation, constraints, and PL/pgSQL triggers.
 * 2. Neon interceptor: Binds @neondatabase/serverless fetchFunction to MockPostgresDB (or live DB when --live-db is passed).
 * 3. Headless DOM/IndexedDB shims for browser-free testing of client modules.
 * 4. Rich assertions library with detailed diffs and contract citations.
 */
import { neonConfig } from '@neondatabase/serverless';

export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// --- ASSERTION UTILITIES ---

export class AssertionError extends Error {
  constructor(message, expected, actual, contract) {
    super(message);
    this.name = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
    this.contract = contract;
  }
}

export function assert(condition, message = 'Assertion failed', contract = '') {
  if (!condition) {
    throw new AssertionError(message, true, false, contract);
  }
}

export function assertEquals(actual, expected, message = 'Values are not equal', contract = '') {
  if (actual !== expected) {
    const detail = `${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`;
    throw new AssertionError(detail, expected, actual, contract);
  }
}

export function assertDeepEquals(actual, expected, message = 'Objects are not deeply equal', contract = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    const detail = `${message}\n  Expected: ${expectedStr}\n  Actual:   ${actualStr}`;
    throw new AssertionError(detail, expected, actual, contract);
  }
}

export function assertIncludes(actual, expectedSub, message = 'Substring or element missing', contract = '') {
  if (typeof actual === 'string') {
    if (!actual.includes(expectedSub)) {
      const detail = `${message}\n  Expected string to include: ${JSON.stringify(expectedSub)}\n  Actual: ${JSON.stringify(actual)}`;
      throw new AssertionError(detail, expectedSub, actual, contract);
    }
  } else if (Array.isArray(actual)) {
    if (!actual.includes(expectedSub)) {
      const detail = `${message}\n  Expected array to include: ${JSON.stringify(expectedSub)}\n  Actual: ${JSON.stringify(actual)}`;
      throw new AssertionError(detail, expectedSub, actual, contract);
    }
  } else {
    throw new AssertionError(`Unsupported type for assertIncludes: ${typeof actual}`, expectedSub, actual, contract);
  }
}

export function assertNotNull(actual, message = 'Expected non-null value', contract = '') {
  if (actual === null || actual === undefined) {
    throw new AssertionError(`${message}\n  Received: ${actual}`, 'non-null', actual, contract);
  }
}

export async function assertThrowsAsync(fn, expectedSubstring = '', message = 'Expected function to throw', contract = '') {
  let threw = false;
  let caughtError = null;
  try {
    await fn();
  } catch (err) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new AssertionError(`${message} (did not throw)`, expectedSubstring, null, contract);
  }
  if (expectedSubstring && !caughtError.message.includes(expectedSubstring)) {
    throw new AssertionError(
      `${message}\n  Expected error message to include: ${JSON.stringify(expectedSubstring)}\n  Actual error: ${JSON.stringify(caughtError.message)}`,
      expectedSubstring,
      caughtError.message,
      contract
    );
  }
}

// --- DOM / BROWSER HEADLESS SHIMS ---

export function setupDOMMocks() {
  const originalDocument = globalThis.document;
  const originalBlob = globalThis.Blob;
  const originalAlert = globalThis.alert;
  const originalCreateObjectURL = globalThis.URL?.createObjectURL;
  const originalRevokeObjectURL = globalThis.URL?.revokeObjectURL;

  const exportedFiles = [];
  const blobMap = new Map();

  class MockBlob {
    constructor(chunks, options) {
      this.chunks = chunks;
      this.options = options || {};
      this.content = chunks.map(c => (typeof c === 'string' ? c : String(c))).join('');
    }
  }

  const mockDocument = {
    createElement(tag) {
      if (tag === 'a') {
        const link = {
          href: '',
          download: '',
          attributes: {},
          setAttribute(name, val) {
            this.attributes[name] = val;
            if (name === 'href') this.href = val;
            if (name === 'download') this.download = val;
          },
          click() {
            exportedFiles.push({
              download: this.download || this.attributes['download'],
              href: this.href || this.attributes['href'],
              content: blobMap.get(this.href || this.attributes['href']) || '',
            });
          },
        };
        return link;
      }
      return {};
    },
    body: {
      appendChild() {},
      removeChild() {},
    },
  };

  globalThis.URL.createObjectURL = (blob) => {
    const id = `blob:mock/${crypto.randomUUID()}`;
    blobMap.set(id, blob.content || '');
    return id;
  };
  globalThis.URL.revokeObjectURL = (id) => {
    blobMap.delete(id);
  };

  const alerts = [];
  const mockAlert = (msg) => {
    alerts.push(msg);
  };

  globalThis.document = mockDocument;
  globalThis.Blob = MockBlob;
  globalThis.alert = mockAlert;

  return {
    getExportedFiles: () => [...exportedFiles],
    getAlerts: () => [...alerts],
    clear: () => {
      exportedFiles.length = 0;
      alerts.length = 0;
      blobMap.clear();
    },
    restore: () => {
      globalThis.document = originalDocument;
      globalThis.Blob = originalBlob;
      globalThis.URL.createObjectURL = originalCreateObjectURL;
      globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
      globalThis.alert = originalAlert;
    },
  };
}

// --- IN-MEMORY RELATIONAL POSTGRESQL ENGINE ---

export class MockPostgresDB {
  constructor() {
    this.reset();
  }

  reset() {
    this.organizations = new Map([
      [
        DEFAULT_ORG_ID,
        {
          id: DEFAULT_ORG_ID,
          nome: 'Activity Fisioterapia',
          slug: 'mooca-fisio',
        },
      ],
    ]);
    this.eventos = new Map();
    this.participantes = new Map();
    this.leads = new Map();
    this.contacts = new Map();
    this.patients = new Map();
    this.contact_activities = [];
    this.queryLog = [];
  }

  // --- PL/pgSQL Triggers Simulation ---

  /**
   * trg_lead_stage_to_contact_lifecycle:
   * Updates contacts.lifecycle_stage when leads.estagio changes:
   * 'aguardando' -> 'lead'
   * 'em_contato' -> 'mql'
   * 'avaliacao_agendada' -> 'sql'
   * 'avaliacao_realizada' -> 'opportunity'
   * 'efetivado' -> 'customer'
   * 'nao_efetivado' -> 'churned'
   */
  triggerLeadStageToContactLifecycle(lead, oldStage = null) {
    if (!lead.contact_id) return;
    const contact = this.contacts.get(lead.contact_id);
    if (!contact) return;

    if (oldStage !== null && lead.estagio === oldStage) return;

    let nextLifecycle = null;
    switch (lead.estagio) {
      case 'aguardando':
        nextLifecycle = 'lead';
        break;
      case 'em_contato':
        nextLifecycle = 'mql';
        break;
      case 'avaliacao_agendada':
        nextLifecycle = 'sql';
        break;
      case 'avaliacao_realizada':
        nextLifecycle = 'opportunity';
        break;
      case 'efetivado':
        nextLifecycle = 'customer';
        break;
      case 'nao_efetivado':
        nextLifecycle = 'churned';
        break;
      default:
        nextLifecycle = null;
    }

    if (nextLifecycle && contact.lifecycle_stage !== nextLifecycle) {
      contact.lifecycle_stage = nextLifecycle;
      contact.updated_at = new Date().toISOString();
    }

    if (oldStage !== null) {
      this.contact_activities.push({
        id: crypto.randomUUID(),
        organization_id: lead.organization_id,
        contact_id: lead.contact_id,
        tipo: 'stage_change',
        titulo: `Estágio: ${lead.estagio}`,
        ref_lead_id: lead.id,
        payload: { from: oldStage, to: lead.estagio },
        created_at: new Date().toISOString(),
      });
    }
  }

  /**
   * trg_lead_efetivado_to_patient:
   * When lead reaches 'efetivado', creates patient in patients and links contact.primary_patient_id
   */
  triggerLeadEfetivadoToPatient(lead) {
    if (lead.estagio !== 'efetivado') return;
    if (!lead.contact_id) {
      console.warn(`[Trigger Warning] Lead ${lead.id} efetivado sem contact_id`);
      return;
    }

    const contact = this.contacts.get(lead.contact_id);
    if (!contact) return;

    if (!contact.primary_patient_id) {
      const patientId = crypto.randomUUID();
      const patient = {
        id: patientId,
        organization_id: lead.organization_id,
        nome: lead.nome,
        telefone: lead.telefone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.patients.set(patientId, patient);
      contact.primary_patient_id = patientId;
      contact.lifecycle_stage = 'customer';
      contact.updated_at = new Date().toISOString();
    }
  }

  // --- Query Interpreter ---

  async executeQuery(query, params = []) {
    this.queryLog.push({ query, params });
    const normalized = query.replace(/\s+/g, ' ').trim();

    // 1. SELECT eventos
    if (normalized.match(/SELECT .* FROM eventos/i)) {
      let result = Array.from(this.eventos.values());

      // Filter organization_id
      if (normalized.includes('organization_id')) {
        const orgId = params[0] || DEFAULT_ORG_ID;
        result = result.filter(e => e.organization_id === orgId);
      }

      // Filter status
      if (normalized.includes("status = 'ativo'")) {
        result = result.filter(e => e.status === 'ativo');
      }

      // Order by data_inicio
      result.sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));

      return result;
    }

    // 2. INSERT INTO eventos
    if (normalized.match(/INSERT INTO eventos/i)) {
      const id = params[0];
      const orgId = params[1] || DEFAULT_ORG_ID;
      const nome = params[2];
      const dataInicio = params[3];
      const local = params[4];
      const descricao = params[5];
      const gratuito = params[6] ?? true;
      const status = params[7] ?? 'ativo';

      const existing = this.eventos.get(id);
      if (existing) {
        if (normalized.includes('DO UPDATE')) {
          existing.nome = nome;
          existing.data_inicio = dataInicio;
          existing.local = local;
          existing.descricao = descricao;
          existing.updated_at = new Date().toISOString();
        }
      } else {
        this.eventos.set(id, {
          id,
          organization_id: orgId,
          nome,
          data_inicio: dataInicio,
          local,
          descricao,
          gratuito,
          status,
          participantes_previstos: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      return [];
    }

    // 3. INSERT INTO participantes
    if (normalized.match(/INSERT INTO participantes/i)) {
      const id = params[0];
      const orgId = params[1] || DEFAULT_ORG_ID;
      const eventoId = params[2];
      const nome = params[3];
      const contato = params[4];
      const instagram = params[5];
      const seguePerfil = Boolean(params[6]);
      const aceitouComunicado = params[7] !== undefined ? Boolean(params[7]) : true;
      const observacoes = params[8];
      const createdAt = params[9] ? new Date(params[9]).toISOString() : new Date().toISOString();

      // Check foreign key: eventos(id)
      if (!this.eventos.has(eventoId)) {
        throw new Error(`Foreign key violation: evento_id ${eventoId} does not exist in eventos`);
      }

      const existing = this.participantes.get(id);
      if (existing) {
        if (normalized.includes('DO UPDATE')) {
          existing.nome = nome;
          existing.contato = contato;
          existing.instagram = instagram;
          existing.segue_perfil = seguePerfil;
          existing.aceitou_comunicado = aceitouComunicado;
          existing.observacoes = observacoes;
          existing.updated_at = new Date().toISOString();
        }
      } else {
        this.participantes.set(id, {
          id,
          organization_id: orgId,
          evento_id: eventoId,
          nome,
          contato,
          instagram,
          segue_perfil: seguePerfil,
          aceitou_comunicado: aceitouComunicado,
          observacoes,
          created_at: createdAt,
          updated_at: new Date().toISOString(),
        });
      }
      return [];
    }

    // 4. SELECT / INSERT / UPDATE contacts
    if (normalized.match(/SELECT .* FROM contacts/i)) {
      let result = Array.from(this.contacts.values());
      if (params.length >= 2) {
        const orgId = params[0];
        const tel = params[1];
        result = result.filter(c => c.organization_id === orgId && c.telefone === tel && !c.deleted_at);
      }
      return result;
    }

    if (normalized.match(/INSERT INTO contacts/i)) {
      const id = params[0] || crypto.randomUUID();
      const orgId = params[1] || DEFAULT_ORG_ID;
      const nome = params[2];
      const tel = params[3];
      const createdAtParam = params[4];
      const createdAt = createdAtParam 
        ? (createdAtParam instanceof Date ? createdAtParam.toISOString() : String(createdAtParam))
        : new Date().toISOString();

      // Check unique constraint uq_contacts_org_phone
      for (const existing of this.contacts.values()) {
        if (existing.organization_id === orgId && existing.telefone === tel && !existing.deleted_at) {
          if (normalized.includes('DO UPDATE')) {
            existing.nome = nome;
            if (new Date(createdAt) < new Date(existing.created_at)) {
              existing.created_at = createdAt;
            }
            existing.updated_at = new Date().toISOString();
            return [existing];
          } else if (normalized.includes('DO NOTHING')) {
            return [existing];
          }
          throw new Error(`Unique constraint violation: uq_contacts_org_phone on (${orgId}, ${tel})`);
        }
      }

      const contact = {
        id,
        organization_id: orgId,
        nome,
        telefone: tel,
        lifecycle_stage: 'lead',
        primary_patient_id: null,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      this.contacts.set(id, contact);
      return [contact];
    }

    // 5. SELECT / INSERT / UPDATE leads
    if (normalized.match(/SELECT .*metadata->>'evento_id'.*FROM leads/i)) {
      const orgId = params[0] || DEFAULT_ORG_ID;
      const eventMap = new Map();
      for (const lead of this.leads.values()) {
        if (lead.organization_id === orgId && lead.metadata && lead.metadata.evento_id) {
          const evId = lead.metadata.evento_id;
          if (!eventMap.has(evId)) {
            eventMap.set(evId, { evento_id: evId, total_leads: 0, em_contato: 0, convertidos: 0 });
          }
          const item = eventMap.get(evId);
          item.total_leads++;
          if (['em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado'].includes(lead.estagio)) {
            item.em_contato++;
          }
          if (lead.estagio === 'efetivado') {
            item.convertidos++;
          }
        }
      }
      return Array.from(eventMap.values());
    }

    if (normalized.match(/SELECT .* FROM leads/i)) {
      let result = Array.from(this.leads.values());
      // Handle check for existing lead by phone & org & event
      if (params.length > 0) {
        result = result.filter(lead => {
          for (const p of params) {
            if (lead.telefone === p || lead.organization_id === p || lead.id === p) {
              return true;
            }
            if (lead.metadata && lead.metadata.evento_id === p) {
              return true;
            }
          }
          return false;
        });
      }
      return result;
    }

    if (normalized.match(/INSERT INTO leads/i)) {
      const id = params[0] || crypto.randomUUID();
      const orgId = params[1] || DEFAULT_ORG_ID;
      const nome = params[2];
      const telefone = params[3];
      const origem = params[4] || 'totem_corrida';
      const estagio = params[5] || 'aguardando';
      const interesse = params[6];
      const contactId = params[7] || null;
      const metadata = typeof params[8] === 'string' ? JSON.parse(params[8]) : (params[8] || {});
      const createdAtParam = params[9];
      const createdAt = createdAtParam 
        ? (createdAtParam instanceof Date ? createdAtParam.toISOString() : String(createdAtParam))
        : new Date().toISOString();

      // FK validation: contact_id
      if (contactId && !this.contacts.has(contactId)) {
        throw new Error(`Foreign key violation: contact_id ${contactId} does not exist in contacts`);
      }

      const lead = {
        id,
        organization_id: orgId,
        nome,
        telefone,
        origem,
        estagio,
        interesse,
        contact_id: contactId,
        metadata,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      };
      this.leads.set(id, lead);

      // Fire triggers
      this.triggerLeadStageToContactLifecycle(lead, null);
      this.triggerLeadEfetivadoToPatient(lead);

      return [lead];
    }

    if (normalized.match(/UPDATE leads/i)) {
      // Find lead to update
      const id = params[params.length - 1];
      const lead = this.leads.get(id);
      if (lead) {
        const oldStage = lead.estagio;
        // Apply updates
        if (normalized.includes('estagio =')) {
          const newStage = params[0];
          lead.estagio = newStage;
        }
        if (normalized.includes('nome =')) {
          lead.nome = params[0];
          lead.interesse = params[1];
          lead.contact_id = params[2];
          try {
            lead.metadata = typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3];
          } catch {
            lead.metadata = params[3];
          }
          if (params[4]) {
            const newCreatedAt = params[4] instanceof Date ? params[4].toISOString() : String(params[4]);
            if (new Date(newCreatedAt) < new Date(lead.created_at)) {
              lead.created_at = newCreatedAt;
            }
          }
        }
        lead.updated_at = new Date().toISOString();
        this.triggerLeadStageToContactLifecycle(lead, oldStage);
        this.triggerLeadEfetivadoToPatient(lead);
        return [lead];
      }
      return [];
    }

    // Default fallback: return empty list
    return [];
  }
}

// --- TEST HARNESS & ENVIRONMENT BINDINGS ---

export class TestHarness {
  constructor(options = {}) {
    this.isLiveDb = Boolean(options.liveDb);
    this.mockDb = new MockPostgresDB();
    this.domShims = setupDOMMocks();
    this.originalFetchFunction = neonConfig.fetchFunction;
  }

  setup() {
    if (!this.isLiveDb) {
      // Intercept neon queries and route to MockPostgresDB
      neonConfig.fetchFunction = async (url, options) => {
        let body = {};
        try {
          body = JSON.parse(options.body);
        } catch {
          body = { query: '', params: [] };
        }

        const query = body.query || '';
        const params = body.params || [];

        try {
          const rows = await this.mockDb.executeQuery(query, params);
          const fields = rows.length > 0 ? Object.keys(rows[0]).map(name => ({ name })) : [];
          const rowValues = rows.map(r => Object.values(r));
          return new Response(JSON.stringify({ fields, rows: rowValues }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({
              message: err.message,
              code: 'MOCK_PG_ERROR',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      };
    }
  }

  teardown() {
    neonConfig.fetchFunction = this.originalFetchFunction;
    this.domShims.restore();
  }

  reset() {
    this.mockDb.reset();
    this.domShims.clear();
  }

  getDb() {
    return this.mockDb;
  }

  getDomShims() {
    return this.domShims;
  }

  /**
   * Helper to invoke Cloudflare Pages Functions /api/sync handlers
   */
  async invokeApiSync(method, { queryParams = {}, body = null, envOverrides = {} } = {}) {
    const syncModule = await import('../../functions/api/sync.ts');

    const url = new URL('https://totem.fisioflow.local/api/sync');
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v);
    }

    const requestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method.toUpperCase() !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const request = new Request(url.toString(), requestInit);
    const env = {
      DATABASE_URL: 'postgresql://mock:mock@mock.neon.tech/neondb?sslmode=require',
      SYNC_SECRET: 'test-sync-secret',
      ...envOverrides,
    };

    const context = { request, env };

    if (method.toUpperCase() === 'GET') {
      if (typeof syncModule.onRequestGet !== 'function') {
        throw new Error('onRequestGet is not implemented or not exported in functions/api/sync.ts (Milestone M1 required)');
      }
      return await syncModule.onRequestGet(context);
    } else if (method.toUpperCase() === 'POST') {
      if (typeof syncModule.onRequestPost !== 'function') {
        throw new Error('onRequestPost is not implemented or not exported in functions/api/sync.ts');
      }
      return await syncModule.onRequestPost(context);
    } else if (method.toUpperCase() === 'OPTIONS') {
      if (typeof syncModule.onRequestOptions !== 'function') {
        throw new Error('onRequestOptions is not implemented in functions/api/sync.ts');
      }
      return await syncModule.onRequestOptions(context);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
  }
}
