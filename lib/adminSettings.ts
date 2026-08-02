import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

// 앱 전역 설정 — 무료/유료 한도와 점검 배너를 코드 배포 없이 화면에서 조정한다.
// app_settings(key/value) 테이블을 읽어 60초 캐시. 값이 없으면 아래 기본값을 쓴다.
export type AppSettings = {
  freeAiLimit: number;
  paidAiLimit: number;
  freeClassLimit: number;
  maintenanceOn: boolean;
  maintenanceMessage: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  freeAiLimit: 10,
  paidAiLimit: 100,
  freeClassLimit: 1,
  maintenanceOn: false,
  maintenanceMessage: '',
};

let cache: { value: AppSettings; at: number } | null = null;
const TTL_MS = 60_000;

export async function getAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const { data } = await supabaseAdmin.from('app_settings').select('key, value');
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));

  const num = (key: string, fallback: number) => {
    const n = Number(map.get(key));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const value: AppSettings = {
    freeAiLimit: num('free_ai_limit', DEFAULT_SETTINGS.freeAiLimit),
    paidAiLimit: num('paid_ai_limit', DEFAULT_SETTINGS.paidAiLimit),
    freeClassLimit: num('free_class_limit', DEFAULT_SETTINGS.freeClassLimit),
    maintenanceOn: (map.get('maintenance_on') ?? 'false') === 'true',
    maintenanceMessage: map.get('maintenance_message') ?? '',
  };
  cache = { value, at: Date.now() };
  return value;
}

const KEY_MAP: Record<keyof AppSettings, string> = {
  freeAiLimit: 'free_ai_limit',
  paidAiLimit: 'paid_ai_limit',
  freeClassLimit: 'free_class_limit',
  maintenanceOn: 'maintenance_on',
  maintenanceMessage: 'maintenance_message',
};

export async function setAppSettings(patch: Partial<AppSettings>): Promise<void> {
  const rows = Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({
      key: KEY_MAP[k as keyof AppSettings],
      value: typeof v === 'boolean' ? String(v) : String(v),
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  cache = null; // 변경 즉시 반영되도록 캐시 무효화
}

// ── 관리자 감사 로그 ──────────────────────────────────────────────
export type AuditLog = {
  id: string;
  actorName: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

// best-effort: 감사 로그 기록 실패가 원래 작업(등급 변경 등)을 막지 않도록 삼킨다.
export async function logAdminAction(
  actor: { id: string | null; name: string },
  action: string,
  detail?: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
    actor_id: actor.id,
    actor_name: actor.name || '시스템',
    action,
    detail: detail ?? null,
  });
  if (error) console.error('[audit] 기록 실패:', error.message);
}

export async function getRecentAuditLogs(limit = 50): Promise<AuditLog[]> {
  const { data } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('id, actor_name, action, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: { id: string; actor_name: string; action: string; detail: string | null; created_at: string }) => ({
    id: r.id,
    actorName: r.actor_name,
    action: r.action,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
