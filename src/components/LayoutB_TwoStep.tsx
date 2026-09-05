import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Phone, 
  Sparkles, 
  ArrowRight,
  RotateCcw,
  CheckCircle2, 
  ShieldCheck,
  Camera,
  ExternalLink
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
    if (step === 'form' && window.innerWidth >= 768) {
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
        colors: ['#2563EB', '#0284C7', '#38BDF8', '#60A5FA'],
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

  // ===== ETAPA 2: TELA DE SUCESSO & QR CODE EM DESTAQUE (AMPLO E PREENCHIDO) =====
  if (step === 'success') {
    return (
      <div className="w-full max-w-4xl xl:max-w-5xl min-h-0 md:h-full max-h-full flex flex-col justify-center px-2 sm:px-4 py-2 select-none my-auto animate-in fade-in zoom-in-95 duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <div className="bg-white rounded-3xl p-5 sm:p-8 lg:p-10 border border-slate-200/90 shadow-2xl relative overflow-hidden max-h-none md:max-h-[740px] my-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Coluna Esquerda: Confirmação e Chamada para Ação (6 colunas) */}
            <div className="md:col-span-6 flex flex-col justify-between text-left h-full py-2">
              <div>
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-blue-50 text-blue-600 mb-3 sm:mb-4 border-2 border-blue-200 shadow-sm">
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <div className="inline-block px-3 py-1 rounded-full bg-blue-100/80 text-blue-800 text-xs font-bold mb-2 ml-2">
                  Atendimento Confirmado
                </div>

                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Obrigado, <br className="hidden sm:inline" />
                  <span className="text-blue-600">{registeredRunner}!</span> 🎉
                </h2>
                
                <p className="text-sm sm:text-base text-slate-600 mt-2.5 leading-relaxed">
                  Sua massagem pós-prova está confirmada. Pode se dirigir à maca com nossos fisioterapeutas!
                </p>

                <div className="mt-4 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/60 text-xs text-blue-800 font-medium leading-snug flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span>Enviamos seu voucher oficial de avaliação fisioterapêutica gratuita no seu WhatsApp!</span>
                </div>
              </div>

              {/* Barra de Ação & Contagem */}
              <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleResetToForm}
                  className="w-full sm:flex-1 min-h-[50px] py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 hover:shadow-xl hover:shadow-blue-500/25 text-white text-base font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Próximo Atendimento</span>
                </button>

                <div className="text-xs font-bold text-slate-600 bg-slate-100 px-4 py-3 sm:py-4 rounded-2xl border border-slate-200 flex items-center justify-center gap-2 w-full sm:w-auto flex-shrink-0">
                  <span>Próximo em <strong>{countdown}s</strong></span>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                </div>
              </div>
            </div>

            {/* Coluna Direita: Card Instagram com QR Code e Botão Direto (6 colunas) */}
            <div className="md:col-span-6 bg-gradient-to-br from-white via-blue-50/20 to-sky-50/30 text-slate-900 rounded-3xl p-5 sm:p-7 shadow-xl shadow-blue-950/5 border border-blue-100/90 relative overflow-hidden flex flex-col items-center text-center">
              {/* Efeitos de Luz Sutis */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-sky-400/15 rounded-full blur-2xl pointer-events-none" />

              <h3 className="relative z-10 text-xl font-black text-slate-900 leading-tight">
                Siga a Activity
              </h3>

              <div className="relative z-10 inline-flex items-center gap-1.5 mt-1 px-3.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 font-extrabold text-sm mb-3">
                <span>{instagramHandle}</span>
              </div>

              {/* O QR Code Responsivo */}
              <div className="relative z-10 bg-white p-3.5 sm:p-5 rounded-3xl inline-block shadow-xl shadow-blue-900/5 border-2 border-blue-100 mb-2 sm:mb-3 transition-transform hover:scale-105">
                <QRCodeSVG
                  value={instagramUrl}
                  size={190}
                  level="H"
                  includeMargin={false}
                  fgColor="#0F172A"
                />
                <div className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/80 text-blue-700 border border-blue-100/80 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Aponte a Câmera do Celular</span>
                </div>
              </div>

              {/* Botão Direto para quem está no iPhone */}
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 w-full max-w-xs mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <span>Abrir Instagram no Celular</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <p className="relative z-10 text-xs text-slate-500 leading-relaxed max-w-xs mx-auto mt-2">
                Siga-nos para acompanhar fotos e novidades das corridas!
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ===== ETAPA 1: FORMULÁRIO ESPAÇOSO E TÁTIL PARA O TOTEM & IPHONE =====
  return (
    <div className="w-full max-w-2xl lg:max-w-3xl min-h-0 md:h-full max-h-full flex flex-col justify-center px-2 sm:px-4 py-2 select-none my-auto animate-in fade-in duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      <div className="bg-white rounded-3xl p-5 sm:p-9 lg:p-11 border border-slate-200/90 shadow-2xl max-h-none md:max-h-[720px] flex flex-col justify-between my-auto">
        
        {/* Header do Formulário */}
        <div className="text-center mb-3 sm:mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2.5 border border-blue-200/60 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span className="truncate max-w-[240px] sm:max-w-none">{evento?.nome || 'Atendimento de Massagem Esportiva'}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Check-in de Massagem
          </h2>
          <p className="text-xs sm:text-base text-slate-500 mt-1.5 max-w-md mx-auto">
            Digite seu nome e WhatsApp para iniciar seu atendimento pós-corrida.
          </p>
        </div>

        {/* Formulário com entradas limpas, táteis e confortáveis */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 my-auto py-2">
          
          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nome Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                className="w-full pl-12 pr-4 min-h-[50px] sm:min-h-[56px] rounded-2xl bg-slate-50/90 border-2 border-slate-200 text-slate-900 text-base sm:text-xl font-bold placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-none transition shadow-sm touch-manipulation"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              WhatsApp (com DDD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                inputMode="tel"
                required
                value={telefone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                enterKeyHint="done"
                className="w-full pl-12 pr-4 min-h-[50px] sm:min-h-[56px] rounded-2xl bg-slate-50/90 border-2 border-slate-200 text-slate-900 text-base sm:text-xl font-bold placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-none transition shadow-sm touch-manipulation"
              />
            </div>
          </div>

          {/* Checkbox */}
          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer select-none p-1 -m-1 rounded-xl touch-manipulation">
              <input
                type="checkbox"
                checked={aceitouComunicado}
                onChange={(e) => setAceitouComunicado(e.target.checked)}
                className="w-5 h-5 rounded-md border-2 border-slate-300 text-blue-600 focus:ring-0 mt-0.5 cursor-pointer flex-shrink-0 touch-manipulation"
              />
              <span className="text-xs sm:text-sm text-slate-600 leading-snug">
                Concordo em receber apenas um comunicado no WhatsApp com meu voucher oficial de avaliação gratuita na Activity.
              </span>
            </label>
          </div>

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[52px] sm:min-h-[58px] py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 bg-[length:200%_auto] hover:bg-right hover:shadow-xl hover:shadow-blue-500/25 text-white text-base sm:text-xl font-black shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 cursor-pointer touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <span>Confirmar e Continuar</span>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </>
            )}
          </button>
        </form>

        {/* Rodapé LGPD */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Privacidade garantida conforme LGPD</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
            <span>Pressione</span>
            <strong className="font-bold text-slate-700">Enter ↵</strong>
          </div>
        </div>

      </div>
    </div>
  );
};
