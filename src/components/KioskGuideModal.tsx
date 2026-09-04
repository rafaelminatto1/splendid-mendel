import React from 'react';
import { X, Tablet, Share, PlusSquare, Lock, WifiOff, CheckCircle2 } from 'lucide-react';

interface KioskGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KioskGuideModal: React.FC<KioskGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#005F73] flex items-center justify-center">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Guia de Instalação no iPad 10</h3>
              <p className="text-xs text-slate-500">Como instalar sem loja e travar em modo Totem (Kiosk)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Passos Ilustrados */}
        <div className="space-y-6 mt-6">
          
          {/* PASSO 1: Instalação PWA */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex items-center gap-2.5 font-bold text-slate-900 text-sm mb-2">
              <span className="w-6 h-6 rounded-full bg-[#005F73] text-white flex items-center justify-center text-xs">1</span>
              <span>Instalar no iPad 10 (Sem precisar da App Store)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              O aplicativo foi construído com tecnologia <strong>PWA (Progressive Web App)</strong>. No Safari do iPad, você pode instalá-lo diretamente na tela de início com ícone próprio:
            </p>
            <ol className="space-y-2 text-xs text-slate-700 pl-2">
              <li className="flex items-center gap-2">
                <Share className="w-4 h-4 text-[#005F73] flex-shrink-0" />
                <span>1. Abra o site no navegador <strong>Safari</strong> do iPad.</span>
              </li>
              <li className="flex items-center gap-2">
                <PlusSquare className="w-4 h-4 text-[#005F73] flex-shrink-0" />
                <span>2. Toque no botão de <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima).</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>3. Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</span>
              </li>
            </ol>
            <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500">
              ✨ Pronto! O app abrirá em tela cheia como se fosse um aplicativo nativo da Apple, sem a barra de endereços do Safari.
            </div>
          </div>

          {/* PASSO 2: Acesso Guiado (Kiosk Lock) */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex items-center gap-2.5 font-bold text-slate-900 text-sm mb-2">
              <span className="w-6 h-6 rounded-full bg-[#005F73] text-white flex items-center justify-center text-xs">2</span>
              <span>Travar o iPad em Modo Kiosk (Acesso Guiado)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Para impedir que os corredores fechem o app ou mexam em outros aplicativos do tablet durante o evento:
            </p>
            <ul className="space-y-2 text-xs text-slate-700 pl-2">
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>No iPad, acesse: <strong>Ajustes &gt; Acessibilidade &gt; Acesso Guiado</strong> e ative a opção. Defina um código numérico de segurança (ex: 1234).</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Abra o app do Totem e <strong>pressione 3 vezes o botão superior</strong> (botão de ligar) do iPad 10. Toque em "Iniciar" no canto superior direito.</span>
              </li>
            </ul>
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
              🔒 O iPad fica 100% blindado na tela de cadastro da Activity Fisioterapia. Para sair, basta pressionar 3 vezes o botão superior e digitar sua senha.
            </div>
          </div>

          {/* PASSO 3: Funcionamento 100% Offline */}
          <div className="bg-teal-50/70 rounded-2xl p-5 border border-teal-200">
            <div className="flex items-center gap-2.5 font-bold text-[#005F73] text-sm mb-2">
              <WifiOff className="w-5 h-5" />
              <span>Resiliência Total Offline</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Em eventos de corrida com milhares de atletas, o 4G/5G costuma oscilar ou cair. Nosso sistema grava tudo instantaneamente no <strong>IndexedDB local</strong> do iPad. Assim que o iPad se conectar a um Wi-Fi ou sinal de celular, o aplicativo sincroniza automaticamente todos os corredores para a nuvem Neon / FisioFlow.
            </p>
          </div>

        </div>

        {/* Rodapé */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#005F73] text-white text-xs font-bold hover:bg-[#004655] transition"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
