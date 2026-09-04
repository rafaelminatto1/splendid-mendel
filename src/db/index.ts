import Dexie, { type Table } from 'dexie';
import type { Evento, Participante, AppSettings, SyncLogEntry } from '../types';

export class ActivityEventosDatabase extends Dexie {
  eventos!: Table<Evento, string>;
  participantes!: Table<Participante, string>;
  settings!: Table<AppSettings, string>;
  sync_logs!: Table<SyncLogEntry, string>;

  constructor() {
    super('ActivityEventosDB');
    
    // Versão 1 (base)
    this.version(1).stores({
      eventos: 'id, data_inicio, status, created_at',
      participantes: 'id, evento_id, contato, synced, created_at',
      settings: 'id',
    });

    // Versão 2 (avançada: suporte a logs de sincronização e índices granulares)
    this.version(2).stores({
      eventos: 'id, data_inicio, status, created_at',
      participantes: 'id, evento_id, contato, synced, sync_status, created_at',
      settings: 'id',
      sync_logs: 'id, timestamp, status',
    }).upgrade(tx => {
      // Migração suave dos dados existentes
      return tx.table('participantes').toCollection().modify(p => {
        if (!p.sync_status) {
          p.sync_status = p.synced ? 'synced' : 'pending';
        }
        if (p.retry_count === undefined) {
          p.retry_count = 0;
        }
      });
    });
  }
}

export const db = new ActivityEventosDatabase();

// Configuração padrão
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  active_evento_id: null,
  layout_mode: 'side_by_side',
  instagram_handle: '@activityfisioterapia',
  instagram_url: 'https://www.instagram.com/activityfisioterapia/',
  totem_fullscreen_locked: false,
  auto_reset_seconds: 6,
  neon_sync_url: '/api/sync',
  passcode_exit_kiosk: '1234',
  auto_sync_interval_sec: 10,
  health_check_url: '/api/health',
};

/**
 * Solicita ao iPadOS / Safari proteção de armazenamento persistente.
 * Impede que o WebKit limpe o banco de dados sob pressão de memória.
 */
export async function requestStoragePersistence(): Promise<{ persisted: boolean; usageMb: number; quotaMb: number }> {
  let persisted = false;
  let usageMb = 0;
  let quotaMb = 0;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (navigator.storage.persist) {
        persisted = await navigator.storage.persist();
      } else if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }

      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        usageMb = Math.round((estimate.usage || 0) / (1024 * 1024));
        quotaMb = Math.round((estimate.quota || 0) / (1024 * 1024));
      }
    } catch (e) {
      console.warn('Erro ao consultar persistência de storage:', e);
    }
  }

  return { persisted, usageMb, quotaMb };
}

export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Encontra o evento cuja data de início está mais próxima da data atual (hoje),
 * priorizando eventos com status 'ativo'.
 */
export function findClosestEvent(eventos: Evento[]): Evento | null {
  if (!eventos || eventos.length === 0) return null;

  const ativos = eventos.filter(e => e.status === 'ativo');
  const pool = ativos.length > 0 ? ativos : eventos;

  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let closest: Evento = pool[0];
  let minDiff = Infinity;

  for (const ev of pool) {
    if (!ev.data_inicio) continue;
    const parts = ev.data_inicio.split('-');
    if (parts.length < 3) continue;
    
    const evDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    const diff = Math.abs(evDate - todayMs);

    if (diff < minDiff) {
      minDiff = diff;
      closest = ev;
    }
  }

  return closest;
}

/**
 * Inicializa dados iniciais no IndexedDB
 */
export async function initializeDatabase(): Promise<AppSettings> {
  // Solicita persistência de armazenamento no iOS / iPad Safari
  await requestStoragePersistence();

  let currentSettings = await db.settings.get('global_settings');
  if (!currentSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
    currentSettings = DEFAULT_SETTINGS;
  }

  const totalEventos = await db.eventos.count();
  if (totalEventos === 0) {
    const hoje = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    const sampleEventos: Evento[] = [
      {
        id: '786ec561-bac1-471a-af67-817537d1328c',
        organization_id: DEFAULT_ORG_ID,
        nome: 'Circuito das Estações — Etapa Primavera',
        data_inicio: formatYMD(hoje),
        local: 'Parque Ibirapuera - São Paulo / SP',
        descricao: 'Atendimento de recuperação pós-corrida 5k e 10k.',
        gratuito: true,
        status: 'ativo',
        participantes_previstos: 500,
        created_at: hoje.toISOString(),
        updated_at: hoje.toISOString(),
      },
      {
        id: '2f5a6b7c-8d9e-4f1a-b2c3-d4e5f6a7b8c9',
        organization_id: DEFAULT_ORG_ID,
        nome: 'Corrida do Juventus',
        data_inicio: '2026-08-30',
        local: 'Clube Atlético Juventus - Mooca / SP',
        descricao: 'Ação com tenda de massagem esportiva e liberação miofascial pós-prova para atletas.',
        gratuito: true,
        status: 'concluido',
        participantes_previstos: 350,
        created_at: new Date('2026-08-20T10:00:00Z').toISOString(),
        updated_at: new Date('2026-08-30T18:00:00Z').toISOString(),
      },
      {
        id: '3a4b5c6d-7e8f-4a1b-9c2d-3e4f5a6b7c8d',
        organization_id: DEFAULT_ORG_ID,
        nome: 'Meia Maratona da Mooca 2026',
        data_inicio: '2026-09-20',
        local: 'Rua Javari - São Paulo / SP',
        descricao: 'Massagem esportiva pré e pós 21k para os corredores inscritos.',
        gratuito: true,
        status: 'ativo',
        participantes_previstos: 600,
        created_at: hoje.toISOString(),
        updated_at: hoje.toISOString(),
      }
    ];

    await db.eventos.bulkPut(sampleEventos);

    const closest = findClosestEvent(sampleEventos);
    if (closest) {
      currentSettings.active_evento_id = closest.id;
      await db.settings.put(currentSettings);
    }
  } else if (!currentSettings.active_evento_id) {
    const all = await db.eventos.toArray();
    const closest = findClosestEvent(all);
    if (closest) {
      currentSettings.active_evento_id = closest.id;
      await db.settings.put(currentSettings);
    }
  }

  return currentSettings;
}
