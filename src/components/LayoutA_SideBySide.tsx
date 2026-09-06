import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Phone, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Evento, Participante } from '../types';
import { db } from '../db';
import { syncService } from '../services/syncService';

import { formatNameTitleCase, isValidBrazilianCellPhone } from '../services/csvExport';
import { DEFAULT_ORG_ID } from '../db';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

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
    // Foco automático apenas em tablets/desktop para evitar abrir o teclado do iPhone na cara do usuário
    if (window.innerWidth >= 768) {
      nameInputRef.current?.focus();
    }
  }, []);

  // Máscara dinâmica de telefone brasileiro (11) 98765-4321
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

      // Dispara confete comemorativo bem no centro da tela e na frente de todas as camadas
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        zIndex: 10000,
        colors: ['#2563EB', '#0284C7', '#38BDF8', '#60A5FA', '#10B981'],
      });

      setLastRegisteredName(formattedName.split(' ')[0]);
      setShowSuccessToast(true);

      // Reseta os campos para o próximo corredor
      setNome('');
      setTelefone('');
      setAceitouComunicado(true);

      setTimeout(() => {
        setShowSuccessToast(false);
      }, 3800);

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
    <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] min-h-0 md:h-full max-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-8 py-2 sm:py-4 select-none pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      
      {/* Animação e Card de Sucesso Centralizado (Garantido na Frente de Tudo via Portal) */}
      {showSuccessToast && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 select-none"
          onClick={() => setShowSuccessToast(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full shadow-2xl border-2 border-blue-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ícone com Animação Centralizada */}
            <div className="relative mb-4 flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full bg-blue-100 animate-ping opacity-30" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-white" />
              </div>
            </div>

            {/* Tag de confirmação */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/80 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Massagem Confirmada</span>
            </div>

            {/* Título e Nome do Participante */}
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              Obrigado, <span className="text-blue-600">{lastRegisteredName}!</span> 🎉
            </h3>

            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              Seu check-in foi realizado com sucesso. Pode se dirigir à maca com nossos fisioterapeutas!
            </p>

            {/* Botão de avanço rápido */}
            <button
              type="button"
              onClick={() => {
                setShowSuccessToast(false);
                nameInputRef.current?.focus();
              }}
              className="mt-6 w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              OK, Vamos Lá!
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Grid Principal: Lado a Lado no iPad e Fluido em Todas as Telas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 lg:gap-7 xl:gap-8 items-stretch w-full min-h-0 max-h-none md:min-h-[560px] md:max-h-[720px] 2xl:max-h-[760px] my-auto">
        
        {/* LADO ESQUERDO: Formulário do Corredor (7 colunas no iPad) */}
        <div className="md:col-span-7 bg-white rounded-3xl p-5 sm:p-7 lg:p-9 xl:p-10 border border-slate-200/90 shadow-xl shadow-blue-950/5 flex flex-col justify-between">
          {/* Header da Ação */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2 border border-blue-200/70 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="truncate max-w-[240px] sm:max-w-none">{evento?.nome || 'Atendimento de Massagem Esportiva'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Check-in para Massagem
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Preencha seus dados rápidos para liberar seu atendimento pós-prova.
            </p>
          </div>

          {/* Formulário com Entradas Ergonômicas para Tela Touch */}
          <form id="checkin-form" onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Campo Nome */}
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
                  placeholder="Ex: Rafael Minatto"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  className="w-full pl-12 pr-4 min-h-[50px] sm:min-h-[56px] rounded-2xl bg-slate-50/90 border border-slate-200 text-slate-900 text-base sm:text-lg font-bold placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-none transition shadow-sm touch-manipulation"
                />
              </div>
            </div>

            {/* Campo Telefone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Telefone / WhatsApp (com DDD)
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
                  className="w-full pl-12 pr-4 min-h-[50px] sm:min-h-[56px] rounded-2xl bg-slate-50/90 border border-slate-200 text-slate-900 text-base sm:text-lg font-bold placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-none transition shadow-sm touch-manipulation"
                />
              </div>
            </div>

            {/* Checkbox de Consentimento com Área de Toque Expandida */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer select-none group p-1 -m-1 rounded-xl touch-manipulation">
                <input
                  type="checkbox"
                  checked={aceitouComunicado}
                  onChange={(e) => setAceitouComunicado(e.target.checked)}
                  className="w-5 h-5 rounded-md border-2 border-slate-300 text-blue-600 focus:ring-0 mt-0.5 cursor-pointer flex-shrink-0 touch-manipulation"
                />
                <div className="text-xs sm:text-sm text-slate-600 leading-snug">
                  <span className="font-bold text-slate-800">
                    Concordo em receber apenas um comunicado
                  </span>{' '}
                  via WhatsApp com meu voucher oficial de avaliação fisioterapêutica gratuita.
                </div>
              </label>
            </div>
          </form>

          {/* Rodapé LGPD */}
          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Protegido conforme LGPD</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
              <span>Pressione</span>
              <strong className="font-bold text-slate-700">Enter ↵</strong>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Card do Instagram com QR Code Maior e Botão de Confirmação (5 colunas no iPad) */}
        <div className="md:col-span-5 bg-gradient-to-br from-white via-blue-50/20 to-sky-50/30 text-slate-900 rounded-3xl p-5 sm:p-7 lg:p-8 border border-blue-100/90 shadow-xl shadow-blue-950/5 flex flex-col items-center justify-between text-center relative overflow-hidden">
          
          {/* Efeitos de Luz de Fundo Sutis */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-sky-400/15 rounded-full blur-3xl pointer-events-none" />

          {/* Topo do Card Instagram */}
          <div className="relative z-10 w-full flex flex-col items-center">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 text-blue-700 font-extrabold text-sm sm:text-base tracking-wide shadow-sm transition active:scale-95"
            >
              <span>{instagramHandle}</span>
            </a>
            
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Siga nosso perfil e garanta seu atendimento de massagem!
            </p>
          </div>

          {/* QR Code com Tamanho Maior */}
          <div className="relative z-10 my-3 sm:my-auto p-4 sm:p-5 bg-white rounded-3xl shadow-xl shadow-blue-900/5 border-2 border-blue-100 flex flex-col items-center transition-transform duration-300 hover:scale-[1.02]">
            <QRCodeSVG
              value={instagramUrl}
              size={320}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
            />
            <div className="mt-3 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50/90 text-blue-700 border border-blue-100/90 text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm">
              <InstagramIcon className="w-4 h-4 text-blue-600" />
              <span>Siga-nos no Instagram</span>
            </div>
          </div>

          {/* Botão Confirmar e Fazer Massagem (Posicionado Abaixo do QR Code) */}
          <div className="relative z-10 w-full max-w-xs sm:max-w-sm mt-1 sm:mt-2">
            <button
              type="submit"
              form="checkin-form"
              disabled={isSubmitting}
              className="w-full min-h-[52px] sm:min-h-[58px] py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 bg-[length:200%_auto] hover:bg-right hover:shadow-xl hover:shadow-blue-500/25 text-white text-base sm:text-xl font-black tracking-tight shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 cursor-pointer touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <span>Confirmar e Fazer Massagem</span>
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
