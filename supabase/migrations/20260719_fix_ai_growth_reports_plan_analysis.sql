-- ai_growth_reports 스키마 드리프트 복구
--
-- 문제: 운영 DB의 ai_growth_reports 테이블에 plan_analysis 컬럼이 없고(초기 버전의
--       subject_reports 컬럼이 그대로 남아 있음), 코드는 plan_analysis에 저장을 시도한다.
--       그 결과 성장 리포트 저장이 조용히 실패해(PGRST204) 전체분석·개별분석 모두
--       "분석은 됐는데 다시 열면 사라지는" 상태였다.
-- 조치: 누락된 plan_analysis 컬럼을 추가하고, 잘못 남은 subject_reports 컬럼을 제거한다.
--       (과목별 교과발달상황은 별도 테이블 ai_subject_reports에서 관리한다)

-- 1) 누락된 plan_analysis 컬럼 추가 (기존 행은 빈 값으로 채워짐)
ALTER TABLE ai_growth_reports
  ADD COLUMN IF NOT EXISTS plan_analysis TEXT NOT NULL DEFAULT '';

-- 2) 잘못 남아 있던 subject_reports 컬럼 제거 (성장 리포트와 무관)
ALTER TABLE ai_growth_reports
  DROP COLUMN IF EXISTS subject_reports;

-- 3) 과거 스키마에서 남은 빈(plan_analysis 없는) 캐시 행 정리
--    — 성장 리포트는 재조회 시 자동 재생성되므로 삭제해도 안전하다.
DELETE FROM ai_growth_reports WHERE plan_analysis = '';
