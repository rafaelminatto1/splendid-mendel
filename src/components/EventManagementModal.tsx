import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  X, 
  Download, 
  Search, 
  Users, 
  CheckCircle, 
  MessageSquare, 
  Calendar, 
  RefreshCw,
  ExternalLink,
  Trash2,
  TrendingUp,
  UserCheck,
  Send,
  Copy
} from 'lucide-react';
import type { Evento, Participante } from '../types';
import { 
  exportParticipantesToCSV, 
  normalizePhoneForWhatsApp, 
  formatPhoneForDisplay, 
  formatNameTitleCase,
  calculateFunnelMetrics 
} from '../services/csvExport';
import { 
  buildWhatsAppLink, 
  buildWhatsAppTemplateText, 
  trackWhatsAppMessageSent 
} from '../services/whatsappTemplate';
import { syncService } from '../services/syncService';
import { db } from '../db';
import { MetaAutomationTab } from './MetaAutomationTab';

export { calculateFunnelMetrics };

export interface FunnelStats {
  atendidos: number;
  em_contato: number;
  convertidos: number;
}

interface EventManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventos: Evento[];
  selectedEvento: Evento | null;
  onSelectEvento: (id: string) => void;
  participantes?: Participante[];
  onOpenCreateEvento: () => void;
  funnelStats?: Record<string, FunnelStats>;
}

export const EventManagementModal: React.FC<EventManagementModalProps> = ({
  isOpen,
  onClose,
  eventos,
  selectedEvento,
  onSelectEvento,
  participantes: propParticipantes,
  onOpenCreateEvento,
  funnelStats: propFunnelStats,
}) => {
  const [activeTab, setActiveTab] = useState<'participantes' | 'meta_template'>('participantes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptInOnly, setFilterOptInOnly] = useState(false);
  const [cloudFunnelStats, setCloudFunnelStats] = useState<Record<string, FunnelStats>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [contactedMap, setContactedMap] = useState<Record<string, string>>({});

  // Consulta reativa executada enquanto o modal estiver montado
  const liveParticipantes = useLiveQuery(
    () => db.participantes.orderBy('created_at').reverse().toArray(),
    []
  ) || [];

  const participantes = propParticipantes || liveParticipantes;

  // Busca estatísticas de funil da nuvem (Neon) quando o modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const fetchFunnelStats = async () => {
      try {
        setIsLoadingStats(true);
        const settings = await db.settings.get('global_settings');
        const syncUrl = settings?.neon_sync_url || '/api/sync';
        const res = await fetch(syncUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Totem-Sync-Version': '2.0',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.funnel_stats && isMounted) {
            setCloudFunnelStats(data.funnel_stats);
          }
        }
      } catch (err) {
        console.warn('Totem: offline ou falha ao buscar estatísticas do funil na nuvem:', err);
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    };

    fetchFunnelStats();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedEvento?.id]);

  // Filtra participantes pelo evento selecionado
  const filteredByEvent = useMemo(() => {
    if (!selectedEvento) return participantes;
    return participantes.filter(p => p.evento_id === selectedEvento.id);
  }, [participantes, selectedEvento]);

  // Filtra por termo de busca e opt-in
  const displayedParticipantes = useMemo(() => {
    return filteredByEvent.filter(p => {
      const matchesSearch = 
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contato.includes(searchTerm);
      const matchesOptIn = filterOptInOnly ? p.aceitou_comunicado : true;
      return matchesSearch && matchesOptIn;
    });
  }, [filteredByEvent, searchTerm, filterOptInOnly]);

  // Contadores operacionais locais
  const totalCount = filteredByEvent.length;
  const optInCount = filteredByEvent.filter(p => p.aceitou_comunicado).length;
  const syncedCount = filteredByEvent.filter(p => p.synced).length;
  const optInPercent = totalCount > 0 ? Math.round((optInCount / totalCount) * 100) : 0;

  // Cálculo das 4 métricas do Funil de Conversão (PROJECT.md §Contract 4, ORIGINAL_REQUEST §R3)
  const funnelMetrics = useMemo(() => {
    const eventId = selectedEvento?.id;
    const cloud = eventId ? (propFunnelStats?.[eventId] || cloudFunnelStats[eventId]) : null;

    // a. Total Atendidos: Quantidade de corredores registrados na tenda da corrida
    const localAtendidos = filteredByEvent.length;
    const totalAtendidos = cloud?.atendidos !== undefined 
      ? Math.max(cloud.atendidos, localAtendidos) 
      : localAtendidos;

    // b. Respostas / Em Contato: Quantidade de leads da corrida que responderam ou avançaram no WhatsApp
    // (estagio IN ('em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado'))
    const localEmContato = filteredByEvent.filter(p => {
      const stage = contactedMap[p.id] || (p as any).estagio;
      return ['em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado'].includes(stage);
    }).length;
    const emContatoCount = cloud?.em_contato !== undefined ? Math.max(cloud.em_contato, localEmContato) : localEmContato;

    // c. Convertidos em Clientes: Quantidade de leads da corrida que se tornaram clientes/pacientes da clínica (estagio = 'efetivado')
    const localConvertidos = filteredByEvent.filter(p => (p as any).estagio === 'efetivado').length;
    const convertidosCount = cloud?.convertidos !== undefined ? cloud.convertidos : localConvertidos;

    // d. Taxa de Conversão: Percentual de conversão de atendimentos em clientes ((convertidos / atendidos) * 100%).
    // Retorna "0.0%" se atendidos for 0 (prevenção contra divisão por zero / NaN).
    return calculateFunnelMetrics(totalAtendidos, emContatoCount, convertidosCount);
  }, [selectedEvento?.id, filteredByEvent, propFunnelStats, cloudFunnelStats, contactedMap]);

  const handleDeleteParticipante = async (id: string, nome: string) => {
    if (confirm(`Deseja remover o registro de "${nome}"?`)) {
      await db.participantes.delete(id);
      syncService.updatePendingCount();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Gerenciamento do Evento
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Visualização de atendimentos, métricas de corredores, exportação e automação Meta
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Seleção de Evento & Tabs */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          
          {/* Seletor do Evento Ativo */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#005F73]" /> Evento:
            </span>
            <select
              value={selectedEvento?.id || ''}
              onChange={(e) => onSelectEvento(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:border-[#005F73] outline-none"
            >
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome} ({ev.data_inicio})
                </option>
              ))}
            </select>

            <button
              onClick={onOpenCreateEvento}
              className="text-xs text-[#005F73] hover:underline font-bold px-1"
            >
              + Novo
            </button>
          </div>

          {/* Abas Superiores */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('participantes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'participantes'
                  ? 'bg-[#005F73] text-white shadow-md shadow-[#005F73]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Corredores ({totalCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('meta_template')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'meta_template'
                  ? 'bg-[#005F73] text-white shadow-md shadow-[#005F73]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Template & Automação Meta</span>
            </button>
          </div>

        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* ABA 1: LISTAGEM DE CORREDORES, FUNIL DE CONVERSÃO & EXPORTAÇÃO */}
          {activeTab === 'participantes' && (
            <div className="space-y-6">
              
              {/* 4 Cards de Métricas do Funil de Conversão (ORIGINAL_REQUEST §R3) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                
                {/* a. Total Atendidos */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Atendidos</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{funnelMetrics.atendidos}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">registrados na tenda</div>
                </div>

                {/* b. Respostas / Em Contato */}
                <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Respostas / Em Contato</span>
                    <MessageSquare className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="text-2xl font-black text-sky-900 mt-1">{funnelMetrics.em_contato}</div>
                  <div className="text-[11px] text-sky-700 mt-0.5">avançaram no WhatsApp</div>
                </div>

                {/* c. Convertidos em Clientes */}
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Convertidos em Clientes</span>
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{funnelMetrics.convertidos}</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">pacientes da clínica</div>
                </div>

                {/* d. Taxa de Conversão */}
                <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Taxa de Conversão</span>
                    <TrendingUp className="w-4 h-4 text-[#005F73]" />
                  </div>
                  <div className="text-2xl font-black text-[#005F73] mt-1">{funnelMetrics.taxa_conversao_formatted}</div>
                  <div className="text-[11px] text-teal-700 mt-0.5">atendimentos em clientes</div>
                </div>

              </div>

              {/* Barra de Status Operacional e Sincronização */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-4">
                  <span>
                    Opt-in LGPD: <strong className="text-slate-800">{optInCount}</strong> ({optInPercent}%)
                  </span>
                  <span>
                    Sincronizados na Nuvem: <strong className="text-emerald-700">{syncedCount}</strong>
                  </span>
                  <span>
                    Pendente no Tablet: <strong className="text-amber-700">{totalCount - syncedCount}</strong>
                  </span>
                </div>
                {isLoadingStats && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando funil...
                  </span>
                )}
              </div>

              {/* Barra de Filtros & Ações */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                
                {/* Campo de Busca */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar corredor por nome ou telefone..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] outline-none"
                  />
                </div>

                {/* Filtro Checkbox & Botão Exportar */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterOptInOnly}
                      onChange={(e) => setFilterOptInOnly(e.target.checked)}
                      className="rounded text-[#005F73] focus:ring-0"
                    />
                    <span>Apenas com aceite LGPD</span>
                  </label>

                  <button
                    onClick={() => {
                      const list = displayedParticipantes
                        .map(p => `${formatNameTitleCase(p.nome)}: ${normalizePhoneForWhatsApp(p.contato)}`)
                        .join('\n');
                      navigator.clipboard.writeText(list);
                      alert(`${displayedParticipantes.length} contatos copiados no formato WhatsApp!`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                    title="Copiar lista de nomes e telefones para broadcast"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiar Lista</span>
                  </button>

                  <button
                    onClick={() => exportParticipantesToCSV(displayedParticipantes, selectedEvento)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV ({displayedParticipantes.length})</span>
                  </button>
                </div>

              </div>

              {/* Tabela de Participantes */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Corredor</th>
                        <th className="px-4 py-3">Telefone / WhatsApp</th>
                        <th className="px-4 py-3">Data / Horário</th>
                        <th className="px-4 py-3 text-center">Opt-in LGPD</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Status CRM</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {displayedParticipantes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                            Nenhum corredor encontrado neste evento.
                          </td>
                        </tr>
                      ) : (
                        displayedParticipantes.map((p) => {
                          const eventName = selectedEvento?.nome || 'evento';
                          const waLink = buildWhatsAppLink(p.contato, p.nome, eventName);
                          const d = new Date(p.created_at);
                          const hora = isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          const data = isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
                          const formattedName = formatNameTitleCase(p.nome);
                          const formattedPhone = formatPhoneForDisplay(p.contato);
                          const isContacted = contactedMap[p.id] === 'em_contato' || (p as any).estagio === 'em_contato';
                          const stageLabel = (p as any).estagio === 'efetivado' 
                            ? 'Efetivado' 
                            : (isContacted 
                              ? 'Em Contato' 
                              : ((p as any).estagio ? (p as any).estagio : (p.synced ? 'Aguardando' : 'Pendente')));

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/60 transition">
                              <td className="px-4 py-3 font-bold text-slate-900">
                                {formattedName}
                              </td>
                              <td className="px-4 py-3">
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={async () => {
                                    setContactedMap(prev => ({ ...prev, [p.id]: 'em_contato' }));
                                    await trackWhatsAppMessageSent({
                                      telefone: p.contato,
                                      nome: p.nome,
                                      evento_id: selectedEvento?.id,
                                      evento_nome: eventName,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[#005F73] hover:underline font-semibold"
                                  title="Abrir WhatsApp com mensagem preenchida"
                                >
                                  <span>{formattedPhone}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </a>
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {data} às {hora}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {p.aceitou_comunicado ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle className="w-3 h-3" /> Sim
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    Não
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {p.synced ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    Nuvem
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                    Tablet
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  stageLabel === 'Efetivado'
                                    ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                                    : stageLabel === 'Em Contato'
                                      ? 'text-sky-800 bg-sky-100 border border-sky-300'
                                      : stageLabel === 'Aguardando'
                                        ? 'text-sky-700 bg-sky-50 border border-sky-200'
                                        : 'text-slate-600 bg-slate-100'
                                }`}>
                                  {stageLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={async () => {
                                      setContactedMap(prev => ({ ...prev, [p.id]: 'em_contato' }));
                                      await trackWhatsAppMessageSent({
                                        telefone: p.contato,
                                        nome: p.nome,
                                        evento_id: selectedEvento?.id,
                                        evento_nome: eventName,
                                      });
                                    }}
                                    className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                    title="Enviar WhatsApp com template preenchido"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => {
                                      const text = buildWhatsAppTemplateText(p.nome, eventName);
                                      navigator.clipboard.writeText(text);
                                      alert(`Mensagem copiada para ${formattedName}!`);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                    title="Copiar mensagem personalizada"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteParticipante(p.id, p.nome)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    title="Remover participante"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ABA 2: TEMPLATE E AUTOMAÇÃO META WHATSAPP */}
          {activeTab === 'meta_template' && (
            <MetaAutomationTab evento={selectedEvento} />
          )}

        </div>

      </div>
    </div>
  );
};
