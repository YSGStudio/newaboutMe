-- 모둠 프로젝트 전체공지: 교사가 주제에 올리면 그 주제의 모든 방 공지 탭 맨 위에 보인다.
-- 방마다 공지를 복사하지 않고 주제에 한 행만 둔다. 나중에 만든 방에도 보이고 수정·삭제가 한 번에 반영된다.
-- 되돌리기: 20261109_group_project_topic_notices_down.sql (전체공지가 모두 지워진다)
--
-- ── RLS 결론 (CLAUDE.md 규칙 3) ──
-- | 동작   | 결론                        |
-- | SELECT | deny-all (라우트에서 처리)  |
-- | INSERT | deny-all (라우트에서 처리)  |
-- | UPDATE | deny-all (라우트에서 처리)  |
-- | DELETE | deny-all (라우트에서 처리)  |
-- 읽는 쪽에 학생이 포함되어 auth.uid()로 표현할 수 없다. 앱은 service role로만 접근하고 권한은 라우트가 판정한다.

create table public.gp_topic_notices (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.gp_topics (id) on delete cascade,
  teacher_id uuid references public.teacher_profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gp_topic_notices_topic_idx on public.gp_topic_notices (topic_id, created_at desc);
create index gp_topic_notices_teacher_idx on public.gp_topic_notices (teacher_id);

alter table public.gp_topic_notices enable row level security;
