-- AI 성장 리포트 캐시 테이블
-- gpt-4o가 생성한 일일계획 실천 분석·감정 패턴 인사이트·맞춤 성장 제언을 당일 자정까지 캐싱한다.
-- (과목별 교과발달상황은 종합평가 기능으로 분리됨 — ai_subject_reports 참고)
CREATE TABLE IF NOT EXISTS ai_growth_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  period          TEXT NOT NULL CHECK (period IN ('week', 'month', 'semester')),
  generated_date  DATE NOT NULL,                  -- 생성 날짜 (캐시 기준, Asia/Seoul)
  plan_analysis   TEXT NOT NULL,                  -- 일일계획 실천 패턴 분석
  emotion_insight TEXT NOT NULL,
  growth_suggestion TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, period, generated_date)
);

CREATE INDEX IF NOT EXISTS ai_growth_reports_student_idx ON ai_growth_reports(student_id);

-- RLS 활성화 (API는 supabaseAdmin으로 호출하므로 정책 불필요)
ALTER TABLE ai_growth_reports ENABLE ROW LEVEL SECURITY;
