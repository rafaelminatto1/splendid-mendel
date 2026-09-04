import React, { useState } from 'react';
import { X, Calendar, MapPin, Tag, Users, AlignLeft, Check } from 'lucide-react';
import type { Evento } from '../types';
import { db, DEFAULT_ORG_ID } from '../db';
import { syncService } from '../services/syncService';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (evento: Evento) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [local, setLocal] = useState('');
  const [categoria, setCategoria] = useState('Corrida de Rua');
  const [participantesPrevistos, setParticipantesPrevistos] = useState(300);
  const [descricao, setDescricao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !dataInicio) {
      alert('Preencha o nome e a data do evento.');
      return;
    }

    setIsSubmitting(true);
    const novoEvento: Evento = {
      id: crypto.randomUUID(),
      organization_id: DEFAULT_ORG_ID,
      nome: nome.trim(),
      data_inicio: dataInicio,
      local: local.trim() || undefined,
      categoria: categoria,
      participantes_previstos: Number(participantesPrevistos) || 0,
      descricao: descricao.trim() || undefined,
      gratuito: true,
      status: 'ativo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await db.eventos.add(novoEvento);
      // Sincroniza imediatamente o novo evento com o Neon
      syncService.syncEventosNow();
      onEventCreated(novoEvento);
      onClose();
      // Limpa os campos
      setNome('');
      setLocal('');
      setDescricao('');
    } catch (err) {
      console.error('Erro ao criar evento:', err);
      alert('Não foi possível salvar o evento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Cadastrar Novo Evento</h3>
            <p className="text-xs text-slate-500">Configure uma nova ação de massagem esportiva</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          
          {/* Nome do Evento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nome do Evento *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Corrida do Juventus 2026"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/20 outline-none transition"
            />
          </div>

          {/* Grid com Data e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#005F73]" />
                Data do Evento *
              </label>
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#005F73]" />
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/20 outline-none transition"
              >
                <option value="Corrida de Rua">Corrida de Rua</option>
                <option value="Meia Maratona / Maratona">Meia Maratona / Maratona</option>
                <option value="Trail Run">Trail Run</option>
                <option value="Crossfit / Funcional">Crossfit / Funcional</option>
                <option value="Ciclismo / Triathlon">Ciclismo / Triathlon</option>
                <option value="Corporativo">Corporativo</option>
              </select>
            </div>
          </div>

          {/* Local do Evento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#005F73]" />
              Local / Endereço
            </label>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Clube Atlético Juventus - Mooca / SP"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/20 outline-none transition"
            />
          </div>

          {/* Estimativa de Participantes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#005F73]" />
              Meta de Atendimentos Previstos
            </label>
            <input
              type="number"
              min={10}
              max={10000}
              value={participantesPrevistos}
              onChange={(e) => setParticipantesPrevistos(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/20 outline-none transition"
            />
          </div>

          {/* Botões */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#005F73] hover:bg-[#004655] text-white text-sm font-bold shadow-md shadow-[#005F73]/25 flex items-center gap-2 transition disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Evento</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
