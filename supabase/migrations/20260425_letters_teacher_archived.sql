-- Add teacher_archived_at to letters for "모두 읽음" feature.
-- NULL = 목록에 표시 / NOT NULL = 교사가 보관 처리하여 목록에서 숨김
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS teacher_archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS letters_teacher_archived_idx ON letters(teacher_archived_at);
