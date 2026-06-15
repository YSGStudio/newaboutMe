-- 학급별 활성 뱃지 설정
CREATE TABLE IF NOT EXISTS class_badge_settings (
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (class_id, badge_id)
);

-- 학급별 칭호 설정
CREATE TABLE IF NOT EXISTS class_title_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tier       INT  NOT NULL,
  name       TEXT NOT NULL,
  threshold  INT  NOT NULL,
  UNIQUE(class_id, tier)
);

-- RLS 활성화
ALTER TABLE class_badge_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_title_settings ENABLE ROW LEVEL SECURITY;

-- 교사만 자기 학급 설정 읽기/쓰기
CREATE POLICY "teacher_class_badge_settings" ON class_badge_settings
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = (
        SELECT id FROM teachers WHERE id = (
          SELECT teacher_id FROM teacher_sessions WHERE token_hash = current_setting('request.jwt.claims', true)::json->>'token_hash' LIMIT 1
        )
      )
    )
  );

CREATE POLICY "teacher_class_title_settings" ON class_title_settings
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = (
        SELECT id FROM teachers WHERE id = (
          SELECT teacher_id FROM teacher_sessions WHERE token_hash = current_setting('request.jwt.claims', true)::json->>'token_hash' LIMIT 1
        )
      )
    )
  );
