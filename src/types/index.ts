export interface Evento {
  id: string; // UUID ou ID único
  organization_id?: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  local?: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim?: string;
  hora_inicio?: string;
  hora_fim?: string;
  gratuito?: boolean;
  link_whatsapp?: string;
  status: 'ativo' | 'concluido' | 'rascunho';
  participantes_previstos?: number;
  created_at: string;
  updated_at: string;
}

export interface Participante {
  id: string; // UUID
  organization_id?: string;
  evento_id: string;
  nome: string;
  contato: string; // Telefone com DDD, ex: (11) 98765-4321 ou 11987654321
  instagram?: string; // ex: @rafael ou link
  segue_perfil: boolean; // Se segue ou escaneou o QR code
  observacoes?: string;
  aceitou_comunicado: boolean; // Checkbox LGPD
  synced: boolean; // Status de sincronização com o banco central (Neon / Cloudflare)
  created_at: string;
  updated_at: string;
}

export type LayoutMode = 'side_by_side' | 'two_step';

export interface AppSettings {
  id: string;
  active_evento_id: string | null;
  layout_mode: LayoutMode;
  instagram_handle: string; // default: @activityfisioterapia
  instagram_url: string; // default: https://instagram.com/activityfisioterapia
  totem_fullscreen_locked: boolean;
  auto_reset_seconds: number; // para o Layout B (default 6 segundos)
  neon_sync_url: string; // URL do endpoint Cloudflare Worker / Neon
  passcode_exit_kiosk: string; // default: '1234'
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}
