-- 학급 편지 테이블
-- 같은 학급 학생 간 편지 주고받기 기능
CREATE TABLE letters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recipient_id UUID       NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title       VARCHAR(50) NOT NULL,
  content     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_letter CHECK (sender_id != recipient_id)
);

CREATE INDEX letters_class_id_idx    ON letters(class_id);
CREATE INDEX letters_recipient_id_idx ON letters(recipient_id);
CREATE INDEX letters_sender_id_idx   ON letters(sender_id);
CREATE INDEX letters_created_at_idx  ON letters(created_at DESC);
