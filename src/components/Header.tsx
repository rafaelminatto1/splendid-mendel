import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Calendar, 
  PlusCircle, 
  Layout, 
  Settings, 
  Maximize2, 
  HelpCircle,
  ChevronDown,
  Check,
  MapPin,
  Lock,
  Delete,
  X,
  Menu
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
  onOpenSyncDiagnostics: () => void;
  layoutMode: LayoutMode;
  onToggleLayout: () => void;
  onEnterKioskMode: () => void;
  isKioskMode: boolean;
  passcodeExitKiosk?: string;
}

export const Header: React.FC<HeaderProps> = ({
  eventos,
  selectedEvento,
  onSelectEvento,
  onOpenCreateEvento,
  onOpenManagement,
  onOpenKioskGuide,
  onOpenSyncDiagnostics,
  layoutMode,
  onToggleLayout,
  onEnterKioskMode,
  isKioskMode,
  passcodeExitKiosk = '1234',
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncService.getStatus());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleKeypadPress = (digit: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError(false);
      if (next.length === 4) {
        if (next === passcodeExitKiosk) {
          setIsPinModalOpen(false);
          setPinInput('');
          setPinError(false);
          onEnterKioskMode();
        } else {
          setPinError(true);
          setTimeout(() => {
            setPinInput('');
          }, 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  const closestEvent = findClosestEvent(eventos);

  // Modo Totem Kiosk (visão limpa e discreta para o atleta)
  if (isKioskMode) {
    return (
      <>
        <header className="bg-white border-b border-slate-100 px-3 sm:px-6 py-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-600/25 flex-shrink-0">
              <span>A</span>
            </div>
            <div className="leading-tight min-w-0">
              <h1 className="font-semibold text-slate-800 text-xs sm:text-sm tracking-tight truncate">
                Activity Fisioterapia
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate max-w-[150px] sm:max-w-md">
                {selectedEvento?.nome || 'Totem de Atendimento'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <button
              onClick={onOpenSyncDiagnostics}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 transition border border-slate-200/60"
              title="Diagnósticos de conexão"
            >
              {syncStatus.isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                  </span>
                  <span className="text-blue-700 text-[11px] font-medium hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-amber-700 text-[11px] font-medium">Offline ({syncStatus.pendingCount})</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setPinInput('');
                setPinError(false);
                setIsPinModalOpen(true);
              }}
              className="text-xs px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition flex items-center gap-1.5"
              title="Sair do modo Totem (Requer PIN do operador)"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* Modal de PIN de Segurança para Sair do Totem */}
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            <div className="bg-white rounded-3xl max-w-xs w-full p-6 shadow-2xl border border-slate-200 text-center my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Acesso Operador</h3>
              <p className="text-xs text-slate-500 mt-1">
                Digite a senha de 4 dígitos para sair do modo Totem
              </p>

              {/* Indicadores de Dígitos (Bolinhas) */}
              <div className="flex items-center justify-center gap-3 my-5">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pinInput.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-150 ${
                        pinError
                          ? 'bg-rose-500 scale-110 animate-bounce'
                          : isFilled
                          ? 'bg-blue-600 scale-110 shadow-sm shadow-blue-600/30'
                          : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>

              {pinError && (
                <p className="text-xs font-bold text-rose-600 -mt-2 mb-3 animate-shake">
                  Senha incorreta!
                </p>
              )}

              {/* Teclado Numérico Tátil Otimizado para iPhone e iPad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[220px] mx-auto mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-blue-600 active:text-white text-slate-800 text-lg font-bold transition flex items-center justify-center shadow-sm"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError(false);
                  }}
                  className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 active:text-slate-700 text-xs font-bold transition flex items-center justify-center"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-blue-600 active:text-white text-slate-800 text-lg font-bold transition flex items-center justify-center shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-500 active:text-rose-600 transition flex items-center justify-center"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Voltar ao Totem
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Barra de tarefas padrão (Admin / Operação)
  return (
    <>
      <header className="bg-white border-b border-slate-200/80 px-3 sm:px-4 lg:px-6 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sticky top-0 z-40 flex-shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          
          {/* Lado Esquerdo: Marca */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-600/25">
              <span>A</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-slate-800 text-sm tracking-tight">
                Activity
              </span>
              <span className="text-slate-300 text-xs hidden sm:inline">•</span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Fisioterapia
              </span>
            </div>
          </div>

          {/* Centro: Seletor de Evento Adaptativo */}
          <div className="flex-1 min-w-0 flex justify-center max-w-[190px] sm:max-w-sm md:max-w-md mx-1 sm:mx-2" ref={dropdownRef}>
            <div className="relative w-full max-w-[260px] sm:max-w-xs md:max-w-sm">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`w-full flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-left transition-all border text-xs ${
                  dropdownOpen 
                    ? 'bg-slate-100 border-blue-500/40 ring-2 ring-blue-500/10 text-slate-900 shadow-sm' 
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 text-slate-700 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 truncate">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-slate-800 truncate text-xs">
                    {selectedEvento ? selectedEvento.nome : 'Selecionar Evento'}
                  </span>
                  {selectedEvento && closestEvent && selectedEvento.id === closestEvent.id && (
                    <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 hidden xl:inline">
                      Mais próximo
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-slate-600' : ''}`} />
              </button>

              {/* Dropdown Flutuante Elegante (Adaptado para iPhone com limite dinâmico de largura) */}
              {dropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-900/10 z-50 overflow-hidden py-1.5 w-[min(calc(100vw-1.5rem),340px)] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 mb-1">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Eventos Cadastrados
                    </span>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCreateEvento();
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>Novo</span>
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto px-1 space-y-0.5">
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
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition text-xs ${
                            isSelected
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{ev.nome}</span>
                              {isClosest && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-semibold px-1.5 py-0.2 rounded-full flex-shrink-0">
                                  Mais próximo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-normal">
                              <span>{ev.data_inicio}</span>
                              {ev.local && (
                                <>
                                  <span>•</span>
                                  <span className="truncate flex items-center gap-0.5">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {ev.local}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-1.5 border-t border-slate-100 mt-1">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCreateEvento();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50/50 rounded-xl transition border border-dashed border-slate-200"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                      Cadastrar novo evento
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: Desktop & Tablet (>= md) */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
            
            {/* Status de Rede */}
            <button
              onClick={onOpenSyncDiagnostics}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-slate-700 transition"
              title="Diagnósticos de sincronização e rede"
            >
              {syncStatus.isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-emerald-700 text-xs font-bold">Online</span>
                  {syncStatus.isSyncing && (
                    <span className="text-[10px] text-blue-600 animate-pulse hidden xl:inline font-medium">
                      • enviando CRM...
                    </span>
                  )}
                  {syncStatus.latencyMs && !syncStatus.isSyncing && (
                    <span className="text-[10px] text-slate-400 hidden xl:inline">
                      {syncStatus.latencyMs}ms
                    </span>
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700 text-xs font-bold">Offline</span>
                  {syncStatus.pendingCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-1 rounded-full">
                      {syncStatus.pendingCount}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Divisor vertical */}
            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Alternador de Layout */}
            <button
              onClick={onToggleLayout}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 transition"
              title={`Modo atual: ${layoutMode === 'side_by_side' ? 'Layout A (Lado a Lado)' : 'Layout B (2 Etapas)'}. Clique para alternar.`}
            >
              <Layout className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-normal">Layout</span>
              <span className="font-semibold text-slate-800">{layoutMode === 'side_by_side' ? 'A' : 'B'}</span>
            </button>

            {/* Gerenciar */}
            <button
              onClick={onOpenManagement}
              className="h-8 flex items-center gap-1.5 px-2.5 lg:px-3 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 shadow-sm transition"
              title="Painel de gerenciamento, participantes e exportação"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Gerenciar</span>
            </button>

            {/* Iniciar Totem */}
            <button
              onClick={onEnterKioskMode}
              className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/25 transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
              title="Entrar em Modo Totem Kiosk para os atletas"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Totem</span>
            </button>

            {/* Guia iPad */}
            <button
              onClick={onOpenKioskGuide}
              className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition flex-shrink-0"
              title="Guia de configuração para iPad e Totem"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

          </div>

          {/* LADO DIREITO: Mobile & iPhone (< md) - Compacto e sem quebra */}
          <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
            
            {/* Status Compacto */}
            <button
              onClick={onOpenSyncDiagnostics}
              className="h-8 px-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center gap-1 text-xs"
              title="Status da conexão"
            >
              {syncStatus.isOnline ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
              {syncStatus.pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1 rounded-full">
                  {syncStatus.pendingCount}
                </span>
              )}
            </button>

            {/* Botão de Menu de Ações Mobile (Hambúrguer iOS) */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition active:scale-95"
              title="Abrir menu de opções"
              aria-label="Abrir menu de opções"
            >
              <Menu className="w-4 h-4 text-slate-700" />
            </button>

          </div>

        </div>
      </header>

      {/* GAVETA / BOTTOM SHEET DE AÇÕES MOBILE (OTIMIZADA PARA O IPHONE) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
          >
            {/* Header da Gaveta */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-sm shadow-blue-600/30">
                  A
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Painel do Totem</h3>
                  <p className="text-[11px] text-slate-400">Opções rápidas para operação móvel</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Ações Touch Ampla para Polegar */}
            <div className="space-y-2.5">
              
              {/* Entrar em Modo Totem (Destaque Principal) */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onEnterKioskMode();
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 active:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/25 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  <Maximize2 className="w-4 h-4" />
                  <span>Iniciar Modo Totem</span>
                </div>
                <span className="text-[11px] bg-blue-500/60 px-2 py-0.5 rounded-full font-medium">Kiosk</span>
              </button>

              {/* Alternar Layout A / B */}
              <button
                onClick={() => {
                  onToggleLayout();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-50 active:bg-slate-100 border border-slate-200/80 text-slate-800 font-semibold text-sm flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  <Layout className="w-4 h-4 text-blue-600" />
                  <span>Alternar Layout</span>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  {layoutMode === 'side_by_side' ? 'Layout A (Lado a Lado)' : 'Layout B (2 Etapas)'}
                </span>
              </button>

              {/* Gerenciar e Exportar */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenManagement();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-50 active:bg-slate-100 border border-slate-200/80 text-slate-800 font-semibold text-sm flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-slate-600" />
                  <span>Gerenciar Corredores</span>
                </div>
                <span className="text-xs text-slate-400">CSV & Métricas</span>
              </button>

              {/* Diagnóstico de Rede */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenSyncDiagnostics();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-50 active:bg-slate-100 border border-slate-200/80 text-slate-800 font-semibold text-sm flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  {syncStatus.isOnline ? (
                    <Wifi className="w-4 h-4 text-blue-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-600" />
                  )}
                  <span>Status da Conexão</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${syncStatus.isOnline ? 'text-blue-700 bg-blue-50' : 'text-amber-800 bg-amber-100'}`}>
                  {syncStatus.isOnline ? 'Online' : `Offline (${syncStatus.pendingCount})`}
                </span>
              </button>

              {/* Guia iPad / PWA */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenKioskGuide();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-50 active:bg-slate-100 border border-slate-200/80 text-slate-700 font-semibold text-sm flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>Guia de Instalação (PWA)</span>
                </div>
                <span className="text-xs text-slate-400">Ajuda</span>
              </button>
            </div>

            {/* Fechar Gaveta */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Fechar Menu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
