-- 홀란드 기반 성향 분석 저장 테이블
-- gpt-4o가 계획·감정·평가 데이터를 종합해 RIASEC 유형 성향을 추론한 결과를 저장.
-- 학생당 1건만 영구 저장하며, "AI 생성" 버튼 재클릭 시 덮어쓴다.
CREATE TABLE IF NOT EXISTS ai_holland_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  primary_type      TEXT NOT NULL,          -- 'R'|'I'|'A'|'S'|'E'|'C'
  primary_label     TEXT NOT NULL,          -- 예: '탐구형'
  primary_reason    TEXT NOT NULL,
  secondary_type    TEXT,                   -- 없을 수 있음
  secondary_label   TEXT,
  secondary_reason  TEXT,
  career_suggestions JSONB NOT NULL,        -- string[]
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 활성화 (API는 supabaseAdmin으로 호출하므로 정책 불필요)
ALTER TABLE ai_holland_reports ENABLE ROW LEVEL SECURITY;
