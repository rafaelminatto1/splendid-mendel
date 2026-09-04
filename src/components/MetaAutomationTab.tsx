import React, { useState } from 'react';
import { 
  MessageSquare, 
  Play, 
  CornerDownLeft, 
  Copy, 
  Check, 
  Send, 
  Sparkles, 
  Clock,
  Code2,
  Bot
} from 'lucide-react';
import type { Evento } from '../types';

interface MetaAutomationTabProps {
  evento: Evento | null;
}

export const MetaAutomationTab: React.FC<MetaAutomationTabProps> = ({ evento }) => {
  const [copiadoJson, setCopiadoJson] = useState(false);
  const [copiadoTexto, setCopiadoTexto] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'json' | 'webhook'>('preview');
  const [simulatedReply, setSimulatedReply] = useState(false);

  // Variáveis calculadas a partir do evento selecionado
  const sampleNome = 'Rafael';
  const eventDateFormatted = evento?.data_inicio 
    ? evento.data_inicio.split('-').reverse().slice(0, 2).join('/') // ex: 30/08
    : '30/08';
  const eventName = evento?.nome || 'Corrida do Juventus';
  
  // Data de validade (+ 15 dias após o evento)
  const validadeDate = (() => {
    if (!evento?.data_inicio) return '15/09/2026';
    const d = new Date(evento.data_inicio);
    d.setDate(d.getDate() + 15);
    return isNaN(d.getTime()) ? '15/09/2026' : d.toLocaleDateString('pt-BR');
  })();

  const metaTemplateJson = {
    name: "pos_evento_massagem_avaliacao_v1",
    category: "MARKETING",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "VIDEO",
        example: {
          header_handle: ["https://activityfisioterapia.com.br/videos/recuperacao-atletas.mp4"]
        }
      },
      {
        type: "BODY",
        text: "Oi, {{1}}! Tudo bem? 😊\nAqui é a Amanda, da Activity Fisioterapia! Foi um prazer te conhecer no dia {{2}}, na ação que realizamos na {{3}} ✨\n\nComo fomos parceiros do evento, você ganhou uma Avaliação Fisioterapêutica Gratuita aqui na Activity! 💙 Seu bônus pode ser utilizado até {{4}}.\n\nNós fazemos desde a Avaliação Clínica para cuidar de dores, até a Liberação Miofascial para melhorar sua performance e prevenir lesões. E se quiser conhecer um pouquinho mais do nosso trabalho, dá uma olhadinha nesse vídeo: 👇\n\nSe quiser aproveitar o bônus, posso te ajudar a encontrar um horário que fique confortável para você. 😊",
        example: {
          body_text: [
            ["Rafael", "30/08", "Corrida do Juventus", "15/09/2026"]
          ]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "QUICK_REPLY",
            text: "Quero agendar!"
          }
        ]
      }
    ]
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(metaTemplateJson, null, 2));
    setCopiadoJson(true);
    setTimeout(() => setCopiadoJson(false), 2500);
  };

  const copyText = () => {
    const text = `Oi, ${sampleNome}! Tudo bem? 😊\nAqui é a Amanda, da Activity Fisioterapia! Foi um prazer te conhecer no dia ${eventDateFormatted}, na ação que realizamos na ${eventName} ✨\n\nComo fomos parceiros do evento, você ganhou uma Avaliação Fisioterapêutica Gratuita aqui na Activity! 💙 Seu bônus pode ser utilizado até ${validadeDate}.\n\nNós fazemos desde a Avaliação Clínica para cuidar de dores, até a Liberação Miofascial para melhorar sua performance e prevenir lesões. E se quiser conhecer um pouquinho mais do nosso trabalho, dá uma olhadinha nesse vídeo: 👇\n\nSe quiser aproveitar o bônus, posso te ajudar a encontrar um horário que fique confortável para você. 😊`;
    navigator.clipboard.writeText(text);
    setCopiadoTexto(true);
    setTimeout(() => setCopiadoTexto(false), 2500);
  };

  return (
    <div className="space-y-6">
      
      {/* Mini Navegação Interna */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('preview')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'preview'
                ? 'bg-[#005F73] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Visualizar Simulador WhatsApp
          </button>
          <button
            onClick={() => setActiveSubTab('json')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'json'
                ? 'bg-[#005F73] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Payload Meta Cloud API
          </button>
          <button
            onClick={() => setActiveSubTab('webhook')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'webhook'
                ? 'bg-[#005F73] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Fluxo Bot Resposta Automática
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          Evento Ativo: <strong>{eventName}</strong>
        </span>
      </div>

      {/* ABA 1: PREVIEW REALISTA DO WHATSAPP (IDÊNTICO À IMAGEM) */}
      {activeSubTab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Mockup do WhatsApp */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-sm bg-[#EFEAE2] rounded-3xl shadow-2xl border-4 border-slate-800 overflow-hidden font-sans">
              
              {/* Top bar WhatsApp */}
              <div className="bg-[#005E54] text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                    AF
                  </div>
                  <div>
                    <div className="font-bold text-sm leading-tight">Activity Fisioterapia</div>
                    <div className="text-[11px] text-emerald-200">Conta comercial verificada</div>
                  </div>
                </div>
              </div>

              {/* Corpo da Conversa com Papel de Parede Oficial */}
              <div className="p-3.5 space-y-3 min-h-[480px] flex flex-col justify-end">
                
                {/* Balão do Template */}
                <div className="bg-white rounded-2xl rounded-tl-none shadow-md overflow-hidden text-slate-800 max-w-[95%] border border-slate-200/60 animate-in fade-in">
                  
                  {/* Cabeçalho de Vídeo */}
                  <div className="relative bg-slate-900 aspect-video flex items-center justify-center text-white cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-black/50 group-hover:scale-110 flex items-center justify-center transition shadow-lg">
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </div>
                    <div className="absolute bottom-2 left-2.5 flex items-center gap-1 text-[11px] bg-black/60 px-2 py-0.5 rounded text-slate-200">
                      <Play className="w-3 h-3" />
                      <span>1:05</span>
                    </div>
                  </div>

                  {/* Texto do Template com Variáveis Destacadas */}
                  <div className="p-3.5 text-[13px] leading-relaxed space-y-2.5">
                    <p>
                      Oi, <span className="font-bold text-[#005F73] bg-teal-50 px-1 rounded">{sampleNome}</span>! Tudo bem? 😊
                    </p>
                    <p>
                      Aqui é a Amanda, da Activity Fisioterapia! Foi um prazer te conhecer no dia{' '}
                      <span className="font-bold text-[#005F73] bg-teal-50 px-1 rounded">{eventDateFormatted}</span>, na ação que realizamos na{' '}
                      <span className="font-bold text-[#005F73] bg-teal-50 px-1 rounded">{eventName}</span> ✨
                    </p>
                    <p>
                      Como fomos parceiros do evento, você ganhou uma{' '}
                      <strong>Avaliação Fisioterapêutica Gratuita</strong> aqui na Activity! 💙 Seu bônus pode ser utilizado até{' '}
                      <span className="font-bold text-[#005F73] bg-teal-50 px-1 rounded">{validadeDate}</span>.
                    </p>
                    <p>
                      Nós fazemos desde a Avaliação Clínica para cuidar de dores, até a Liberação Miofascial para melhorar sua performance e prevenir lesões. E se quiser conhecer um pouquinho mais do nosso trabalho, dá uma olhadinha nesse vídeo: 👇
                    </p>
                    <p>
                      Se quiser aproveitar o bônus, posso te ajudar a encontrar um horário que fique confortável para você. 😊
                    </p>
                    <div className="text-[10px] text-slate-400 text-right font-medium pt-1">
                      10:51
                    </div>
                  </div>

                  {/* Botão de Resposta Rápida (Quick Reply) */}
                  <div className="border-t border-slate-100 bg-slate-50/70 p-2">
                    <button
                      onClick={() => setSimulatedReply(!simulatedReply)}
                      className="w-full py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-emerald-700 text-xs font-bold shadow-sm hover:bg-emerald-50/50 flex items-center justify-center gap-2 transition"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Quero agendar!</span>
                    </button>
                  </div>
                </div>

                {/* Resposta do Corredor (quando clica no botão) */}
                {simulatedReply && (
                  <>
                    <div className="self-end bg-[#D9FDD3] text-slate-800 text-[13px] rounded-2xl rounded-tr-none px-3.5 py-2 shadow-sm max-w-[80%] flex items-center gap-2 animate-in slide-in-from-bottom-2">
                      <CornerDownLeft className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                      <span className="font-semibold">Quero agendar!</span>
                      <span className="text-[10px] text-slate-400 ml-auto pl-2">10:52</span>
                    </div>

                    {/* Resposta Automática da Clínica pelo Bot */}
                    <div className="self-start bg-white text-slate-800 text-[13px] rounded-2xl rounded-tl-none p-3.5 shadow-md border border-slate-200/80 max-w-[90%] space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-300">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#005F73]">
                        <Bot className="w-3.5 h-3.5" />
                        <span>Resposta Automática</span>
                      </div>
                      <p className="font-medium text-slate-700">
                        Para qual horário teria interesse de agendar?
                      </p>
                      <div className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-600 mt-1">
                        <div>📅 <strong>Segunda a sexta:</strong> 07h às 21h</div>
                        <div>📅 <strong>Sábado:</strong> 07h às 13h</div>
                      </div>
                      <div className="text-[10px] text-slate-400 text-right pt-0.5">
                        10:52
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Barra inferior de status */}
              <div className="bg-slate-100 px-3 py-2 border-t border-slate-200 text-center text-[11px] text-slate-500 font-medium">
                {simulatedReply 
                  ? '✨ Resposta automática do bot ativada com sucesso!'
                  : '💡 Dica: Clique no botão "Quero agendar!" para testar o bot'}
              </div>
            </div>
          </div>

          {/* Painel Lateral com Detalhes e Variáveis */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#005F73]" />
                Mapeamento das Variáveis Meta
              </h4>
              
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="font-bold text-[#005F73]">Variável {'{{1}}'} — Primeiro Nome</div>
                  <div className="text-slate-600 mt-0.5">Valor de teste: <strong>{sampleNome}</strong> (extraído do cadastro do corredor)</div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="font-bold text-[#005F73]">Variável {'{{2}}'} — Data do Evento</div>
                  <div className="text-slate-600 mt-0.5">Valor atual: <strong>{eventDateFormatted}</strong></div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="font-bold text-[#005F73]">Variável {'{{3}}'} — Nome da Corrida</div>
                  <div className="text-slate-600 mt-0.5">Valor atual: <strong>{eventName}</strong></div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="font-bold text-[#005F73]">Variável {'{{4}}'} — Validade do Bônus</div>
                  <div className="text-slate-600 mt-0.5">Valor calculado (+15 dias): <strong>{validadeDate}</strong></div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
                <button
                  onClick={copyText}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  {copiadoTexto ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiadoTexto ? 'Texto Copiado!' : 'Copiar Texto da Mensagem'}</span>
                </button>
              </div>
            </div>

            {/* Caixa de Informações da Meta */}
            <div className="bg-teal-50/70 rounded-2xl p-4 border border-teal-200 text-xs text-slate-700 leading-relaxed">
              <div className="font-bold text-[#005F73] mb-1">Status na Meta Cloud API:</div>
              Para disparar para todos os corredores que marcaram o checkbox após a corrida, submeta o template abaixo no <strong>Gerenciador de WhatsApp da Meta</strong>. A aprovação ocorre em até 1 hora.
            </div>
          </div>

        </div>
      )}

      {/* ABA 2: PAYLOAD JSON OFICIAL PARA SUBMISSÃO NA META */}
      {activeSubTab === 'json' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Payload JSON para chamada via <code>POST https://graph.facebook.com/v25.0/{'{WABA_ID}'}/message_templates</code>
            </p>
            <button
              onClick={copyJson}
              className="py-1.5 px-3 rounded-lg bg-[#005F73] hover:bg-[#004655] text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              {copiadoJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiadoJson ? 'Copiado!' : 'Copiar JSON'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs font-mono overflow-x-auto border border-slate-800">
            {JSON.stringify(metaTemplateJson, null, 2)}
          </pre>
        </div>
      )}

      {/* ABA 3: FLUXO DE RESPOSTA AUTOMÁTICA (WEBHOOK) */}
      {activeSubTab === 'webhook' && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
              Lógica do Webhook (Hono / Cloudflare Worker / FisioFlow)
            </h4>
            <p className="text-xs text-slate-600 mb-3">
              Quando o corredor toca no botão <strong>"Quero agendar!"</strong>, a Meta envia um webhook do tipo <code>interactive (button_reply)</code>. O código abaixo responde automaticamente com a grade de horários da Activity Fisioterapia.
            </p>

            <pre className="p-4 bg-slate-900 text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
{`// Exemplo de handler no webhook da Cloudflare / Fisioflow
export async function handleWhatsAppWebhook(payload: any, env: any) {
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return;

  const from = message.from; // Número do corredor
  const buttonReplyId = message.interactive?.button_reply?.title || message.text?.body;

  if (buttonReplyId?.toLowerCase().includes('quero agendar') || buttonReplyId?.toLowerCase().includes('agendar')) {
    const textResponse = 
      "Para qual horario teria interesse de agendar ?\\n" +
      "Atendemos de segunda a sexta das 07h às 21h\\n" +
      "Sábado das 07h as 13h";

    await fetch(\`https://graph.facebook.com/v25.0/\${env.WHATSAPP_PHONE_NUMBER_ID}/messages\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${env.WHATSAPP_ACCESS_TOKEN}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: from,
        type: "text",
        text: { body: textResponse }
      })
    });
  }
}`}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
};
