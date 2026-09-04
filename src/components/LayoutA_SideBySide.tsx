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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await db.participantes.add(novoParticipante);
      syncService.updatePendingCount();

      // Dispara mini confete comemorativo
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
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
      }, 4000);

      // Garante foco imediato no campo de nome para o próximo atleta
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error('Erro ao registrar participante:', err);
      alert('Ocorreu um erro ao salvar o cadastro localmente. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-10">
      
      {/* Toast de Sucesso Flutuante */}
      {showSuccessToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-6 h-6 text-white" />
          <div>
            <p className="font-bold text-sm">Cadastro realizado com sucesso!</p>
            <p className="text-xs text-emerald-100">
              Obrigado, {lastRegisteredName}! Bom relaxamento na massagem.
            </p>
          </div>
        </div>
      )}

      {/* Grid Principal: Formulário na Esquerda + QR Code na Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* LADO ESQUERDO: Formulário do Corredor (7 colunas) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xl shadow-slate-200/50 flex flex-col justify-between">
          <div>
            {/* Header da Ação */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-[#005F73] text-xs font-bold mb-3 border border-teal-200/60">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{evento?.nome || 'Atendimento de Massagem Esportiva'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Check-in para Massagem
              </h2>
              <p className="text-sm sm:text-base text-slate-500 mt-1">
                Preencha seus dados rápidos para liberar seu atendimento gratuito de recuperação pós-prova.
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campo Nome */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                    autoComplete="off"
                    autoCapitalize="words"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-lg sm:text-xl font-semibold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-4 focus:ring-[#005F73]/10 outline-none transition"
                  />
                </div>
              </div>

              {/* Campo Telefone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Telefone / WhatsApp (com DDD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={telefone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-lg sm:text-xl font-semibold placeholder:text-slate-400 focus:bg-white focus:border-[#005F73] focus:ring-4 focus:ring-[#005F73]/10 outline-none transition"
                  />
                </div>
              </div>

              {/* Checkbox de Consentimento */}
              <div className="pt-2">
                <label className="flex items-start gap-3.5 cursor-pointer select-none group">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={aceitouComunicado}
                      onChange={(e) => setAceitouComunicado(e.target.checked)}
                      className="w-5 h-5 rounded-lg border-2 border-slate-300 text-[#005F73] focus:ring-[#005F73] focus:ring-offset-0 cursor-pointer"
                    />
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 leading-snug">
                    <span className="font-semibold text-slate-800">
                      Concordo em receber apenas um comunicado
                    </span>{' '}
                    via WhatsApp com meu voucher oficial de avaliação fisioterapêutica gratuita na Activity.
                  </div>
                </label>
              </div>

              {/* Botão de Envio Principal */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-[#005F73] to-[#004655] hover:from-[#004655] hover:to-[#003844] text-white text-lg sm:text-xl font-bold tracking-tight shadow-xl shadow-[#005F73]/25 flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] disabled:opacity-60"
              >
                <span>Confirmar e Fazer Massagem</span>
                <ArrowRight className="w-6 h-6" />
              </button>
            </form>
          </div>

          {/* Rodapé de Confiança e LGPD */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Seus dados são 100% protegidos pela LGPD</span>
            </div>
            <span>Pressione <strong>Enter</strong> para enviar</span>
          </div>
        </div>

        {/* LADO DIREITO: Card do Instagram com QR Code Fixo (5 colunas) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col items-center justify-between text-center relative overflow-hidden">
          
          {/* Decoração de fundo sutil */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#005F73]/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-[#81B29A]/20 rounded-full blur-3xl pointer-events-none" />

          {/* Topo do Card Instagram */}
          <div className="relative z-10 w-full">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white mb-4 shadow-lg shadow-rose-500/25">
              <Instagram className="w-7 h-7" />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Siga nosso Instagram
            </h3>
            
            <p className="text-teal-400 font-bold text-base mt-0.5">
              {instagramHandle}
            </p>
            
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xs mx-auto leading-relaxed">
              Aponte a câmera do seu celular para acompanhar as fotos, dicas de recuperação muscular e stories da prova!
            </p>
          </div>

          {/* Container do QR Code */}
          <div className="relative z-10 my-6 p-4 sm:p-5 bg-white rounded-2xl shadow-2xl border-4 border-white/20">
            <QRCodeSVG
              value={instagramUrl}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
            />
            <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Aponte a Câmera
            </div>
          </div>

          {/* Botão de Link Direto */}
          <div className="relative z-10 w-full">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition"
            >
              <span>Abrir perfil no Instagram</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

        </div>

      </div>
    </div>
  );
};
