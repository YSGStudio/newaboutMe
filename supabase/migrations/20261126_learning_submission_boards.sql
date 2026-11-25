-- 배움성찰 근거 자료 — 별빛보드 작업장
--
-- 학생 제출물(learning_submissions)에 별빛보드 작업장을 근거로 붙인다. 파일·링크와 같은 "결과물 1개"로 센다.
-- 근거로 붙인 작업장을 열면 그 작업장과 하위 작업장만 읽기 전용으로 보여 주고, 같은 층의 다른 작업장은 보여 주지 않는다
-- (lib/learning-boards.ts evidenceViews). 별빛보드 자체의 권한은 바꾸지 않는다 — 보는 사람의 원래 권한으로 거른다.
--
-- 고를 수 있는 작업장: 학생은 우리 반 진행 중 프로젝트에서 자기가 볼 수 있는 작업장, 교사는 그 학급의 공용 작업장과
-- 그 학생의 개인 보드. 라우트가 검사한다.
--
-- 작업장이나 제출물이 지워지면 근거도 함께 지운다(cascade). 근거는 가리키는 것뿐이라 남길 내용이 없다.

create table if not exists public.learning_submission_boards (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.learning_submissions (id) on delete cascade,
  board_id      uuid not null references public.sb_boards (id) on delete cascade,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (submission_id, board_id)
);

create index if not exists idx_learning_submission_boards_submission
  on public.learning_submission_boards (submission_id, sort_order);
create index if not exists idx_learning_submission_boards_board
  on public.learning_submission_boards (board_id);

-- RLS — 켜되 정책은 만들지 않는다(deny-all). 기존 learning_* 테이블과 같은 패턴이다.
-- DB 접근은 supabaseAdmin(service role)을 거치고, 권한 확인의 1차 책임은 라우트에 있다
-- (학생: requireStudentActivity → 자기 제출물, 교사: requireTeacherActivity → 학생 → 학급 → 교사).
-- 학생은 Auth 사용자가 아니라 auth.uid()가 NULL이므로 auth.uid() 정책을 쓰지 않는다.
--
--   테이블                       | SELECT   | INSERT   | UPDATE   | DELETE
--   learning_submission_boards   | deny-all | deny-all | deny-all | deny-all
alter table public.learning_submission_boards enable row level security;
