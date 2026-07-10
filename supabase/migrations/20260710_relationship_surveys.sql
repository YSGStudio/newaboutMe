-- 교우관계(소시오메트리) 설문 및 응답
-- 학생 간 지명 관계를 수집해 교사가 고립 학생·상호 친밀 관계·갈등 조짐을 파악하는 데 쓴다.
-- 응답 원본(누가 누구를 지명했는지)은 교사 전용 API(report)에서 집계된 지표로만 노출하며,
-- 학생 본인에게도 자신의 득표 결과를 보여주지 않는다.

CREATE TABLE IF NOT EXISTS relationship_surveys (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id           UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id         UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL DEFAULT '교우관계 조사',
  includes_negative  BOOLEAN NOT NULL DEFAULT false,
  closed_at          TIMESTAMPTZ,                 -- NULL이면 응답 진행 중
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 지명형 응답 (긍정/부정/역할 관찰형) — 한 응답자가 문항당 여러 대상을 지명 가능
CREATE TABLE IF NOT EXISTS relationship_nominations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id      UUID NOT NULL REFERENCES relationship_surveys(id) ON DELETE CASCADE,
  rater_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  target_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_type  TEXT NOT NULL CHECK (question_type IN ('positive', 'negative', 'role_leader', 'role_isolated')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, rater_id, target_id, question_type)
);

-- 개방형 서술 응답 (선택)
CREATE TABLE IF NOT EXISTS relationship_open_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id   UUID NOT NULL REFERENCES relationship_surveys(id) ON DELETE CASCADE,
  rater_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, rater_id)
);

-- 학생별 응답 완료 여부 (1회 제출 후 잠금, 진행률 표시용)
CREATE TABLE IF NOT EXISTS relationship_survey_completions (
  survey_id    UUID NOT NULL REFERENCES relationship_surveys(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, student_id)
);

CREATE INDEX IF NOT EXISTS relationship_surveys_class_idx ON relationship_surveys(class_id);
CREATE INDEX IF NOT EXISTS relationship_nominations_survey_idx ON relationship_nominations(survey_id);
CREATE INDEX IF NOT EXISTS relationship_open_responses_survey_idx ON relationship_open_responses(survey_id);

-- RLS 활성화 (API는 supabaseAdmin으로 호출하므로 정책 불필요 — 기존 테이블들과 동일 패턴)
ALTER TABLE relationship_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_open_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_survey_completions ENABLE ROW LEVEL SECURITY;
