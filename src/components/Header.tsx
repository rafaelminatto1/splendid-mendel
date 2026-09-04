import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Calendar, 
  PlusCircle, 
  Layout, 
  Settings, 
  Maximize2, 
  HelpCircle,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import type { Evento, LayoutMode, SyncStatus } from '../types';
import { syncService } from '../services/syncService';
import { findClosestEvent } from '../db';

interface HeaderProps {
  eventos: Evento[];
  selectedEvento: Evento | null;
  onSelectEvento: (eventoId: string) => void;
  onOpenCreateEvento: () => void;
  onOpenManagement: () => void;
  onOpenKioskGuide: () => void;
  layoutMode: LayoutMode;
  onToggleLayout: () => void;
  onEnterKioskMode: () => void;
  isKioskMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  eventos,
  selectedEvento,
  onSelectEvento,
  onOpenCreateEvento,
  onOpenManagement,
  onOpenKioskGuide,
  layoutMode,
  onToggleLayout,
  onEnterKioskMode,
  isKioskMode,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncService.getStatus());
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

  const closestEvent = findClosestEvent(eventos);

  if (isKioskMode) {
    // Cabeçalho discreto durante o modo Totem dos corredores
    return (
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#005F73] flex items-center justify-center text-white font-bold shadow-md shadow-[#005F73]/20">
            <span className="text-lg">A</span>
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-tight text-base">
              Activity Fisioterapia
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Massagem Esportiva • {selectedEvento?.nome || 'Evento Atual'}
            </p>
          </div>
        </div>

        {/* Indicador de status de rede minimalista */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-slate-100 text-slate-700">
            {syncStatus.isOnline ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700">Online</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-amber-700">Offline ({syncStatus.pendingCount} pendentes)</span>
              </>
            )}
          </div>

          <button
            onClick={onEnterKioskMode}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium transition"
            title="Sair do modo Totem e abrir configurações"
          >
            Sair do Totem
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Marca & Logo */}
        <div className="flex items-center justify-between md:justify-start gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#005F73] to-[#004655] flex items-center justify-center text-white font-extrabold shadow-md shadow-[#005F73]/25">
              <span className="text-xl">A</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 tracking-tight text-lg">
                  Activity Fisioterapia
                </h1>
                <span className="bg-teal-50 text-[#005F73] text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  TOTEM IPAD
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Check-in de Massagem & Automação Meta
              </p>
            </div>
          </div>

          {/* Botão rápido para Kiosk em mobile/tablet */}
          <button
            onClick={onEnterKioskMode}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#005F73] text-white text-xs font-semibold shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Totem
          </button>
        </div>

        {/* Seletor Inteligente de Evento */}
        <div className="flex items-center gap-2 flex-1 max-w-md relative">
          <div className="relative w-full">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-left transition shadow-sm"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Calendar className="w-4 h-4 text-[#005F73] flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                    {selectedEvento ? selectedEvento.nome : 'Selecione um evento'}
                    {selectedEvento?.id === closestEvent?.id && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> Mais Próximo
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedEvento?.data_inicio ? `Data: ${selectedEvento.data_inicio}` : 'Nenhum evento'}
                    {selectedEvento?.local ? ` • ${selectedEvento.local}` : ''}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Eventos Cadastrados
                </div>
                {eventos.map((ev) => {
                  const isClosest = ev.id === closestEvent?.id;
                  const isSelected = ev.id === selectedEvento?.id;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => {
                        onSelectEvento(ev.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition hover:bg-teal-50/50 ${
                        isSelected ? 'bg-teal-50 border-l-4 border-[#005F73]' : ''
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                          {ev.nome}
                          {isClosest && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              Data mais próxima
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {ev.data_inicio} {ev.local ? `• ${ev.local}` : ''}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        ev.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {ev.status}
                      </span>
                    </button>
                  );
                })}

                <div className="p-2 border-t border-slate-100 mt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenCreateEvento();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#005F73] hover:bg-teal-50 rounded-lg transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Criar Novo Evento
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onOpenCreateEvento}
            className="hidden sm:flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex-shrink-0"
            title="Cadastrar Novo Evento"
          >
            <PlusCircle className="w-4 h-4 text-[#005F73]" />
            <span className="hidden lg:inline">Novo Evento</span>
          </button>
        </div>

        {/* Controles de Status, Layout e Totem */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          
          {/* Status de Rede & Sincronização */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            {syncStatus.isOnline ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Offline</span>
              </div>
            )}

            {syncStatus.pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {syncStatus.pendingCount} pendentes
              </span>
            )}

            <button
              onClick={() => syncService.syncPendingData()}
              disabled={syncStatus.isSyncing || !syncStatus.isOnline}
              className="ml-1 p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition disabled:opacity-40"
              title="Sincronizar agora com o banco central"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin text-[#005F73]' : ''}`} />
            </button>
          </div>

          {/* Alternador de Layout A / B */}
          <button
            onClick={onToggleLayout}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
            title="Alternar entre Layout Lado a Lado e 2 Etapas"
          >
            <Layout className="w-4 h-4 text-[#005F73]" />
            <span className="hidden sm:inline">
              Layout: <strong className="text-[#005F73]">{layoutMode === 'side_by_side' ? 'A (Lado a Lado)' : 'B (2 Etapas)'}</strong>
            </span>
          </button>

          {/* Painel de Gerenciamento & Métricas */}
          <button
            onClick={onOpenManagement}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Settings className="w-4 h-4 text-teal-400" />
            <span>Gerenciar</span>
          </button>

          {/* Iniciar Modo Totem */}
          <button
            onClick={onEnterKioskMode}
            className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-[#005F73] hover:bg-[#004655] text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#005F73]/20"
            title="Entrar em Modo Totem Kiosk para os corredores"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Iniciar Totem</span>
          </button>

          {/* Guia iPad */}
          <button
            onClick={onOpenKioskGuide}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            title="Como instalar no iPad 10 e ativar modo quiosque"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

      </div>
    </header>
  );
};
