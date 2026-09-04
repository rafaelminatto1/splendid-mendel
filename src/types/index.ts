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

export type ParticipanteSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Participante {
  id: string; // UUID
  organization_id?: string;
  evento_id: string;
  nome: string;
  contato: string; // Telefone com DDD, ex: (11) 98765-4321 ou 11987654321
  instagram?: string;
  segue_perfil: boolean;
  observacoes?: string;
  aceitou_comunicado: boolean;
  synced: boolean; // Flag booleana legado/rápida
  sync_status: ParticipanteSyncStatus; // Status detalhado da máquina de estados
  retry_count: number;
  last_sync_error?: string;
  last_attempt_at?: string;
  created_at: string;
  updated_at: string;
}

export type LayoutMode = 'side_by_side' | 'two_step';

export interface AppSettings {
  id: string;
  active_evento_id: string | null;
  layout_mode: LayoutMode;
  instagram_handle: string;
  instagram_url: string;
  totem_fullscreen_locked: boolean;
  auto_reset_seconds: number;
  neon_sync_url: string;
  passcode_exit_kiosk: string;
  auto_sync_interval_sec: number; // default 10s
  health_check_url: string; // default /api/health
}

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'offline' | 'checking';

export interface SyncStatus {
  isOnline: boolean;
  networkQuality: NetworkQuality;
  latencyMs: number | null;
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  storagePersisted: boolean;
  storageUsageMb: number;
  storageQuotaMb: number;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'partial' | 'error';
  synced_count: number;
  failed_count: number;
  latency_ms: number;
  message: string;
  endpoint: string;
}
