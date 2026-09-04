import React, { useState } from 'react';
import { 
  MessageSquare, 
  Play, 
  CornerDownLeft, 
  Copy, 
  Check, 
  Send, 
  Sparkles, 
  Code2, 
  Bot,
  ExternalLink,
  Users,
  CheckCircle2
} from 'lucide-react';
import type { Evento, Participante } from '../types';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  buildWhatsAppTemplateText, 
  buildWhatsAppLink, 
  META_TEMPLATE_SPEC, 
  trackWhatsAppMessageSent,
  extractFirstName
} from '../services/whatsappTemplate';
import { formatNameTitleCase, formatPhoneForDisplay, normalizePhoneForWhatsApp } from '../services/csvExport';

interface MetaAutomationTabProps {
  evento: Evento | null;
}

export const MetaAutomationTab: React.FC<MetaAutomationTabProps> = ({ evento }) => {
  const [copiadoJson, setCopiadoJson] = useState(false);
  const [copiadoTexto, setCopiadoTexto] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'envio_direto' | 'preview' | 'json' | 'webhook'>('envio_direto');
  const [simulatedReply, setSimulatedReply] = useState(false);
  const [selectedParticipanteId, setSelectedParticipanteId] = useState<string>('');
  const [customNome, setCustomNome] = useState('Rafael');
  const [customTelefone, setCustomTelefone] = useState('(11) 99999-8888');
  const [enviadosSet, setEnviadosSet] = useState<Set<string>>(new Set());

  // Participantes do evento atual via Dexie Live Query
  const participantes = useLiveQuery(
    () => evento?.id ? db.participantes.where('evento_id').equals(evento.id).toArray() : db.participantes.toArray(),
    [evento?.id]
  ) || [];

  const eventName = evento?.nome || 'Evento Esportivo Activity';

  // Participante ativo para preview
  const activeParticipante = participantes.find(p => p.id === selectedParticipanteId);
  const displayNome = activeParticipante ? activeParticipante.nome : customNome;
  const displayPhone = activeParticipante ? activeParticipante.contato : customTelefone;
  const displayFirstName = extractFirstName(displayNome);

  // Mensagem calculada com as 2 variáveis oficiais: Nome e Nome do Evento
  const messageText = buildWhatsAppTemplateText(displayNome, eventName);
  const waLink = buildWhatsAppLink(displayPhone, displayNome, eventName);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(META_TEMPLATE_SPEC, null, 2));
    setCopiadoJson(true);
    setTimeout(() => setCopiadoJson(false), 2500);
  };

  const copyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopiadoTexto(true);
    setTimeout(() => setCopiadoTexto(false), 2500);
  };

  const handleSendDirect = async (p?: Participante) => {
    const targetNome = p ? p.nome : displayNome;
    const targetPhone = p ? p.contato : displayPhone;
    const targetId = p ? p.id : (activeParticipante?.id || 'custom');

    const link = buildWhatsAppLink(targetPhone, targetNome, eventName);
    window.open(link, '_blank');

    // Registra envio e atualiza lead no CRM para 'em_contato'
    setEnviadosSet(prev => new Set(prev).add(targetId));
    await trackWhatsAppMessageSent({
      telefone: targetPhone,
      nome: targetNome,
      evento_id: evento?.id,
      evento_nome: eventName,
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Mini Navegação Interna */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('envio_direto')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'envio_direto'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Template Já</span>
          </button>
          <button
            onClick={() => setActiveSubTab('preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'preview'
                ? 'bg-[#005F73] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Simulador WhatsApp</span>
          </button>
          <button
            onClick={() => setActiveSubTab('json')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'json'
                ? 'bg-[#005F73] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Payload Meta Cloud API (2 Variáveis)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('webhook')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'webhook'
                ? 'bg-[#005F73] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Fluxo Bot Resposta Automática</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          Evento Ativo: <strong className="text-slate-800">{eventName}</strong>
        </span>
      </div>

      {/* SUB-ABA 1: ENVIO DIRETO / DISPARO RÁPIDO DO TEMPLATE */}
      {activeSubTab === 'envio_direto' && (
        <div className="space-y-6">
          
          {/* Caixa de Ação Rápida */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 p-5 rounded-2xl border border-emerald-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  Envio Imediato de Template WhatsApp
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Template dinâmico configurado com <strong>Nome do Participante</strong> e <strong>Nome do Evento</strong> (válido para corridas, treinos de Jiu-Jitsu e qualquer modalidade).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyText}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-sm flex items-center gap-1.5 transition"
                >
                  {copiadoTexto ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiadoTexto ? 'Mensagem Copiada!' : 'Copiar Mensagem'}</span>
                </button>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleSendDirect()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir WhatsApp e Enviar Já</span>
                </a>
              </div>
            </div>

            {/* Seleção do Destinatário */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Selecionar Participante Cadastrado no Evento:
                </label>
                <select
                  value={selectedParticipanteId}
                  onChange={(e) => setSelectedParticipanteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                >
                  <option value="">-- Usar contato de teste manual --</option>
                  {participantes.map(p => (
                    <option key={p.id} value={p.id}>
                      {formatNameTitleCase(p.nome)} ({formatPhoneForDisplay(p.contato)}) {enviadosSet.has(p.id) ? '✓ Enviado' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedParticipanteId && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nome para Teste:
                    </label>
                    <input
                      type="text"
                      value={customNome}
                      onChange={(e) => setCustomNome(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Preview do Texto que será enviado */}
            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-inner">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2 border-b border-slate-100 pb-1.5">
                <span>PREVIEW DA MENSAGEM PREENCHIDA:</span>
                <span className="text-emerald-700 font-semibold">
                  Destinatário: {formatNameTitleCase(displayNome)} ({formatPhoneForDisplay(displayPhone)})
                </span>
              </div>
              <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                {messageText}
              </pre>
            </div>
          </div>

          {/* Lista de Disparo Rápido para Todos os Participantes do Evento */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Participantes Registrados no Evento ({participantes.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Clique em "Enviar WhatsApp" para disparar um a um com o template personalizado
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Participante</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3 text-center">Status Envio</th>
                    <th className="px-4 py-3 text-right">Ação Direta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {participantes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Nenhum participante registrado neste evento ainda.
                      </td>
                    </tr>
                  ) : (
                    participantes.map((p) => {
                      const foiEnviado = enviadosSet.has(p.id) || (p as any).estagio === 'em_contato' || (p as any).estagio === 'efetivado';
                      const pLink = buildWhatsAppLink(p.contato, p.nome, eventName);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {formatNameTitleCase(p.nome)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono">
                            {formatPhoneForDisplay(p.contato)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {foiEnviado ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Enviado / Em Contato
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                Pronto para envio
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const text = buildWhatsAppTemplateText(p.nome, eventName);
                                  navigator.clipboard.writeText(text);
                                  alert(`Mensagem copiada para ${formatNameTitleCase(p.nome)}!`);
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                title="Copiar mensagem personalizada"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={pLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleSendDirect(p)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                              >
                                <Send className="w-3 h-3" />
                                <span>Enviar WhatsApp</span>
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SUB-ABA 2: PREVIEW REALISTA DO WHATSAPP */}
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

              {/* Corpo da Conversa */}
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

                  {/* Texto com as 2 Variáveis Destacadas */}
                  <div className="p-3.5 text-[13px] leading-relaxed space-y-2.5">
                    <p>
                      Oi, <span className="font-bold text-[#005F73] bg-teal-50 px-1 rounded">{displayFirstName}</span>! Tudo bem? 😊
                    </p>
                    <p>
                      Aqui é da equipe da Activity Fisioterapia! Foi um prazer te conhecer na ação que realizamos no evento{' '}
                      <span className="font-bold text-[#005F73] bg-teal-50 px-1 rounded">{eventName}</span> ✨
                    </p>
                    <p>
                      Como fomos parceiros do evento, você ganhou uma{' '}
                      <strong>Avaliação Fisioterapêutica Gratuita / Sessão de Recovery</strong> aqui na Activity! 💙
                    </p>
                    <p>
                      Nós cuidamos desde o alívio de dores e recuperação muscular até a melhora da sua performance física para você continuar seus treinos com máxima segurança. Se quiser conhecer um pouquinho mais do nosso trabalho, dá uma olhadinha nesse vídeo: 👇
                    </p>
                    <p>
                      Se quiser aproveitar o seu benefício, posso te ajudar a encontrar um horário confortável para você. Qual período do dia fica melhor pra você? 😊
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

                {/* Resposta do Atleta (quando clica no botão) */}
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
                        <span>Resposta Automática FisioFlow</span>
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
                  ? '✨ Resposta automática ativada com sucesso!'
                  : '💡 Clique em "Quero agendar!" para testar a resposta do bot'}
              </div>
            </div>
          </div>

          {/* Painel Lateral com Detalhes e Variáveis */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#005F73]" />
                Mapeamento das 2 Variáveis Meta
              </h4>
              
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="font-bold text-[#005F73]">Variável {'{{1}}'} — Primeiro Nome</div>
                  <div className="text-slate-600 mt-0.5">Valor atual: <strong>{displayFirstName}</strong> (extraído do cadastro)</div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="font-bold text-[#005F73]">Variável {'{{2}}'} — Nome do Evento</div>
                  <div className="text-slate-600 mt-0.5">Valor atual: <strong>{eventName}</strong> (corrida, jiu-jitsu, etc.)</div>
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

            {/* Caixa de Informações */}
            <div className="bg-teal-50/70 rounded-2xl p-4 border border-teal-200 text-xs text-slate-700 leading-relaxed">
              <div className="font-bold text-[#005F73] mb-1">Versatilidade Multi-Eventos:</div>
              O texto fixo usa a redação <em>"no evento {'{{2}}'}"</em>, funcionando com perfeita concordância gramatical tanto para corridas de rua quanto para aulas/campeonatos de Jiu-Jitsu, CrossFit, palestras e ações corporativas.
            </div>
          </div>

        </div>
      )}

      {/* SUB-ABA 3: PAYLOAD JSON OFICIAL PARA SUBMISSÃO NA META */}
      {activeSubTab === 'json' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Payload JSON configurado com <strong>2 variáveis</strong> para chamada via <code>POST https://graph.facebook.com/v25.0/{'{WABA_ID}'}/message_templates</code>
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
            {JSON.stringify(META_TEMPLATE_SPEC, null, 2)}
          </pre>
        </div>
      )}

      {/* SUB-ABA 4: FLUXO DE RESPOSTA AUTOMÁTICA (WEBHOOK) */}
      {activeSubTab === 'webhook' && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
              Lógica do Webhook (Hono / Cloudflare Worker / FisioFlow)
            </h4>
            <p className="text-xs text-slate-600 mb-3">
              Quando o participante clica no botão <strong>"Quero agendar!"</strong>, a Meta envia um webhook <code>button_reply</code>. O FisioFlow responde automaticamente com a grade de horários da Activity Fisioterapia e avança o lead para <code>avaliacao_agendada</code>.
            </p>

            <pre className="p-4 bg-slate-900 text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
{`// Handler no webhook da Cloudflare / Fisioflow
export async function handleWhatsAppWebhook(payload: any, env: any) {
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return;

  const from = message.from; // Telefone do participante
  const buttonReplyId = message.interactive?.button_reply?.title || message.text?.body;

  if (buttonReplyId?.toLowerCase().includes('quero agendar') || buttonReplyId?.toLowerCase().includes('agendar')) {
    const textResponse = 
      "Para qual horário teria interesse de agendar?\\n" +
      "Atendemos de segunda a sexta das 07h às 21h\\n" +
      "Sábado das 07h às 13h";

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
