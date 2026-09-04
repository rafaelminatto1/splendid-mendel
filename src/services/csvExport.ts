import type { Participante, Evento } from '../types';

export type EventoLookup = 
  | Evento 
  | string 
  | Map<string, Evento | string> 
  | Record<string, Evento | string>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Capitaliza o nome no padrão Title Case mantendo preposições minúsculas.
 * Ex: "rafael gonçalves da silva" -> "Rafael Gonçalves da Silva"
 */
export function formatNameTitleCase(name: string): string {
  if (!name) return '';
  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && prepositions.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Formata um número de telefone limpo para exibição legível (11) 98765-4321
 */
export function formatPhoneForDisplay(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Normaliza o telefone para o padrão internacional WhatsApp (ex: 5511999998888)
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 10) {
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits;
  }
  return digits ? `55${digits}` : '';
}

/**
 * Valida se é um número celular brasileiro válido (11 dígitos com 9 no início do número)
 */
export function isValidBrazilianCellPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    const ninthDigit = digits.charAt(2);
    return ddd >= 11 && ddd <= 99 && ninthDigit === '9';
  }
  if (digits.length >= 12) {
    return true;
  }
  return false;
}

/**
 * Resolve o nome e o ID da corrida de origem para o participante
 */
export function resolveRaceOrigin(
  p: Participante,
  eventoOrLookup?: EventoLookup | null
): { raceName: string; raceId: string } {
  let raceName = '';
  let raceId = p.evento_id || '';

  if (eventoOrLookup) {
    if (typeof eventoOrLookup === 'string') {
      if (UUID_REGEX.test(eventoOrLookup)) {
        raceId = eventoOrLookup;
        raceName = (p as any).evento_nome || 'Corrida de Origem';
      } else {
        raceName = eventoOrLookup;
      }
    } else if (eventoOrLookup instanceof Map) {
      const mapped = eventoOrLookup.get(p.evento_id);
      if (mapped) {
        if (typeof mapped === 'string') {
          raceName = mapped;
        } else if (typeof mapped === 'object' && 'nome' in mapped) {
          raceName = mapped.nome;
          raceId = mapped.id || raceId;
        }
      }
    } else if (typeof eventoOrLookup === 'object') {
      if ('nome' in eventoOrLookup && typeof (eventoOrLookup as any).nome === 'string') {
        raceName = (eventoOrLookup as Evento).nome;
        raceId = (eventoOrLookup as Evento).id || raceId;
      } else if (p.evento_id && (eventoOrLookup as Record<string, any>)[p.evento_id]) {
        const mapped = (eventoOrLookup as Record<string, any>)[p.evento_id];
        if (typeof mapped === 'string') {
          raceName = mapped;
        } else if (typeof mapped === 'object' && 'nome' in mapped) {
          raceName = mapped.nome;
          raceId = mapped.id || raceId;
        }
      }
    }
  }

  if (!raceName) {
    raceName = (p as any).evento_nome || (raceId ? 'Corrida de Origem' : 'Geral');
  }

  return { raceName, raceId };
}

/**
 * Resolve o status de conversão no CRM do FisioFlow para o participante
 */
export function resolveCrmStatus(
  p: Participante,
  crmStatusMap?: Map<string, string> | Record<string, string> | null
): string {
  const cleanPhone = p.contato ? p.contato.replace(/\D/g, '') : '';
  let rawStatus: string | undefined;

  if (crmStatusMap instanceof Map) {
    rawStatus = crmStatusMap.get(p.id) || (cleanPhone ? crmStatusMap.get(cleanPhone) : undefined);
  } else if (crmStatusMap && typeof crmStatusMap === 'object') {
    rawStatus = (crmStatusMap as Record<string, string>)[p.id] || (cleanPhone ? (crmStatusMap as Record<string, string>)[cleanPhone] : undefined);
  }

  if (!rawStatus) {
    rawStatus = (p as any).estagio || (p as any).status_crm || (p as any).conversion_status || (p as any).crm_status;
  }

  if (!rawStatus) {
    return p.synced ? 'Aguardando' : 'Pendente no Tablet';
  }

  const stageMap: Record<string, string> = {
    'efetivado': 'Convertido em Cliente',
    'avaliacao_realizada': 'Avaliação Realizada',
    'avaliacao_agendada': 'Avaliação Agendada',
    'em_contato': 'Em Contato',
    'aguardando': 'Aguardando',
  };

  return stageMap[rawStatus.toLowerCase()] || rawStatus;
}

/**
 * Calcula as métricas do funil de conversão (PROJECT.md §Contract 4)
 */
export function calculateFunnelMetrics(totalAtendidos: number, emContatoCount: number, convertidosCount: number) {
  const taxa = totalAtendidos > 0 ? (convertidosCount / totalAtendidos) * 100 : 0.0;
  return {
    atendidos: totalAtendidos || 0,
    em_contato: emContatoCount || 0,
    convertidos: convertidosCount || 0,
    taxa_conversao: Number(taxa.toFixed(1)),
    taxa_conversao_formatted: `${taxa.toFixed(1)}%`,
  };
}

/**
 * Gera e faz o download automático de um arquivo CSV com os participantes
 * incluindo identificação de corrida de origem e status de conversão CRM (PROJECT.md §Contract 5).
 */
export function exportParticipantesToCSV(
  participantes: Participante[], 
  eventoOrLookup?: EventoLookup | null,
  crmStatusMap?: Map<string, string> | Record<string, string> | null
) {
  if (participantes.length === 0) {
    alert('Nenhum participante cadastrado para exportar.');
    return;
  }

  const headers = [
    'Nome',
    'WhatsApp',
    'Instagram',
    'Segue Perfil',
    'Aceitou Termo',
    'Data/Hora',
    'Sincronizado',
    'Corrida de Origem',
    'ID da Corrida',
    'Status de Conversão CRM',
  ];

  const rows = participantes.map((p) => {
    const d = new Date(p.created_at);
    const dataFormatada = isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
    const horaFormatada = isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR');
    const dataHora = isNaN(d.getTime()) 
      ? (p.created_at || '') 
      : `${dataFormatada} ${horaFormatada}`.trim();

    const waNumber = normalizePhoneForWhatsApp(p.contato);
    const formattedName = formatNameTitleCase(p.nome);
    const { raceName, raceId } = resolveRaceOrigin(p, eventoOrLookup);
    const crmStatus = resolveCrmStatus(p, crmStatusMap);

    return [
      `"${formattedName.replace(/"/g, '""')}"`,
      `"${waNumber}"`,
      `"${(p.instagram || '').replace(/"/g, '""')}"`,
      `"${p.segue_perfil ? 'SIM' : 'NÃO'}"`,
      `"${p.aceitou_comunicado ? 'SIM' : 'NÃO'}"`,
      `"${dataHora}"`,
      `"${p.synced ? 'SIM' : 'NÃO'}"`,
      `"${raceName.replace(/"/g, '""')}"`,
      `"${raceId}"`,
      `"${crmStatus.replace(/"/g, '""')}"`,
    ].join(';');
  });

  // UTF-8 BOM (\uFEFF) para garantir acentuação correta no Excel brasileiro
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  let eventNameForFilename = 'evento';
  if (typeof eventoOrLookup === 'string') {
    eventNameForFilename = eventoOrLookup;
  } else if (eventoOrLookup && typeof eventoOrLookup === 'object' && 'nome' in eventoOrLookup && typeof (eventoOrLookup as any).nome === 'string') {
    eventNameForFilename = (eventoOrLookup as Evento).nome;
  } else if (participantes.length > 0) {
    const firstOrigin = resolveRaceOrigin(participantes[0], eventoOrLookup);
    if (firstOrigin.raceName) {
      eventNameForFilename = firstOrigin.raceName;
    }
  }

  const safeEventName = eventNameForFilename
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
  const safeDate = new Date().toISOString().split('T')[0];

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `participantes_${safeEventName}_${safeDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
