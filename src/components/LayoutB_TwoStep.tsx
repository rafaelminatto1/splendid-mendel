import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Phone, 
  Instagram, 
  Sparkles, 
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Evento, Participante } from '../types';
import { db } from '../db';
import { syncService } from '../services/syncService';

import { formatNameTitleCase, isValidBrazilianCellPhone } from '../services/csvExport';
import { DEFAULT_ORG_ID } from '../db';

interface LayoutBProps {
  evento: Evento | null;
  instagramHandle: string;
  instagramUrl: string;
  autoResetSeconds: number;
}

export const LayoutB_TwoStep: React.FC<LayoutBProps> = ({
  evento,
  instagramHandle,
  instagramUrl,
  autoResetSeconds = 6,
}) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [aceitouComunicado, setAceitouComunicado] = useState(true);
  const [countdown, setCountdown] = useState(autoResetSeconds);
  const [registeredRunner, setRegisteredRunner] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'form') {
      nameInputRef.current?.focus();
    }
  }, [step]);

  // Contagem regressiva automática na tela de sucesso
  useEffect(() => {
    let timer: any = null;
    if (step === 'success') {
      setCountdown(autoResetSeconds);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleResetToForm();
            return autoResetSeconds;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, autoResetSeconds]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11 && !value.startsWith('55')) value = value.slice(0, 11);

    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setTelefone(value);
  };

  const handleResetToForm = () => {
    setNome('');
    setTelefone('');
    setAceitouComunicado(true);
    setStep('form');
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 80);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!nome.trim() || nome.trim().length < 2) {
      alert('Por favor, digite seu nome.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanDigits = telefone.replace(/\D/g, '');
    if (cleanDigits.length === 10) {
      alert('Por favor, informe seu celular com o nono dígito (ex: 11 98765-4321).');
      return;
    }
    if (!isValidBrazilianCellPhone(cleanDigits)) {
      alert('Por favor, digite um número de WhatsApp válido com DDD (11 dígitos).');
      return;
    }

    setIsSubmitting(true);
    const formattedName = formatNameTitleCase(nome);

    const novoParticipante: Participante = {
      id: crypto.randomUUID(),
      organization_id: DEFAULT_ORG_ID,
      evento_id: evento?.id || '786ec561-bac1-471a-af67-817537d1328c',
      nome: formattedName,
      contato: cleanDigits,
      instagram: '',
      segue_perfil: true,
      observacoes: 'Cadastrado no Totem iPad (Layout B - 2 Etapas)',
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

      // Dispara confetes na tela
      confetti({
        particleCount: 70,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#005F73', '#81B29A', '#38bdf8', '#f59e0b'],
      });

      setRegisteredRunner(formattedName.split(' ')[0]);
      setStep('success');
    } catch (err) {
      console.error('Erro ao salvar participante:', err);
      alert('Ocorreu um erro ao salvar seu cadastro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== ETAPA 2: TELA DE SUCESSO & QR CODE EM DESTAQUE (100% CABE NA TELA SEM ROLAR) =====
  if (step === 'success') {
    return (
      <div className="w-full max-w-xl h-full max-h-full flex flex-col justify-center px-4 py-1 select-none my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xl text-center relative overflow-hidden max-h-[630px] flex flex-col justify-between my-auto">
          
          {/* Topo: Ícone + Título */}
          <div>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mb-2 border-2 border-emerald-100 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Obrigado, {registeredRunner}! 🎉
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
              Sua massagem está confirmada. Pode se dirigir à maca!
            </p>
          </div>

          {/* Bloco Central do QR Code do Instagram */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 max-w-sm mx-auto shadow-xl border border-slate-800 my-2">
            <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Instagram className="w-4 h-4" />
              <span>Siga a Activity no Instagram</span>
            </div>
            
            <p className="text-base sm:text-lg font-black text-white mb-2.5">
              {instagramHandle}
            </p>

            {/* O QR Code */}
            <div className="bg-white p-3 rounded-xl inline-block shadow-lg border-2 border-white/20 mb-2">
              <QRCodeSVG
                value={instagramUrl}
                size={145}
                level="H"
                includeMargin={false}
                fgColor="#0F172A"
              />
            </div>

            <p className="text-[11px] text-slate-300 leading-tight max-w-xs mx-auto">
              Aponte a câmera do seu celular para conferir as fotos e bastidores da prova!
            </p>
          </div>

          {/* Barra de Contagem Regressiva & Botão Próximo */}
          <div className="flex flex-row items-center justify-center gap-3 max-w-md mx-auto w-full pt-1">
            <button
              onClick={handleResetToForm}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-[#005F73] to-[#004655] hover:from-[#004655] hover:to-[#003844] text-white text-sm sm:text-base font-bold shadow-lg shadow-[#005F73]/25 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Próximo Atendimento</span>
            </button>

            <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3.5 py-3 rounded-xl border border-slate-200 flex items-center gap-2 flex-shrink-0">
              <span>Próximo em <strong>{countdown}s</strong></span>
              <div className="w-2 h-2 rounded-full bg-[#005F73] animate-ping" />
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ===== ETAPA 1: FORMULÁRIO ULTRA-RÁPIDO (100% CABE NA TELA SEM ROLAR) =====
  return (
    <div className="w-full max-w-xl h-full max-h-full flex flex-col justify-center px-4 py-1 select-none my-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-2xl max-h-[630px] flex flex-col justify-between my-auto">
        
        {/* Header do Formulário */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-[#005F73] text-[11px] font-bold mb-2 border border-teal-200/60">
            <Sparkles className="w-3 h-3" />
            <span>{evento?.nome || 'Atendimento de Massagem Esportiva'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Check-in de Massagem
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Digite seu nome e WhatsApp para iniciar seu atendimento pós-corrida.
          </p>
        </div>

        {/* Formulário com entradas limpas e tateis */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Nome */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nome Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                autoComplete="off"
                autoCapitalize="words"
                className="w-full pl-11 pr-3.5 py-3 sm:py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-lg sm:text-xl font-bold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-4 focus:ring-[#005F73]/10 outline-none transition"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              WhatsApp (com DDD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                required
                value={telefone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                className="w-full pl-11 pr-3.5 py-3 sm:py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-lg sm:text-xl font-bold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-4 focus:ring-[#005F73]/10 outline-none transition"
              />
            </div>
          </div>

          {/* Checkbox */}
          <div className="pt-0.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceitouComunicado}
                onChange={(e) => setAceitouComunicado(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-slate-300 text-[#005F73] focus:ring-0 mt-0.5 cursor-pointer flex-shrink-0"
              />
              <span className="text-[11px] sm:text-xs text-slate-600 leading-snug">
                Concordo em receber apenas um comunicado no WhatsApp com meu voucher oficial de avaliação gratuita na Activity.
              </span>
            </label>
          </div>

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 sm:py-4 px-6 rounded-xl bg-gradient-to-r from-[#005F73] to-[#004655] hover:from-[#004655] hover:to-[#003844] text-white text-lg font-black shadow-lg shadow-[#005F73]/25 flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-60"
          >
            <span>Confirmar e Continuar</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Rodapé LGPD */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Privacidade garantida conforme LGPD</span>
          </div>
          <span>Tecle <strong>Enter</strong></span>
        </div>

      </div>
    </div>
  );
};
