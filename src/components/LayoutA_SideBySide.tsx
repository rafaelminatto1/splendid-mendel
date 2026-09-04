import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Phone, 
  Instagram, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Evento, Participante } from '../types';
import { db } from '../db';
import { syncService } from '../services/syncService';

interface LayoutAProps {
  evento: Evento | null;
  instagramHandle: string;
  instagramUrl: string;
}

export const LayoutA_SideBySide: React.FC<LayoutAProps> = ({
  evento,
  instagramHandle,
  instagramUrl,
}) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [aceitouComunicado, setAceitouComunicado] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [lastRegisteredName, setLastRegisteredName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Máscara dinâmica de telefone brasileiro (11) 98765-4321
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setTelefone(value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nome.trim()) {
      nameInputRef.current?.focus();
      return;
    }

    const cleanDigits = telefone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      alert('Por favor, digite um telefone com DDD válido.');
      return;
    }

    setIsSubmitting(true);
    const novoParticipante: Participante = {
      id: crypto.randomUUID(),
      evento_id: evento?.id || 'evento-geral',
      nome: nome.trim(),
      contato: cleanDigits,
      instagram: '',
      segue_perfil: true,
      observacoes: 'Cadastrado no Totem iPad (Layout Lado a Lado)',
      aceitou_comunicado: aceitouComunicado,
      synced: false,
      sync_status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await db.participantes.add(novoParticipante);
      syncService.updatePendingCount();

      // Dispara mini confete comemorativo
      confetti({
        particleCount: 45,
        spread: 55,
        origin: { y: 0.65 },
        colors: ['#005F73', '#81B29A', '#38bdf8'],
      });

      setLastRegisteredName(nome.trim().split(' ')[0]);
      setShowSuccessToast(true);

      // Reseta os campos para o próximo corredor
      setNome('');
      setTelefone('');
      setAceitouComunicado(true);

      setTimeout(() => {
        setShowSuccessToast(false);
      }, 3500);

      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 80);
    } catch (err) {
      console.error('Erro ao registrar participante:', err);
      alert('Ocorreu um erro ao salvar o cadastro localmente. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl h-full max-h-full flex flex-col justify-center px-2 sm:px-4 py-1 select-none">
      
      {/* Toast de Sucesso Flutuante */}
      {showSuccessToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <div>
            <p className="font-bold text-xs">Cadastro realizado com sucesso!</p>
            <p className="text-[11px] text-emerald-100">
              Obrigado, {lastRegisteredName}! Bom relaxamento na massagem.
            </p>
          </div>
        </div>
      )}

      {/* Grid Principal Compacto: 100% visível na tela sem rolar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 lg:gap-5 items-stretch w-full max-h-[640px] my-auto">
        
        {/* LADO ESQUERDO: Formulário do Corredor (7 colunas) */}
        <div className="md:col-span-7 bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 lg:p-6 border border-slate-200/80 shadow-lg flex flex-col justify-between">
          <div>
            {/* Header da Ação */}
            <div className="mb-3 sm:mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-[#005F73] text-[11px] font-bold mb-1.5 border border-teal-200/60">
                <Sparkles className="w-3 h-3" />
                <span>{evento?.nome || 'Atendimento de Massagem Esportiva'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Check-in para Massagem
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Preencha seus dados rápidos para liberar sua massagem pós-prova.
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
              {/* Campo Nome */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Rafael Minatto"
                    autoComplete="off"
                    autoCapitalize="words"
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-base sm:text-lg font-semibold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/10 outline-none transition"
                  />
                </div>
              </div>

              {/* Campo Telefone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Telefone / WhatsApp (com DDD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={telefone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-base sm:text-lg font-semibold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-2 focus:ring-[#005F73]/10 outline-none transition"
                  />
                </div>
              </div>

              {/* Checkbox de Consentimento */}
              <div className="pt-0.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={aceitouComunicado}
                    onChange={(e) => setAceitouComunicado(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-slate-300 text-[#005F73] focus:ring-0 mt-0.5 cursor-pointer flex-shrink-0"
                  />
                  <div className="text-[11px] sm:text-xs text-slate-600 leading-snug">
                    <span className="font-bold text-slate-800">
                      Concordo em receber apenas um comunicado
                    </span>{' '}
                    via WhatsApp com meu voucher de avaliação fisioterapêutica gratuita.
                  </div>
                </label>
              </div>

              {/* Botão de Envio Principal */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#005F73] to-[#004655] hover:from-[#004655] hover:to-[#003844] text-white text-base sm:text-lg font-bold tracking-tight shadow-lg shadow-[#005F73]/25 flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-60"
              >
                <span>Confirmar e Fazer Massagem</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Rodapé LGPD */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Protegido conforme LGPD</span>
            </div>
            <span>Pressione <strong>Enter</strong></span>
          </div>
        </div>

        {/* LADO DIREITO: Card do Instagram com QR Code Fixo (5 colunas) */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-lg flex flex-col items-center justify-between text-center relative overflow-hidden">
          
          {/* Topo do Card Instagram */}
          <div className="relative z-10 w-full">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white mb-2 shadow-md shadow-rose-500/20">
              <Instagram className="w-5 h-5" />
            </div>
            
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
              Siga nosso Instagram
            </h3>
            
            <p className="text-teal-400 font-bold text-sm mt-0.5">
              {instagramHandle}
            </p>
            
            <p className="text-[11px] text-slate-300 mt-1 max-w-xs mx-auto leading-tight">
              Aponte a câmera para ver as fotos e stories da corrida!
            </p>
          </div>

          {/* Container do QR Code (Tamanho otimizado para caber na tela) */}
          <div className="relative z-10 my-2.5 p-3 bg-white rounded-xl shadow-xl border-2 border-white/20 inline-block">
            <QRCodeSVG
              value={instagramUrl}
              size={155}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
            />
            <div className="mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              Aponte a Câmera
            </div>
          </div>

          {/* Botão de Link Direto */}
          <div className="relative z-10 w-full">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold border border-white/10 transition"
            >
              <span>Abrir perfil no Instagram</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>

        </div>

      </div>
    </div>
  );
};
