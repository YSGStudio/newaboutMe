-- 20261126_starboard_learning_activity_link.sql 롤백
-- 연결만 사라진다. 미러였던 기준·별빛보드 평가 사본·배움성찰 등급은 그대로 남는다.

drop index if exists public.sb_criteria_learning_question_uniq;
drop index if exists public.sb_criteria_learning_activity_idx;
alter table public.sb_criteria
  drop column if exists learning_question_id,
  drop column if exists learning_activity_id;

drop index if exists public.sb_boards_learning_activity_uniq;
alter table public.sb_boards drop column if exists learning_activity_id;
