-- 별빛보드 작업장 ↔ 배움성찰 활동 연결 — 평가를 한 번으로 끝낸다
--
-- 작업장(sb_boards, kind='shared')을 같은 학급의 배움성찰 활동 하나에 연결한다.
--   · 작업장의 평가 기준은 그 활동의 평가요소를 따라 만든 기준(미러)으로만 채운다.
--     미러 기준은 sb_criteria.learning_activity_id / learning_question_id로 원래 요소를 가리킨다.
--   · 평가의 원본은 배움성찰 쪽(learning_submission_grades.teacher_grade, learning_submissions.feedback_text)이다.
--     별빛보드 평가 화면에서 저장해도 배움성찰 자리에 쓰고, sb_evaluations는 별빛보드 화면(학생 평가 보기·동료평가 비교)을 위한 사본으로 맞춘다.
--   · 어느 쪽에서 평가해도 같은 자리를 고치므로 리포트에는 배움성찰 기록 한 건으로만 들어간다.
-- 동기화는 앱(lib/starboard/learning-sync.ts)이 한다. 이 파일은 연결 컬럼만 둔다.
--
-- 활동이나 질문이 지워지면 연결만 풀린다(set null). 미러 기준은 보통 기준으로 남고 별빛보드 평가 사본도 남는다.
-- cascade로 지우지 않는 까닭: sb_criteria_lock 트리거가 평가에 쓰인 기준 삭제를 막아서 활동 삭제 자체가 실패한다.

alter table public.sb_boards
  add column if not exists learning_activity_id uuid references public.learning_activities (id) on delete set null;
-- 활동 하나에 작업장 하나 — 둘이면 어느 작업장 평가가 원본인지 정할 수 없다.
create unique index if not exists sb_boards_learning_activity_uniq
  on public.sb_boards (learning_activity_id) where learning_activity_id is not null;

alter table public.sb_criteria
  add column if not exists learning_activity_id uuid references public.learning_activities (id) on delete set null,
  add column if not exists learning_question_id uuid references public.learning_activity_questions (id) on delete set null;
create index if not exists sb_criteria_learning_activity_idx
  on public.sb_criteria (learning_activity_id) where learning_activity_id is not null;
create unique index if not exists sb_criteria_learning_question_uniq
  on public.sb_criteria (learning_question_id) where learning_question_id is not null;

-- RLS — 새 테이블이 없다. sb_boards·sb_criteria는 20261125_starboard.sql에서 RLS enable + 정책 없음(deny-all)이고
-- 컬럼만 늘어나므로 정책 변화는 없다. 소유 확인은 라우트가 한다
-- (작업장 → 프로젝트 → 교사, 활동 → 학급 → 교사, 둘의 class_id가 같은지).
--
--   테이블        | SELECT   | INSERT   | UPDATE   | DELETE
--   sb_boards     | deny-all | deny-all | deny-all | deny-all
--   sb_criteria   | deny-all | deny-all | deny-all | deny-all
alter table public.sb_boards enable row level security;
alter table public.sb_criteria enable row level security;
