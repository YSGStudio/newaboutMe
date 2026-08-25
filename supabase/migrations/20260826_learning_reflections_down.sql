-- 20260826_learning_reflections.sql 롤백
-- 신규 테이블만 만들었으므로 되돌릴 수 있다. 기존 eval_* 테이블은 영향받지 않는다.
--
-- 주의: 이 스크립트는 배움성찰 활동·제출물·성찰 답변·피드백을 전부 지운다.
-- Storage 버킷 learning-files의 객체는 함께 지워지지 않으므로 필요하면 따로 비운다.

DROP TABLE IF EXISTS learning_submission_files;
DROP TABLE IF EXISTS learning_submissions;
DROP TABLE IF EXISTS learning_activities;
