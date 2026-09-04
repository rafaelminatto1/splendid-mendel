import { formatNameTitleCase, normalizePhoneForWhatsApp } from './csvExport';

export interface TemplateVariables {
  nome: string;
  evento: string;
}

/**
 * Extrai o primeiro nome formatado para tratamento amigável e caloroso.
 */
export function extractFirstName(fullName: string): string {
  if (!fullName) return 'Atleta';
  const formatted = formatNameTitleCase(fullName);
  return formatted.split(' ')[0] || 'Atleta';
}

/**
 * Constrói o texto do template de WhatsApp com exatamente 2 variáveis:
 * 1. Nome do participante/atleta
 * 2. Nome do evento (funciona tanto para corridas quanto para aulões de Jiu-Jitsu, lutas, etc.)
 * 
 * O texto fixo utiliza "no evento [Nome]", garantindo adequação semântica a qualquer esporte.
 */
export function buildWhatsAppTemplateText(nome: string, eventoNome: string): string {
  const primeiroNome = extractFirstName(nome);
  const evento = (eventoNome || 'evento').trim();

  return `Oi, ${primeiroNome}! Tudo bem? 😊\nAqui é da equipe da Activity Fisioterapia! Foi um prazer te conhecer na ação que realizamos no evento ${evento} ✨\n\nComo fomos parceiros do evento, você ganhou uma Avaliação Fisioterapêutica Gratuita / Sessão de Recovery aqui na Activity! 💙\n\nNós cuidamos desde o alívio de dores e recuperação muscular até a melhora da sua performance física para você continuar seus treinos com máxima segurança.\n\nSe quiser aproveitar o seu benefício, posso te ajudar a encontrar um horário confortável para você. Qual período do dia fica melhor pra você? 😊`;
}

/**
 * Constrói o link oficial do WhatsApp (wa.me) já com o texto codificado e telefone normalizado.
 */
export function buildWhatsAppLink(phone: string, nome: string, eventoNome: string): string {
  const waNumber = normalizePhoneForWhatsApp(phone);
  const message = buildWhatsAppTemplateText(nome, eventoNome);
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Especificação oficial do Payload JSON da Meta Cloud API (Graph API v25.0)
 * com exatamente 2 variáveis: {{1}} Nome e {{2}} Nome do Evento.
 */
export const META_TEMPLATE_SPEC = {
  name: "pos_evento_parceria_v2",
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
      text: "Oi, {{1}}! Tudo bem? 😊\nAqui é da equipe da Activity Fisioterapia! Foi um prazer te conhecer na ação que realizamos no evento {{2}} ✨\n\nComo fomos parceiros do evento, você ganhou uma Avaliação Fisioterapêutica Gratuita / Sessão de Recovery aqui na Activity! 💙\n\nNós cuidamos desde o alívio de dores e recuperação muscular até a melhora da sua performance física para você continuar seus treinos com máxima segurança. Se quiser conhecer um pouquinho mais do nosso trabalho, dá uma olhadinha nesse vídeo: 👇\n\nSe quiser aproveitar o seu benefício, posso te ajudar a encontrar um horário confortável para você. Qual período do dia fica melhor pra você? 😊",
      example: {
        body_text: [
          ["Rafael", "Aulão de Jiu-Jitsu"]
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

/**
 * Notifica a API do FisioFlow/Totem para marcar o lead como 'em_contato' no CRM
 * e registrar o disparo no histórico de mensagens (wa_messages).
 */
export async function trackWhatsAppMessageSent(params: {
  telefone: string;
  nome: string;
  evento_id?: string;
  evento_nome?: string;
}): Promise<boolean> {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_template',
        contato_telefone: params.telefone,
        participante_nome: params.nome,
        evento_id: params.evento_id,
        evento_nome: params.evento_nome,
        novo_estagio: 'em_contato',
        template_name: 'pos_evento_parceria_v2',
        mensagem_texto: buildWhatsAppTemplateText(params.nome, params.evento_nome || '')
      })
    });
    return response.ok;
  } catch (err) {
    console.warn('Não foi possível registrar o envio da mensagem no CRM:', err);
    return false;
  }
}
