-- AI 분석 사용량 기록.
-- 월 한도(무료 20회 / 유료 100회 / 관리자 무제한)는 등급에서 그대로 계산되는 고정값이라
-- DB 컬럼이 필요 없다 — lib/ai/usage.ts의 FREE_MONTHLY_AI_LIMIT / PAID_MONTHLY_AI_LIMIT 참고.
-- 사용량 자체도 이번 달 로그 개수를 그때그때 세는 방식이라 별도 잔여치 저장이 없고,
-- 매월 1일(서울 기준) 자동으로 재계산된다 — 이월/차감 없음.

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
