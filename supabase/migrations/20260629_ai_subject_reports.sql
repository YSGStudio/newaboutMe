-- 종합평가(과목별 교과발달상황) 저장 테이블
-- gpt-4o가 학생의 전체 평가기록(기간 제한 없음)을 과목 단위로 분석한 결과를 저장.
-- 기간별 캐시가 아니라 학생당 1건만 영구 저장하며, "AI 분석" 버튼을 다시 누르면 덮어쓴다.
CREATE TABLE IF NOT EXISTS ai_subject_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  subject_reports JSONB NOT NULL,                 -- [{ subject(과목명), content }]
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 마지막 분석 시각 (재분석 시 갱신)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 활성화 (API는 supabaseAdmin으로 호출하므로 정책 불필요)
ALTER TABLE ai_subject_reports ENABLE ROW LEVEL SECURITY;
