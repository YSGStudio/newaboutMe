-- 평가 있는 배움성찰 — 성찰 질문이 평가요소를 겸한다
--
-- 1) 성찰 질문에 평가요소 정보를 붙인다. criterion_title이 있으면 평가요소 질문이고,
--    잘함/보통/노력요함 기준 문장을 함께 둔다. 없으면 지금과 같은 일반 질문이다.
-- 2) 제출물 × 평가요소 질문마다 학생 자기평가, 교사 등급, 교사 코멘트를 한 행에 저장한다.
-- 3) AI생성 탭의 교과발달상황 결과를 학생 × 과목 단위로 저장한다.
--
-- 등급 값은 eval_grade enum(평가피드백)에 기대지 않고 text + check로 둔다.
-- 평가피드백을 완전히 삭제할 때 이 테이블들이 함께 묶이지 않게 하려는 것이다.
-- 기존 ai_subject_reports(평가피드백 종합평가)와도 따로 둔다.

-- ── 성찰 질문 = 평가요소 ─────────────────────────────────────────
alter table learning_activity_questions
  add column if not exists criterion_title text check (char_length(criterion_title) <= 60),
  add column if not exists level_high      text check (char_length(level_high) <= 200),
  add column if not exists level_mid       text check (char_length(level_mid) <= 200),
  add column if not exists level_low       text check (char_length(level_low) <= 200);

-- ── 요소별 자기평가·교사 등급 ────────────────────────────────────
-- 상태 판정(평가 대기 / 피드백 완료)은 lib/learning.ts의 getLearningStatus 한 곳에서 한다.
create table if not exists learning_submission_grades (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references learning_submissions (id) on delete cascade,
  question_id     uuid not null references learning_activity_questions (id) on delete cascade,
  self_grade      text check (self_grade in ('high', 'mid', 'low')),
  teacher_grade   text check (teacher_grade in ('high', 'mid', 'low')),
  teacher_comment text check (char_length(teacher_comment) <= 200),
  updated_at      timestamptz not null default now(),
  unique (submission_id, question_id)
);

create index if not exists idx_learning_submission_grades_submission
  on learning_submission_grades (submission_id);
create index if not exists idx_learning_submission_grades_question
  on learning_submission_grades (question_id);

-- ── 교과발달상황 (AI생성 탭) ─────────────────────────────────────
-- 학생 × 과목 1행. 한 과목을 다시 만들면 그 과목 행만 덮어쓴다.
create table if not exists ai_learning_subject_reports (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students (id) on delete cascade,
  teacher_id   uuid not null references teacher_profiles (id) on delete cascade,
  subject      text not null,
  content      text not null check (char_length(content) <= 400),
  source_count int not null default 0,          -- 생성에 쓴 기록 수
  generated_at timestamptz not null default now(),
  unique (student_id, subject)
);

-- RLS — 켜되 정책은 만들지 않는다(deny-all). 기존 learning_* 및 모든 테이블과 같은 패턴이다.
--
-- DB 접근은 supabaseAdmin(service role)을 거치고 service role은 RLS를 우회한다.
-- 권한 확인의 1차 책임은 API 라우트에 있고(lib/learning-access.ts, requireTeacherStudent),
-- RLS는 anon 키로 PostgREST에 직접 붙는 경로를 막는 2차 방어선이다.
-- 학생은 Auth 사용자가 아니라 auth.uid()가 NULL이므로 auth.uid() 정책을 쓰지 않는다.
--
--   테이블                        | SELECT   | INSERT   | UPDATE   | DELETE
--   learning_submission_grades    | deny-all | deny-all | deny-all | deny-all
--   ai_learning_subject_reports   | deny-all | deny-all | deny-all | deny-all
--
-- learning_activity_questions는 이미 RLS enable + deny-all이다. 컬럼만 늘어나므로 정책 변화는 없다.
alter table learning_submission_grades  enable row level security;
alter table ai_learning_subject_reports enable row level security;
