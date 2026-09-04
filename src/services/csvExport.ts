import type { Participante, Evento } from '../types';

/**
 * Normaliza o telefone para o padrão internacional WhatsApp (ex: 5511999998888)
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 10) {
    return `55${digits}`;
  }
  if (digits.length > 11 && digits.startsWith('55')) {
    return digits;
  }
  return digits ? `55${digits}` : '';
}

/**
 * Gera e faz o download automático de um arquivo CSV com os participantes
 */
export function exportParticipantesToCSV(participantes: Participante[], evento?: Evento | null) {
  if (participantes.length === 0) {
    alert('Nenhum participante cadastrado para exportar.');
    return;
  }

  const headers = [
    'Nome Completo',
    'Telefone / WhatsApp',
    'Link Direto WhatsApp',
    'Instagram',
    'Segue Perfil?',
    'Aceitou Comunicado LGPD?',
    'Data de Cadastro',
    'Horário',
    'Sincronizado na Nuvem?',
  ];

  const rows = participantes.map((p) => {
    const d = new Date(p.created_at);
    const dataFormatada = isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
    const horaFormatada = isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR');
    const waNumber = normalizePhoneForWhatsApp(p.contato);
    const waLink = waNumber ? `https://wa.me/${waNumber}` : '';

    return [
      `"${(p.nome || '').replace(/"/g, '""')}"`,
      `"${(p.contato || '').replace(/"/g, '""')}"`,
      `"${waLink}"`,
      `"${(p.instagram || '').replace(/"/g, '""')}"`,
      `"${p.segue_perfil ? 'SIM' : 'NÃO'}"`,
      `"${p.aceitou_comunicado ? 'SIM' : 'NÃO'}"`,
      `"${dataFormatada}"`,
      `"${horaFormatada}"`,
      `"${p.synced ? 'SINCRONIZADO' : 'PENDENTE'}"`,
    ].join(';');
  });

  // UTF-8 BOM (\uFEFF) para garantir acentuação correta no Excel brasileiro
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const safeEventName = (evento?.nome || 'evento')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
  const safeDate = new Date().toISOString().split('T')[0];

  link.setAttribute('href', url);
  link.setAttribute('download', `participantes_${safeEventName}_${safeDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
