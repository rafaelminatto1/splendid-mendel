import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase, DEFAULT_SETTINGS, findClosestEvent } from './db';
import { syncService } from './services/syncService';
import type { Evento, LayoutMode, AppSettings } from './types';
import { Header } from './components/Header';
import { LayoutA_SideBySide } from './components/LayoutA_SideBySide';
import { LayoutB_TwoStep } from './components/LayoutB_TwoStep';
import { EventModal } from './components/EventModal';
import { EventManagementModal } from './components/EventManagementModal';
import { KioskGuideModal } from './components/KioskGuideModal';
import { SyncDiagnosticsModal } from './components/SyncDiagnosticsModal';

export const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isKioskGuideOpen, setIsKioskGuideOpen] = useState(false);
  const [isSyncDiagnosticsOpen, setIsSyncDiagnosticsOpen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);
  const wasOnlineRef = useRef<boolean>(true);
  // Ref espelho do manualSelectedId para uso dentro de callbacks sem stale closure
  const manualSelectedIdRef = useRef<string | null>(null);

  // Consultas reativas leves no IndexedDB local
  const eventos = useLiveQuery(() => db.eventos.orderBy('data_inicio').reverse().toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get('global_settings'), []) || DEFAULT_SETTINGS;

  // Mantém o ref em sincronia com o estado
  useEffect(() => {
    manualSelectedIdRef.current = manualSelectedId;
  }, [manualSelectedId]);

  // Seleciona automaticamente o evento mais próximo de hoje —
  // mas não sobrescreve se o operador já escolheu manualmente nesta sessão.
  const autoSelectClosestEvent = React.useCallback(async (eventsList: Evento[]) => {
    if (!eventsList || eventsList.length === 0) return null;
    // Respeita seleção manual explícita: só auto-seleciona se o operador não interferiu
    if (manualSelectedIdRef.current) {
      const stillExists = eventsList.find(e => e.id === manualSelectedIdRef.current);
      if (stillExists) return stillExists;
    }
    const closest = findClosestEvent(eventsList);
    if (closest) {
      await db.settings.update('global_settings', { active_evento_id: closest.id });
      return closest;
    }
    return null;
  }, []);

  useEffect(() => {
    const initApp = async () => {
      // 1. Inicializa o banco IndexedDB (configurações padrão, persistência Safari)
      await initializeDatabase();

      // 2. Garante que a corrida com a data mais próxima possível de hoje seja selecionada automaticamente para não errar em campo
      const localEvents = await db.eventos.toArray();
      await autoSelectClosestEvent(localEvents);

      setIsInitializing(false);

      // 3. Puxa eventos ativos da nuvem (Neon) e atualiza para o evento mais próximo atualizado
      try {
        const pulled = await syncService.pullActiveEvents();
        if (pulled && pulled.length > 0) {
          await autoSelectClosestEvent(pulled);
        }
      } catch (err) {
        console.warn('Modo offline: inicializado com eventos locais.', err);
      }
    };

    initApp();
  }, [autoSelectClosestEvent]);

  // Monitora transição de rede e atualizações de eventos pelo syncService
  useEffect(() => {
    // Ao recuperar a conexão ou sincronizar eventos da nuvem, atualiza o sistema e garante a seleção do evento mais próximo
    const handleReconnected = async () => {
      try {
        // Puxa eventos atualizados da nuvem
        const pulled = await syncService.pullActiveEvents();
        const currentEvents = pulled && pulled.length > 0 ? pulled : await db.eventos.toArray();
        // Garante seleção automática da corrida mais próxima de hoje para não errar o evento em campo
        await autoSelectClosestEvent(currentEvents);
        // Sincroniza dados com o CRM imediatamente
        await syncService.syncPendingData(true);
      } catch (err) {
        console.warn('Erro ao atualizar sistema e CRM após recuperação de rede:', err);
      }
    };

    const unsubscribeSync = syncService.subscribe((status) => {
      const becameOnline = !wasOnlineRef.current && status.isOnline;
      wasOnlineRef.current = status.isOnline;

      if (becameOnline) {
        handleReconnected();
      }
    });

    const unsubscribeEvents = syncService.onEventsUpdated((updatedList) => {
      autoSelectClosestEvent(updatedList);
    });

    return () => {
      unsubscribeSync();
      unsubscribeEvents();
    };
  }, [autoSelectClosestEvent]);

  // Evento selecionado atual: prioriza sempre o evento mais próximo de hoje para não errar em campo,
  // respeitando escolhas manuais explícitas do operador na sessão se ainda válidas
  const selectedEvento = React.useMemo(() => {
    if (!eventos || eventos.length === 0) return null;

    const closest = findClosestEvent(eventos);

    // Se o operador selecionou manualmente nesta sessão e o evento ainda existe, respeita
    if (manualSelectedId) {
      const manuallyFound = eventos.find(e => e.id === manualSelectedId);
      if (manuallyFound) return manuallyFound;
    }

    // Se há um evento ativo salvo nas configurações, verifica se ele é o mais próximo
    // ou se há uma corrida mais próxima hoje que deve assumir para não errar em campo
    if (settings.active_evento_id) {
      const saved = eventos.find(e => e.id === settings.active_evento_id);
      if (saved) {
        // Se o evento salvo já for o mais próximo de hoje, mantém
        if (closest && saved.id === closest.id) {
          return saved;
        }
        // Se houver um evento mais próximo (ex: hoje ou evento atual), prioriza o closest
        if (closest) {
          return closest;
        }
        return saved;
      }
    }

    return closest || eventos[0] || null;
  }, [eventos, settings.active_evento_id, manualSelectedId]);

  const handleSelectEvento = async (eventoId: string) => {
    setManualSelectedId(eventoId);
    await db.settings.update('global_settings', { active_evento_id: eventoId });
  };

  const handleToggleLayout = async () => {
    const nextMode: LayoutMode = settings.layout_mode === 'side_by_side' ? 'two_step' : 'side_by_side';
    await db.settings.update('global_settings', { layout_mode: nextMode });
  };

  const handleEventCreated = async (novoEvento: Evento) => {
    setManualSelectedId(novoEvento.id);
    await db.settings.update('global_settings', { active_evento_id: novoEvento.id });
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/60 via-slate-50 to-sky-50/50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-blue-600/25 animate-pulse mb-4">
          A
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">Activity Fisioterapia</h2>
        <p className="text-sm text-slate-500 mt-1">Iniciando totem offline-first...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] md:h-[100dvh] md:max-h-[100dvh] w-full overflow-x-hidden md:overflow-hidden flex flex-col bg-gradient-to-br from-[#F0F7FF] via-[#F8FAFC] to-[#E8F2FE] text-slate-900 selection:bg-blue-100 selection:text-blue-900 relative pl-safe pr-safe pb-safe">
      
      {/* Luz ambiente de fundo sutil */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Cabeçalho */}
      <Header
        eventos={eventos}
        selectedEvento={selectedEvento}
        onSelectEvento={handleSelectEvento}
        onOpenCreateEvento={() => setIsCreateEventOpen(true)}
        onOpenManagement={() => setIsManagementOpen(true)}
        onOpenKioskGuide={() => setIsKioskGuideOpen(true)}
        onOpenSyncDiagnostics={() => setIsSyncDiagnosticsOpen(true)}
        layoutMode={settings.layout_mode}
        onToggleLayout={handleToggleLayout}
        onEnterKioskMode={() => setIsKioskMode(!isKioskMode)}
        isKioskMode={isKioskMode}
        passcodeExitKiosk={settings.passcode_exit_kiosk}
      />

      {/* Conteúdo Principal do Totem (ajustado para caber 100% no viewport do iPad e com rolagem suave no iPhone) */}
      <main className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex items-center justify-center p-2 sm:p-5 lg:p-6 xl:p-8 relative z-10 w-full">
        {settings.layout_mode === 'side_by_side' ? (
          <LayoutA_SideBySide
            evento={selectedEvento}
            instagramHandle={settings.instagram_handle}
            instagramUrl={settings.instagram_url}
          />
        ) : (
          <LayoutB_TwoStep
            evento={selectedEvento}
            instagramHandle={settings.instagram_handle}
            instagramUrl={settings.instagram_url}
            autoResetSeconds={settings.auto_reset_seconds}
          />
        )}
      </main>

      {/* Modais com Renderização Sob Demanda (0ms latência e sem custo em idle) */}
      {isCreateEventOpen && (
        <EventModal
          isOpen={isCreateEventOpen}
          onClose={() => setIsCreateEventOpen(false)}
          onEventCreated={handleEventCreated}
        />
      )}

      {isManagementOpen && (
        <EventManagementModal
          isOpen={isManagementOpen}
          onClose={() => setIsManagementOpen(false)}
          eventos={eventos}
          selectedEvento={selectedEvento}
          onSelectEvento={handleSelectEvento}
          onOpenCreateEvento={() => {
            setIsManagementOpen(false);
            setIsCreateEventOpen(true);
          }}
        />
      )}

      {isKioskGuideOpen && (
        <KioskGuideModal
          isOpen={isKioskGuideOpen}
          onClose={() => setIsKioskGuideOpen(false)}
        />
      )}

      {isSyncDiagnosticsOpen && (
        <SyncDiagnosticsModal
          isOpen={isSyncDiagnosticsOpen}
          onClose={() => setIsSyncDiagnosticsOpen(false)}
        />
      )}

    </div>
  );
};
