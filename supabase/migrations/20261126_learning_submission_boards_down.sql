-- 20261126_learning_submission_boards.sql 롤백
-- 근거로 붙인 작업장 연결만 사라진다(작업장·카드는 그대로). 그 근거만으로 제출된 학생은 다음 저장 때 미제출로 바뀔 수 있다.
drop table if exists public.learning_submission_boards;
