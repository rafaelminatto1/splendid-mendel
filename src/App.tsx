import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase, DEFAULT_SETTINGS } from './db';
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

  // Consultas reativas no IndexedDB local
  const eventos = useLiveQuery(() => db.eventos.orderBy('data_inicio').reverse().toArray(), []) || [];
  const participantes = useLiveQuery(() => db.participantes.orderBy('created_at').reverse().toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get('global_settings'), []) || DEFAULT_SETTINGS;

  useEffect(() => {
    initializeDatabase().then(() => {
      setIsInitializing(false);
    });
  }, []);

  // Evento selecionado atual
  const selectedEvento = React.useMemo(() => {
    if (!settings.active_evento_id) return eventos[0] || null;
    return eventos.find(e => e.id === settings.active_evento_id) || eventos[0] || null;
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
    <div className="min-h-screen bg-[#F9F9F7] flex flex-col text-slate-900 selection:bg-teal-100">
      
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
      />

      {/* Conteúdo Principal do Totem */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6">
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

      {/* Modais */}
      <EventModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onEventCreated={handleEventCreated}
      />

      <EventManagementModal
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        eventos={eventos}
        selectedEvento={selectedEvento}
        onSelectEvento={handleSelectEvento}
        participantes={participantes}
        onOpenCreateEvento={() => {
          setIsManagementOpen(false);
          setIsCreateEventOpen(true);
        }}
      />

      <KioskGuideModal
        isOpen={isKioskGuideOpen}
        onClose={() => setIsKioskGuideOpen(false)}
      />

      <SyncDiagnosticsModal
        isOpen={isSyncDiagnosticsOpen}
        onClose={() => setIsSyncDiagnosticsOpen(false)}
      />

    </div>
  );
};
