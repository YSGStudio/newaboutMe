-- 운영관리 2·3단계: 관리자 감사 로그 + 앱 설정(한도·점검배너 등)

-- 관리자 행위 감사 로그 — 등급 변경/공지/설정 변경/학년말 초기화 등 되돌리기 어려운 행위 기록
create table if not exists public.admin_audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.teacher_profiles(id) on delete set null, -- null이면 시스템(크론 등)
  actor_name text not null default '시스템',
  action     text not null,   -- 예: teacher_role_change, notice_create, settings_update, year_reset
  detail     text,            -- 사람이 읽는 요약
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

-- 앱 전역 설정 — 코드 상수(무료/유료 한도 등)를 화면에서 조정할 수 있도록 key/value로 보관
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- 기본값 시드 (이미 있으면 유지)
insert into public.app_settings (key, value) values
  ('free_ai_limit', '10'),
  ('paid_ai_limit', '100'),
  ('free_class_limit', '1'),
  ('maintenance_on', 'false'),
  ('maintenance_message', '')
on conflict (key) do nothing;

alter table public.admin_audit_logs enable row level security;
alter table public.app_settings enable row level security;
