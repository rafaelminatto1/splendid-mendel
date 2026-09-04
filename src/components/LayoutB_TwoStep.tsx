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
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Evento, Participante } from '../types';
import { db } from '../db';
import { syncService } from '../services/syncService';

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

  const handleResetToForm = () => {
    setNome('');
    setTelefone('');
    setAceitouComunicado(true);
    setStep('form');
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
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
      observacoes: 'Cadastrado no Totem iPad (Layout B - 2 Etapas)',
      aceitou_comunicado: aceitouComunicado,
      synced: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await db.participantes.add(novoParticipante);
      syncService.updatePendingCount();

      // Dispara confetes na tela
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#005F73', '#81B29A', '#38bdf8', '#f59e0b'],
      });

      setRegisteredRunner(nome.trim().split(' ')[0]);
      setStep('success');
    } catch (err) {
      console.error('Erro ao salvar participante:', err);
      alert('Ocorreu um erro ao salvar seu cadastro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== ETAPA 2: TELA DE SUCESSO & QR CODE EM DESTAQUE =====
  if (step === 'success') {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white rounded-3xl p-8 sm:p-14 border border-slate-200/80 shadow-2xl text-center relative overflow-hidden">
          
          {/* Efeito luminoso de fundo */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Ícone de Sucesso */}
          <div className="relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mb-6 border-4 border-emerald-100 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          {/* Título & Mensagem */}
          <div className="relative z-10 mb-8 max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Obrigado, {registeredRunner}! 🎉
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-2 font-medium">
              Sua massagem foi confirmada. Dirija-se à maca para seu relaxamento muscular!
            </p>
          </div>

          {/* Bloco Central do QR Code do Instagram */}
          <div className="relative z-10 bg-slate-900 text-white rounded-3xl p-8 sm:p-10 max-w-lg mx-auto shadow-2xl border border-slate-800">
            <div className="flex items-center justify-center gap-2 text-rose-400 text-sm font-bold uppercase tracking-wider mb-2">
              <Instagram className="w-5 h-5" />
              <span>Siga a Activity no Instagram</span>
            </div>
            
            <p className="text-xl sm:text-2xl font-black text-white mb-6">
              {instagramHandle}
            </p>

            {/* O QR Code */}
            <div className="bg-white p-5 rounded-2xl inline-block shadow-xl border-4 border-white/20 mb-6">
              <QRCodeSVG
                value={instagramUrl}
                size={220}
                level="H"
                includeMargin={false}
                fgColor="#0F172A"
              />
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
              Aponte a câmera do seu celular para conferir os stories, fotos do evento e concorrer a benefícios exclusivos!
            </p>
          </div>

          {/* Barra de Contagem Regressiva & Botão Próximo */}
          <div className="relative z-10 mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={handleResetToForm}
              className="w-full sm:w-auto flex-1 py-4 px-8 rounded-2xl bg-gradient-to-r from-[#005F73] to-[#004655] hover:from-[#004655] hover:to-[#003844] text-white text-base sm:text-lg font-bold shadow-xl shadow-[#005F73]/25 flex items-center justify-center gap-2 transition transform active:scale-95"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Próximo Atendimento</span>
            </button>

            <div className="text-xs font-semibold text-slate-400 bg-slate-100 px-4 py-3 rounded-2xl border border-slate-200 flex items-center gap-2">
              <span>Próximo em <strong>{countdown}s</strong></span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#005F73] animate-ping" />
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ===== ETAPA 1: FORMULÁRIO ULTRA-RÁPIDO =====
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 sm:p-14 border border-slate-200/80 shadow-2xl shadow-slate-200/50">
        
        {/* Header do Formulário */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-[#005F73] text-xs font-bold mb-3 border border-teal-200/60">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{evento?.nome || 'Atendimento de Massagem Esportiva'}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Check-in de Massagem
          </h2>
          <p className="text-base text-slate-500 mt-2 max-w-lg mx-auto">
            Digite seu nome e WhatsApp para iniciar seu atendimento pós-corrida.
          </p>
        </div>

        {/* Formulário com entradas extra grandes */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Nome Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <User className="w-6 h-6" />
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
                className="w-full pl-14 pr-4 py-5 rounded-2xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-xl sm:text-2xl font-bold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-4 focus:ring-[#005F73]/10 outline-none transition"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              WhatsApp (com DDD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-6 h-6" />
              </div>
              <input
                type="tel"
                required
                value={telefone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                className="w-full pl-14 pr-4 py-5 rounded-2xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-xl sm:text-2xl font-bold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-4 focus:ring-[#005F73]/10 outline-none transition"
              />
            </div>
          </div>

          {/* Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceitouComunicado}
                onChange={(e) => setAceitouComunicado(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-[#005F73] focus:ring-[#005F73] focus:ring-offset-0 mt-0.5 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-600 leading-snug">
                Concordo em receber apenas um comunicado no WhatsApp com meu voucher de avaliação gratuita na Activity Fisioterapia.
              </span>
            </label>
          </div>

          {/* Botão de Envio Gigante */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-[#005F73] to-[#004655] hover:from-[#004655] hover:to-[#003844] text-white text-xl font-extrabold shadow-xl shadow-[#005F73]/25 flex items-center justify-center gap-3 transition transform active:scale-[0.99] disabled:opacity-60"
          >
            <span>Confirmar e Continuar</span>
            <ArrowRight className="w-6 h-6" />
          </button>
        </form>

        {/* Rodapé LGPD */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Privacidade garantida conforme LGPD</span>
          </div>
          <span>Tecle <strong>Enter</strong> para avançar</span>
        </div>

      </div>
    </div>
  );
};
