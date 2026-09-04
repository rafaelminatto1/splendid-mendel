import { db, requestStoragePersistence } from '../db';
import type { SyncStatus, Participante, Evento, SyncLogEntry, NetworkQuality } from '../types';

class SyncService {
  private status: SyncStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    networkQuality: 'checking',
    latencyMs: null,
    pendingCount: 0,
    failedCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    lastError: null,
    storagePersisted: false,
    storageUsageMb: 0,
    storageQuotaMb: 0,
  };

  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private autoSyncInterval: any = null;
  private healthCheckInterval: any = null;
  private consecutiveFailures = 0;
  private backoffUntil = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkEvent(true));
      window.addEventListener('offline', () => this.handleNetworkEvent(false));

      // Inicia verificação periódica de saúde de rede (a cada 15 segundos)
      this.healthCheckInterval = setInterval(() => {
        this.probeNetworkHealth();
      }, 15000);

      // Inicia sincronizador automático com verificação de backoff
      this.autoSyncInterval = setInterval(() => {
        if (this.status.isOnline && !this.status.isSyncing && Date.now() >= this.backoffUntil) {
          this.syncPendingData();
        }
      }, 10000);

      // Checagem inicial de storage e contadores
      this.refreshStorageAndCounts();
      this.probeNetworkHealth();
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

  private async handleNetworkEvent(isOnline: boolean) {
    this.status.isOnline = isOnline;
    if (!isOnline) {
      this.status.networkQuality = 'offline';
      this.status.latencyMs = null;
      this.notify();
    } else {
      this.status.networkQuality = 'checking';
      this.notify();
      await this.probeNetworkHealth();
      if (this.status.isOnline) {
        this.consecutiveFailures = 0;
        this.backoffUntil = 0;
        this.syncPendingData();
      }
    }
  }

  /**
   * Atualiza a contagem de pendências e o status do storage
   */
  public async updatePendingCount(): Promise<number> {
    await this.refreshStorageAndCounts();
    return this.status.pendingCount;
  }

  /**
   * Checa o status do storage do Safari / iPadOS e recalcula pendências
   */
  public async refreshStorageAndCounts(): Promise<void> {
    const storageInfo = await requestStoragePersistence();
    this.status.storagePersisted = storageInfo.persisted;
    this.status.storageUsageMb = storageInfo.usageMb;
    this.status.storageQuotaMb = storageInfo.quotaMb;

    try {
      const all = await db.participantes.toArray();
      this.status.pendingCount = all.filter(p => !p.synced).length;
      this.status.failedCount = all.filter(p => p.sync_status === 'failed').length;
    } catch (e) {
      console.warn('Erro ao ler contadores do IndexedDB:', e);
    }
    this.notify();
  }

  /**
   * Prova real de rede (ping HTTP com timeout de 3.5s).
   * Distingue conexão real ativa de captive portals ou perda de pacotes.
   */
  public async probeNetworkHealth(): Promise<NetworkQuality> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status.isOnline = false;
      this.status.networkQuality = 'offline';
      this.status.latencyMs = null;
      this.notify();
      return 'offline';
    }

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      // Tenta rota de health ou fallback com favicon com timestamp anti-cache
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);
      this.status.latencyMs = latency;
      this.status.isOnline = res.ok || res.status === 404; // 404 significa que chegou no servidor

      if (latency < 180) {
        this.status.networkQuality = 'excellent';
      } else if (latency < 600) {
        this.status.networkQuality = 'good';
      } else {
        this.status.networkQuality = 'poor';
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      // Se falhou o ping mas navigator.onLine é true, a internet está oscilando ou bloqueada
      this.status.latencyMs = null;
      this.status.networkQuality = 'offline';
      this.status.isOnline = false;
    }

    this.notify();
    return this.status.networkQuality;
  }

  /**
   * Sincronização em lotes de até 25 registros com garantia de idempotência
   * e registro detalhado em log de auditoria.
   */
  public async syncPendingData(forceAll = false): Promise<{ synced: number; failed: number }> {
    if (this.status.isSyncing) return { synced: 0, failed: 0 };

    await this.refreshStorageAndCounts();

    const all = await db.participantes.toArray();
    const unsynced = forceAll 
      ? all.filter(p => !p.synced) 
      : all.filter(p => !p.synced && p.sync_status !== 'syncing');

    if (unsynced.length === 0) {
      this.status.isSyncing = false;
      this.notify();
      return { synced: 0, failed: 0 };
    }

    // Testa saúde da rede antes de enviar
    const quality = await this.probeNetworkHealth();
    if (quality === 'offline') {
      this.status.lastError = 'Sem conexão com a internet. Registros mantidos offline no iPad.';
      this.notify();
      return { synced: 0, failed: unsynced.length };
    }

    this.status.isSyncing = true;
    this.status.lastError = null;
    this.notify();

    // Processa em lotes (chunks) de 25 participantes para evitar timeout em redes 3G/4G
    const CHUNK_SIZE = 25;
    let totalSynced = 0;
    let totalFailed = 0;

    const settings = await db.settings.get('global_settings');
    const syncUrl = settings?.neon_sync_url || '/api/sync';
    const eventos = await db.eventos.toArray();

    for (let i = 0; i < unsynced.length; i += CHUNK_SIZE) {
      const chunk = unsynced.slice(i, i + CHUNK_SIZE);
      const chunkIds = chunk.map(p => p.id);

      // Marca em estado 'syncing' no banco local
      await db.participantes.where('id').anyOf(chunkIds).modify({ sync_status: 'syncing' });

      const chunkStart = performance.now();
      try {
        const response = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Totem-Sync-Version': '2.0',
          },
          body: JSON.stringify({
            participantes: chunk,
            eventos: eventos,
            sync_timestamp: new Date().toISOString(),
          }),
        });

        const chunkLatency = Math.round(performance.now() - chunkStart);

        if (response.ok) {
          const resData = await response.json();
          // Atualiza para 'synced'
          await db.participantes.where('id').anyOf(chunkIds).modify({
            synced: true,
            sync_status: 'synced',
            last_sync_error: undefined,
            updated_at: new Date().toISOString(),
          });

          totalSynced += chunk.length;
          this.consecutiveFailures = 0;
          this.backoffUntil = 0;

          // Grava no log de auditoria do IndexedDB
          await this.logSyncEvent({
            status: 'success',
            synced_count: chunk.length,
            failed_count: 0,
            latency_ms: chunkLatency,
            message: `Lote de ${chunk.length} corredores sincronizado com sucesso (${chunkLatency}ms).`,
            endpoint: syncUrl,
          });
        } else {
          throw new Error(`Servidor retornou HTTP ${response.status}`);
        }
      } catch (err: any) {
        totalFailed += chunk.length;
        this.consecutiveFailures++;

        // Backoff exponencial com teto de 30 segundos
        const backoffSeconds = Math.min(Math.pow(2, this.consecutiveFailures), 30);
        this.backoffUntil = Date.now() + (backoffSeconds * 1000);

        // Marca como falha com histórico de tentativa
        await db.participantes.where('id').anyOf(chunkIds).modify(p => {
          p.sync_status = 'failed';
          p.retry_count = (p.retry_count || 0) + 1;
          p.last_sync_error = err.message || 'Erro desconhecido';
          p.last_attempt_at = new Date().toISOString();
        });

        await this.logSyncEvent({
          status: 'error',
          synced_count: 0,
          failed_count: chunk.length,
          latency_ms: Math.round(performance.now() - chunkStart),
          message: `Falha no lote: ${err.message}. Nova tentativa em ${backoffSeconds}s.`,
          endpoint: syncUrl,
        });

        this.status.lastError = `Conexão instável. Nova tentativa em ${backoffSeconds}s.`;
        break; // Interrompe os próximos lotes para não sobrecarregar a conexão
      }
    }

    this.status.isSyncing = false;
    this.status.lastSyncedAt = totalSynced > 0 ? new Date().toISOString() : this.status.lastSyncedAt;
    await this.refreshStorageAndCounts();
    return { synced: totalSynced, failed: totalFailed };
  }

  /**
   * Registra evento no banco IndexedDB para auditoria
   */
  private async logSyncEvent(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>) {
    try {
      const logItem: SyncLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...entry,
      };
      await db.sync_logs.add(logItem);

      // Mantém apenas os últimos 100 logs para economizar espaço
      const count = await db.sync_logs.count();
      if (count > 100) {
        const oldest = await db.sync_logs.orderBy('timestamp').limit(count - 100).keys();
        await db.sync_logs.bulkDelete(oldest as string[]);
      }
    } catch (e) {
      console.warn('Erro ao salvar log de sync:', e);
    }
  }

  /**
   * Exporta backup completo de emergência em arquivo JSON
   */
  public async exportEmergencyJsonBackup(): Promise<void> {
    const eventos = await db.eventos.toArray();
    const participantes = await db.participantes.toArray();
    const logs = await db.sync_logs.toArray();
    const settings = await db.settings.get('global_settings');

    const backupData = {
      app: 'Activity Fisioterapia - Totem Kiosk',
      exported_at: new Date().toISOString(),
      device_info: {
        userAgent: navigator.userAgent,
        onlineStatus: navigator.onLine,
      },
      stats: {
        total_eventos: eventos.length,
        total_participantes: participantes.length,
        unsynced_participantes: participantes.filter(p => !p.synced).length,
      },
      settings,
      eventos,
      participantes,
      logs: logs.slice(-20),
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `backup_emergencia_totem_${safeDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public getStatus(): SyncStatus {
    return { ...this.status };
  }
}

export const syncService = new SyncService();
