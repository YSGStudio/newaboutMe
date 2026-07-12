-- AI 분석 사용량 기록 + 교사별 월 사용 한도

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles (id) on delete cascade,
  feature text not null check (feature in ('growth_report', 'holland_report', 'subject_report')),
  -- 학생이 삭제되어도 사용량 기록은 남긴다
  student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_logs_teacher_created
  on public.ai_usage_logs (teacher_id, created_at desc);

-- 다른 테이블과 동일: anon 키 직접 접근 차단 (앱은 service role 사용)
alter table public.ai_usage_logs enable row level security;

-- 교사별 월 AI 분석 한도 (관리자가 권한설정 탭에서 조정)
alter table public.teacher_profiles
  add column if not exists ai_monthly_limit int not null default 30;
