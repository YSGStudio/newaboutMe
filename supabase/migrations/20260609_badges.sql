-- students 테이블에 뱃지/칭호 컬럼 추가
ALTER TABLE students ADD COLUMN IF NOT EXISTS badge_count INT NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '별빛 새싹';

-- 학생 뱃지 획득 기록 테이블
CREATE TABLE IF NOT EXISTS student_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  badge_id    TEXT        NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, badge_id)
);

ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;

-- 학생은 자신의 뱃지만 조회 가능 (student_sessions 기반)
CREATE POLICY "student_badges_select_own" ON student_badges
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM student_sessions
      WHERE session_token = current_setting('request.cookies', true)::json->>'student_session'
    )
  );
