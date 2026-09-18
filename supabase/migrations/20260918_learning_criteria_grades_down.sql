-- 20260918_learning_criteria_grades.sql 롤백
-- 새 테이블과 새 컬럼만 추가했으므로 되돌릴 수 있다. 기존 활동·질문·답변은 남는다.
--
-- 주의: 이 스크립트는 요소별 자기평가·교사 등급·코멘트, 평가요소 기준 문장,
-- AI생성 탭의 교과발달상황 결과를 전부 지운다.

drop table if exists ai_learning_subject_reports;
drop table if exists learning_submission_grades;

alter table learning_activity_questions
  drop column if exists level_low,
  drop column if exists level_mid,
  drop column if exists level_high,
  drop column if exists criterion_title;
