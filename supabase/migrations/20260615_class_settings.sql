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

-- RLS 활성화 (API는 supabaseAdmin으로 호출하므로 정책 불필요)
ALTER TABLE class_badge_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_title_settings ENABLE ROW LEVEL SECURITY;
