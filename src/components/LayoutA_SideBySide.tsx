import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Phone, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
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
  const [mobileTab, setMobileTab] = useState<'form' | 'instagram'>('form');
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

      // Dispara mini confete comemorativo
      confetti({
        particleCount: 45,
        spread: 55,
        origin: { y: 0.65 },
        colors: ['#2563EB', '#0284C7', '#38BDF8', '#60A5FA'],
      });

      setLastRegisteredName(formattedName.split(' ')[0]);
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
    <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] min-h-0 md:h-full max-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-8 py-2 sm:py-4 select-none pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      
      {/* Toast de Sucesso Flutuante */}
      {showSuccessToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-5 sm:px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 border border-blue-400/30 max-w-[90vw]">
          <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0" />
          <div>
            <p className="font-extrabold text-sm">Cadastro realizado com sucesso!</p>
            <p className="text-xs text-blue-100">
              Obrigado, {lastRegisteredName}! Bom relaxamento na maca de massagem.
            </p>
          </div>
        </div>
      )}

      {/* Seletor de Abas Móvel (Visível apenas em smartphones / telas menores que md) */}
      <div className="flex md:hidden items-center p-1 bg-slate-200/80 rounded-2xl mb-3 shadow-inner w-full max-w-xs sm:max-w-sm mx-auto flex-shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'form'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Fazer Check-in</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('instagram')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'instagram'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-3.5 h-3.5 text-blue-600" />
          <span>Instagram & QR</span>
        </button>
      </div>

      {/* Grid Principal: Adaptativo no iPhone e Lado a Lado no iPad */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 lg:gap-7 xl:gap-8 items-stretch w-full min-h-0 max-h-none md:min-h-[560px] md:max-h-[720px] 2xl:max-h-[760px] my-auto">
        
        {/* LADO ESQUERDO: Formulário do Corredor (7 colunas no iPad, aba 'form' no iPhone) */}
        <div className={`md:col-span-7 bg-white rounded-3xl p-5 sm:p-7 lg:p-9 xl:p-10 border border-slate-200/90 shadow-xl shadow-blue-950/5 flex-col justify-between ${mobileTab === 'form' ? 'flex' : 'hidden md:flex'}`}>
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

            {/* Atalho Rápido para Instagram no Mobile */}
            <div className="flex md:hidden items-center justify-between p-2.5 px-3 rounded-2xl bg-blue-50/70 border border-blue-200/60 mt-3">
              <div className="flex items-center gap-2 min-w-0">
                <Camera className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs font-bold text-slate-800 truncate">{instagramHandle}</span>
              </div>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-extrabold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition flex-shrink-0"
              >
                <span>Seguir</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Formulário com Entradas Ergonômicas para Tela Touch */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between py-3 sm:py-4">
            <div className="space-y-4 sm:space-y-5">
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
            </div>

            {/* Botão de Envio Principal Posicionado com Harmonia */}
            <div className="pt-4 sm:pt-6">
              <button
                type="submit"
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

        {/* LADO DIREITO: Card do Instagram com QR Code e Botão Direto (5 colunas no iPad, aba 'instagram' no iPhone) */}
        <div className={`md:col-span-5 bg-gradient-to-br from-white via-blue-50/20 to-sky-50/30 text-slate-900 rounded-3xl p-5 sm:p-7 lg:p-8 border border-blue-100/90 shadow-xl shadow-blue-950/5 flex-col items-center justify-between text-center relative overflow-hidden ${mobileTab === 'instagram' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Efeitos de Luz de Fundo Sutis */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-sky-400/15 rounded-full blur-3xl pointer-events-none" />

          {/* Topo do Card Instagram */}
          <div className="relative z-10 w-full flex flex-col items-center">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 leading-tight">
              Siga a Activity
            </h3>
            
            <div className="inline-flex items-center gap-1.5 mt-2 px-4 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 font-extrabold text-sm sm:text-base tracking-wide shadow-sm">
              <span>{instagramHandle}</span>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xs mx-auto leading-relaxed">
              Siga nosso perfil e garanta seu atendimento de massagem!
            </p>
          </div>

          {/* QR Code com Tamanho Responsivo */}
          <div className="relative z-10 my-3 sm:my-auto p-3.5 sm:p-5 bg-white rounded-3xl shadow-xl shadow-blue-900/5 border-2 border-blue-100 flex flex-col items-center transition-transform duration-300 hover:scale-[1.02]">
            <QRCodeSVG
              value={instagramUrl}
              size={190}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
            />
            <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/80 text-blue-700 border border-blue-100/80 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>Aponte a Câmera do Celular</span>
            </div>
          </div>

          {/* Botão Direto para Quem Está no Próprio iPhone */}
          <div className="relative z-10 w-full max-w-xs">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              <span>Abrir Instagram no Celular</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className="mt-2.5 md:hidden text-xs font-bold text-blue-600 hover:underline py-1 w-full text-center"
            >
              ← Voltar ao Formulário de Check-in
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
