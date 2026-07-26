-- 관리자 알림장(공지) 기능
-- 관리자가 표시 기간을 정해두면, 그 기간 동안 교사가 로그인할 때마다 알림 모달이 뜬다.
-- 교사가 "다시 보지 않기"를 체크하면 해당 알림은 그 교사에게 더 이상 표시되지 않는다.

create table if not exists public.admin_notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  starts_on   date not null,                 -- 표시 시작일 (Asia/Seoul 기준, inclusive)
  ends_on     date not null,                 -- 표시 종료일 (inclusive)
  is_active   boolean not null default true, -- 관리자가 즉시 켜고 끌 수 있는 스위치
  created_by  uuid references public.teacher_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists admin_notices_period_idx
  on public.admin_notices (is_active, starts_on, ends_on);

-- 교사별 "다시 보지 않기" 기록 (알림 1건당 교사 1행)
create table if not exists public.admin_notice_dismissals (
  id           uuid primary key default gen_random_uuid(),
  notice_id    uuid not null references public.admin_notices(id) on delete cascade,
  teacher_id   uuid not null references public.teacher_profiles(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  unique (notice_id, teacher_id)
);

create index if not exists admin_notice_dismissals_teacher_idx
  on public.admin_notice_dismissals (teacher_id);

-- API는 supabaseAdmin(서비스 롤)으로 접근하므로 RLS만 켜두고 정책은 두지 않는다.
alter table public.admin_notices enable row level security;
alter table public.admin_notice_dismissals enable row level security;
