-- 20260919_learning_activity_archive.sql 롤백
-- 보관 표시만 사라지고 활동은 모두 진행 중 목록으로 돌아간다.
alter table learning_activities drop column if exists archived_at;
