-- 배움성찰 디지털 포트폴리오
-- 교사가 과목·단원·활동명·성찰 질문으로 활동을 열면, 학생이 결과물(이미지/PDF)과
-- 성찰 답변을 남기고, 교사가 필요한 학생에게만 피드백을 단다.
--
-- 기존 eval_* 테이블(평가피드백)은 건드리지 않는다. 두 기능은 당분간 병행 운영하며,
-- 평가피드백 축소·제거 시점은 별도로 결정한다.

-- 활동 (학급 단위)
CREATE TABLE IF NOT EXISTS learning_activities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id            UUID NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  -- 활동을 만든 교사. 학급 소유 교사는 classes.teacher_id로 거슬러 갈 수 있지만,
  -- 작성자를 기록으로 남기고 목록 조회 시 조인을 줄이려고 비정규화한다.
  teacher_id          UUID NOT NULL REFERENCES teacher_profiles (id) ON DELETE CASCADE,
  subject             TEXT NOT NULL,
  unit                TEXT NOT NULL,
  title               TEXT NOT NULL,
  reflection_question TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 학생별 제출물 (활동당 학생 1행)
-- status/feedback_text 조합이 곧 화면 상태다. 판정 규칙은 lib/learning.ts 한 곳에만 둔다.
--   미제출      : 행이 없거나 status = 'draft'
--   제출 완료   : status = 'submitted' AND feedback_text IS NULL
--   피드백 완료 : status = 'submitted' AND feedback_text IS NOT NULL
CREATE TABLE IF NOT EXISTS learning_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id         UUID NOT NULL REFERENCES learning_activities (id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  reflection_answer   TEXT CHECK (char_length(reflection_answer) <= 500),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  -- 'teacher'는 교사 대리 업로드. 이 경우 성찰 답변이 없어도 저장된다.
  submitted_by        TEXT NOT NULL DEFAULT 'student' CHECK (submitted_by IN ('student', 'teacher')),
  submitted_at        TIMESTAMPTZ,
  feedback_text       TEXT CHECK (char_length(feedback_text) <= 500),
  feedback_updated_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

CREATE TABLE IF NOT EXISTS learning_submission_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES learning_submissions (id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_activities_class
  ON learning_activities (class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_submissions_activity
  ON learning_submissions (activity_id);
CREATE INDEX IF NOT EXISTS idx_learning_submissions_student
  ON learning_submissions (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_submission_files_submission
  ON learning_submission_files (submission_id, sort_order);

-- RLS — 켜되 정책은 만들지 않는다(deny-all). 기존 모든 테이블과 같은 패턴이다.
--
-- 이 프로젝트의 DB 접근은 거의 전부 supabaseAdmin(service role)을 거치고,
-- service role은 RLS를 통째로 우회한다. 따라서 권한 확인의 1차 책임은 API 라우트에 있고,
-- RLS는 anon 키로 PostgREST에 직접 붙는 경로를 막는 2차 방어선이다.
--
-- 학생은 Supabase Auth 사용자가 아니라 auth.uid()가 NULL이므로,
-- learning_submissions에 auth.uid() 기반 정책을 쓰면 통과가 아니라 전면 차단으로 동작한다.
-- 그래서 학생 소유 확인은 정책이 아니라 라우트에서 세션의 student_id와 대조한다.
--
--   테이블                      | SELECT   | INSERT   | UPDATE   | DELETE
--   learning_activities         | deny-all | deny-all | deny-all | deny-all
--   learning_submissions        | deny-all | deny-all | deny-all | deny-all
--   learning_submission_files   | deny-all | deny-all | deny-all | deny-all
ALTER TABLE learning_activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_submission_files  ENABLE ROW LEVEL SECURITY;
