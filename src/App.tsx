import React, { useState, useEffect } from 'react';
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

  // Consultas reativas leves no IndexedDB local
  const eventos = useLiveQuery(() => db.eventos.orderBy('data_inicio').reverse().toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get('global_settings'), []) || DEFAULT_SETTINGS;

  useEffect(() => {
    const initApp = async () => {
      // 1. Inicializa o banco IndexedDB (configurações padrão, persistência Safari)
      await initializeDatabase();

      // 2. Garante que a corrida ativa mais próxima de hoje seja selecionada automaticamente mesmo após recarregamento offline
      const localEvents = await db.eventos.toArray();
      const closest = findClosestEvent(localEvents);
      if (closest) {
        await db.settings.update('global_settings', { active_evento_id: closest.id });
      }

      setIsInitializing(false);

      // 3. Puxa eventos ativos da nuvem (Neon) e atualiza seleção se novo evento mais próximo surgir
      try {
        const pulled = await syncService.pullActiveEvents();
        if (pulled && pulled.length > 0) {
          const updatedEvents = await db.eventos.toArray();
          const newClosest = findClosestEvent(updatedEvents);
          if (newClosest) {
            await db.settings.update('global_settings', { active_evento_id: newClosest.id });
          }
        }
      } catch (err) {
        console.warn('Modo offline: inicializado com eventos locais.', err);
      }
    };

    initApp();
  }, []);

  // Ao recuperar a conexão de rede, sincroniza eventos ativos da nuvem e garante seleção da corrida mais próxima
  useEffect(() => {
    const handleNetworkRecovery = async () => {
      try {
        const pulled = await syncService.pullActiveEvents();
        if (pulled && pulled.length > 0) {
          const currentEvents = await db.eventos.toArray();
          const closest = findClosestEvent(currentEvents);
          if (closest) {
            await db.settings.update('global_settings', { active_evento_id: closest.id });
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar eventos após recuperação de rede:', err);
      }
    };

    window.addEventListener('online', handleNetworkRecovery);
    return () => {
      window.removeEventListener('online', handleNetworkRecovery);
    };
  }, []);

  // Evento selecionado atual
  const selectedEvento = React.useMemo(() => {
    if (!eventos || eventos.length === 0) return null;
    if (settings.active_evento_id) {
      const found = eventos.find(e => e.id === settings.active_evento_id);
      if (found) return found;
    }
    return findClosestEvent(eventos) || eventos[0] || null;
  }, [eventos, settings.active_evento_id]);

  const handleSelectEvento = async (eventoId: string) => {
    await db.settings.update('global_settings', { active_evento_id: eventoId });
  };

  const handleToggleLayout = async () => {
    const nextMode: LayoutMode = settings.layout_mode === 'side_by_side' ? 'two_step' : 'side_by_side';
    await db.settings.update('global_settings', { layout_mode: nextMode });
  };

  const handleEventCreated = async (novoEvento: Evento) => {
    await db.settings.update('global_settings', { active_evento_id: novoEvento.id });
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-[#005F73] text-white flex items-center justify-center font-black text-2xl shadow-xl animate-pulse mb-4">
          A
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">Activity Fisioterapia</h2>
        <p className="text-sm text-slate-500 mt-1">Iniciando totem offline-first...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex flex-col bg-[#F9F9F7] text-slate-900 selection:bg-teal-100">
      
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

      {/* Conteúdo Principal do Totem (ajustado para caber 100% no viewport do iPad) */}
      <main className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-2 sm:p-3 lg:p-4">
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
