import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  ShieldCheck, 
  HardDrive, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  Zap,
  Server
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SyncStatus, SyncLogEntry } from '../types';
import { syncService } from '../services/syncService';
import { db, requestStoragePersistence } from '../db';

interface SyncDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncDiagnosticsModal: React.FC<SyncDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());
  const [isPinging, setIsPinging] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Consulta reativa dos logs no IndexedDB
  const logs = useLiveQuery(
    () => db.sync_logs.orderBy('timestamp').reverse().limit(15).toArray(),
    []
  ) || [];

  useEffect(() => {
    const unsub = syncService.subscribe((s) => setStatus(s));
    return unsub;
  }, []);

  const handlePing = async () => {
    setIsPinging(true);
    await syncService.probeNetworkHealth();
    setIsPinging(false);
  };

  const handleForceSync = async () => {
    await syncService.syncPendingData(true);
  };

  const handleExportBackup = async () => {
    setIsBackingUp(true);
    await syncService.exportEmergencyJsonBackup();
    setIsBackingUp(false);
  };

  const handleResetFailedItems = async () => {
    await db.participantes.where('sync_status').equals('failed').modify({
      sync_status: 'pending',
      retry_count: 0,
      last_sync_error: undefined,
    });
    await syncService.refreshStorageAndCounts();
    alert('Itens em falha re-enfileirados para sincronização!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-900/75 backdrop-blur-sm animate-in fade-in pt-safe pb-safe">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[calc(100dvh-1.5rem)] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 my-auto">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">Diagnóstico de Rede & Sincronização</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Monitoramento em tempo real do status offline e banco Neon</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs">
          
          {/* Card de Qualidade de Rede e Latência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Bloco 1: Conectividade Real */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Conectividade Ativa</span>
                <button
                  onClick={handlePing}
                  disabled={isPinging}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>Testar Ping</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  status.networkQuality === 'excellent' || status.networkQuality === 'good'
                    ? 'bg-blue-100 text-blue-700'
                    : status.networkQuality === 'poor'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-700'
                }`}>
                  {status.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    {status.networkQuality === 'excellent' && '🔵 Conexão Excelente'}
                    {status.networkQuality === 'good' && '🔵 Conexão Boa'}
                    {status.networkQuality === 'poor' && '🟡 Conexão Lenta / Instável'}
                    {status.networkQuality === 'offline' && '🔴 Desconectado (Offline)'}
                    {status.networkQuality === 'checking' && '🔄 Verificando...'}
                  </div>
                  <div className="text-slate-500 text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span>{status.latencyMs ? `Latência: ${status.latencyMs} ms` : 'Sem resposta do servidor'}</span>
                    {status.edgeNode && (
                      <span className="text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                        Edge: {status.edgeNode}
                      </span>
                    )}
                    {status.usingHyperdrive && (
                      <span className="text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                        ⚡ Hyperdrive
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Proteção de Armazenamento no iPad */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Storage do iPadOS</span>
                <span className="text-[11px] font-semibold text-slate-500">IndexedDB</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>{status.storagePersisted ? 'Persistente (Blindado)' : 'Padrão'}</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {status.storageUsageMb > 0
                      ? `${status.storageUsageMb} MB em uso (${status.storageQuotaMb} MB total)`
                      : 'Protegido contra limpeza pelo Safari'}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Fila de Sincronização com o Neon */}
          <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  Status da Fila de Sincronização
                </h4>
                <p className="text-slate-600 text-[11px] mt-0.5 flex flex-wrap items-center gap-2">
                  <span>Endpoint configurado: <code>/api/sync</code></span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-slate-700 bg-white/80 border border-blue-200 px-2 py-0.5 rounded-full">
                    Neon DB: {status.dbStatus === 'connected' ? '🟢 Conectado' : (status.dbStatus === 'error' ? '🔴 Erro' : '⚪ Verificando')}
                    {status.dbLatencyMs ? ` (${status.dbLatencyMs}ms)` : ''}
                  </span>
                </p>
              </div>

              {/* Ações da Fila */}
              <div className="flex items-center gap-2">
                {status.failedCount > 0 && (
                  <button
                    onClick={handleResetFailedItems}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 font-bold hover:bg-amber-200 transition text-[11px]"
                  >
                    Re-tentar Falhas ({status.failedCount})
                  </button>
                )}

                <button
                  onClick={handleForceSync}
                  disabled={status.isSyncing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${status.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{status.isSyncing ? 'Sincronizando...' : 'Forçar Envio Agora'}</span>
                </button>
              </div>
            </div>

            {/* Contadores da Fila */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Pendentes (Local)</div>
                <div className="text-xl font-black text-amber-600 mt-0.5">{status.pendingCount}</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Falhas / Retry</div>
                <div className="text-xl font-black text-rose-600 mt-0.5">{status.failedCount}</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Último Envio</div>
                <div className="text-xs font-bold text-blue-700 mt-1.5 truncate">
                  {status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString('pt-BR') : 'Nenhum'}
                </div>
              </div>
            </div>

            {status.lastError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-[11px]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>{status.lastError}</span>
              </div>
            )}
          </div>

          {/* Backup de Emergência em Arquivo JSON */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Backup de Emergência Completo (JSON)
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                Gera um arquivo físico no iPad com todos os eventos, participantes e dados brutos do IndexedDB.
              </div>
            </div>

            <button
              onClick={handleExportBackup}
              disabled={isBackingUp}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition flex items-center justify-center gap-2 flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Backup JSON</span>
            </button>
          </div>

          {/* Tabela de Logs de Auditoria */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Histórico das Últimas Sincronizações
              </h4>
              <span className="text-[10px] text-slate-400">Últimos {logs.length} eventos</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Horário</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Enviados</th>
                      <th className="px-3 py-2">Latência</th>
                      <th className="px-3 py-2">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                          Nenhum log de sincronização registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="px-3 py-2">
                            {log.status === 'success' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Sucesso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> Erro
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-800">
                            {log.synced_count}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {log.latency_ms} ms
                          </td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-xs" title={log.message}>
                            {log.message}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-[11px] text-slate-400">
            Activity Eventos Kiosk Engine v2.0
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
