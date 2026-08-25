-- 배움성찰 2차 — 성찰 질문 복수화 + 결과물 링크
--
-- 1) 활동당 성찰 질문 1개(learning_activities.reflection_question) → 질문 테이블로 분리.
--    질문마다 답이 따로 붙어야 화면에서 질문·답을 짝지어 보여줄 수 있다.
-- 2) 결과물에 이미지·PDF뿐 아니라 링크도 등록할 수 있게 한다.
--    (기존 eval_report_links와 같은 모양으로 맞춘다)
--
-- 이미 쓰이고 있는 활동·제출물이 있으므로 기존 질문·답을 새 테이블로 옮긴 뒤에 컬럼을 지운다.

-- ── 성찰 질문 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_activity_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES learning_activities (id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 질문별 학생 답변. 질문이 지워지면 답도 함께 사라진다.
CREATE TABLE IF NOT EXISTS learning_submission_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES learning_submissions (id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES learning_activity_questions (id) ON DELETE CASCADE,
  answer        TEXT NOT NULL DEFAULT '' CHECK (char_length(answer) <= 500),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, question_id)
);

-- ── 결과물 링크 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_submission_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES learning_submissions (id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  label         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 기존 데이터 이전 ─────────────────────────────────────────────
-- 활동의 단일 질문을 첫 번째 질문으로 옮긴다.
INSERT INTO learning_activity_questions (activity_id, question, sort_order)
SELECT id, reflection_question, 0
  FROM learning_activities
 WHERE reflection_question IS NOT NULL
   AND btrim(reflection_question) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM learning_activity_questions q WHERE q.activity_id = learning_activities.id
   );

-- 학생이 쓴 답을 그 질문에 연결한다.
INSERT INTO learning_submission_answers (submission_id, question_id, answer)
SELECT s.id, q.id, s.reflection_answer
  FROM learning_submissions s
  JOIN learning_activity_questions q
    ON q.activity_id = s.activity_id AND q.sort_order = 0
 WHERE s.reflection_answer IS NOT NULL
   AND btrim(s.reflection_answer) <> ''
ON CONFLICT (submission_id, question_id) DO NOTHING;

-- 이전이 끝났으므로 원본 컬럼을 지운다. 답이 두 곳에 남으면 어느 쪽이 진짜인지 흐려진다.
ALTER TABLE learning_activities  DROP COLUMN IF EXISTS reflection_question;
ALTER TABLE learning_submissions DROP COLUMN IF EXISTS reflection_answer;

CREATE INDEX IF NOT EXISTS idx_learning_activity_questions_activity
  ON learning_activity_questions (activity_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_submission_answers_submission
  ON learning_submission_answers (submission_id);
CREATE INDEX IF NOT EXISTS idx_learning_submission_links_submission
  ON learning_submission_links (submission_id, sort_order);

-- RLS — 켜되 정책은 만들지 않는다(deny-all). 기존 learning_* 및 모든 테이블과 같은 패턴.
-- 권한 확인의 1차 책임은 API 라우트에 있다.
ALTER TABLE learning_activity_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_submission_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_submission_links    ENABLE ROW LEVEL SECURITY;
