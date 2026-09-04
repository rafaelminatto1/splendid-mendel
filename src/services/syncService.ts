import { db } from '../db';
import type { SyncStatus, Participante, Evento } from '../types';

class SyncService {
  private status: SyncStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  };

  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      
      // Checa pendências a cada 10 segundos se estiver online
      this.autoSyncInterval = setInterval(() => {
        if (this.status.isOnline && !this.status.isSyncing) {
          this.syncPendingData();
        }
      }, 10000);

      this.updatePendingCount();
    }
  }

  public subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    callback({ ...this.status });
    return () => this.listeners.delete(callback);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.status });
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    this.status.isOnline = isOnline;
    this.notify();
    if (isOnline) {
      this.syncPendingData();
    }
  }

  public async updatePendingCount(): Promise<number> {
    try {
      const count = await db.participantes.where('synced').equals(0).count();
      this.status.pendingCount = count;
      this.notify();
      return count;
    } catch {
      // Fallback para filtro manual caso a versão do Dexie use boolean
      const all = await db.participantes.toArray();
      const count = all.filter(p => !p.synced).length;
      this.status.pendingCount = count;
      this.notify();
      return count;
    }
  }

  /**
   * Sincroniza dados com o endpoint Cloudflare Worker ou Neon DB
   */
  public async syncPendingData(): Promise<{ synced: number; failed: number }> {
    if (!this.status.isOnline) {
      return { synced: 0, failed: 0 };
    }

    const all = await db.participantes.toArray();
    const unsynced = all.filter(p => !p.synced);
    this.status.pendingCount = unsynced.length;

    if (unsynced.length === 0) {
      this.status.isSyncing = false;
      this.notify();
      return { synced: 0, failed: 0 };
    }

    this.status.isSyncing = true;
    this.status.error = null;
    this.notify();

    try {
      const settings = await db.settings.get('global_settings');
      const syncUrl = settings?.neon_sync_url || '/api/sync';

      // Também sincroniza os eventos criados localmente
      const eventos = await db.eventos.toArray();

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantes: unsynced,
          eventos: eventos,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Marca os participantes sincronizados localmente
        const idsToUpdate = unsynced.map(p => p.id);
        await db.participantes.where('id').anyOf(idsToUpdate).modify({ synced: true });

        this.status.lastSyncedAt = new Date().toISOString();
        this.status.pendingCount = 0;
        this.status.isSyncing = false;
        this.notify();
        return { synced: unsynced.length, failed: 0 };
      } else {
        // Se a rota remota ainda não estiver no ar ou estiver em mock mode,
        // simula a sincronização para permitir validação local completa
        console.warn('Endpoint de sync retornou status:', response.status);
        this.status.error = `Erro ao sincronizar (${response.status}). Tentará novamente.`;
        this.status.isSyncing = false;
        this.notify();
        return { synced: 0, failed: unsynced.length };
      }
    } catch (err: any) {
      console.warn('Falha de conexão com o servidor de sync:', err.message);
      this.status.error = 'Servidor inacessível. Registros salvos localmente com segurança.';
      this.status.isSyncing = false;
      this.notify();
      return { synced: 0, failed: unsynced.length };
    }
  }

  public getStatus(): SyncStatus {
    return { ...this.status };
  }
}

export const syncService = new SyncService();
