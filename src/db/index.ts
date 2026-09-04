import Dexie, { type Table } from 'dexie';
import type { Evento, Participante, AppSettings } from '../types';

export class ActivityEventosDatabase extends Dexie {
  eventos!: Table<Evento, string>;
  participantes!: Table<Participante, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('ActivityEventosDB');
    this.version(1).stores({
      eventos: 'id, data_inicio, status, created_at',
      participantes: 'id, evento_id, contato, synced, created_at',
      settings: 'id',
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
};

/**
 * Encontra o evento cuja data de início está mais próxima da data atual (hoje).
 * Suporta datas passadas e futuras, priorizando o menor intervalo absoluto em milissegundos.
 */
export function findClosestEvent(eventos: Evento[]): Evento | null {
  if (!eventos || eventos.length === 0) return null;

  const now = new Date();
  // Normaliza hoje para a meia-noite
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let closest: Evento = eventos[0];
  let minDiff = Infinity;

  for (const ev of eventos) {
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
 * Inicializa dados iniciais no IndexedDB se estiver vazio
 */
export async function initializeDatabase(): Promise<AppSettings> {
  // Inicializa configurações
  let currentSettings = await db.settings.get('global_settings');
  if (!currentSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
    currentSettings = DEFAULT_SETTINGS;
  }

  // Verifica eventos existentes
  const totalEventos = await db.eventos.count();
  if (totalEventos === 0) {
    // Insere eventos de exemplo (incluindo a Corrida do Juventus citada pelo usuário e evento atual)
    const hoje = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    const sampleEventos: Evento[] = [
      {
        id: 'ev-juventus-2026',
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
        id: 'ev-circuito-atletico-sp',
        nome: 'Circuito das Estações — Etapa Primavera',
        data_inicio: formatYMD(hoje), // Evento de hoje (será auto-selecionado!)
        local: 'Parque Ibirapuera - São Paulo / SP',
        descricao: 'Atendimento de recuperação pós-corrida 5k e 10k.',
        gratuito: true,
        status: 'ativo',
        participantes_previstos: 500,
        created_at: hoje.toISOString(),
        updated_at: hoje.toISOString(),
      },
      {
        id: 'ev-meia-maratona-mooca',
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

    // Seleciona automaticamente o evento mais próximo
    const closest = findClosestEvent(sampleEventos);
    if (closest) {
      currentSettings.active_evento_id = closest.id;
      await db.settings.put(currentSettings);
    }
  } else if (!currentSettings.active_evento_id) {
    // Se há eventos mas nenhum selecionado, auto-seleciona o mais próximo
    const all = await db.eventos.toArray();
    const closest = findClosestEvent(all);
    if (closest) {
      currentSettings.active_evento_id = closest.id;
      await db.settings.put(currentSettings);
    }
  }

  return currentSettings;
}
