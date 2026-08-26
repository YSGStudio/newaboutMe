-- AI 성장 분석 · 홀란드 성향 분석 통합 (분석 버튼 1개 / OpenAI 호출 1회 / 사용량 1회 차감)
--
-- 배경: 두 분석은 원본 데이터(gatherGrowthReportData)가 완전히 같은데도 각각 따로 호출되어
--       교사가 버튼을 두 번 눌러야 했고 사용량도 2회 차감됐다. 한 번의 호출로 합치면서
--       결과를 ai_growth_reports 한 곳에 모은다.
--
-- 함께 고친 것: learning_insight(배움성찰 인사이트)는 코드가 생성·표시하고 있었지만 컬럼이 없어
--       저장되지 않았다. 분석 직후에만 보이고 모달을 다시 열면 사라지던 문제다.
--
-- ai_holland_reports 테이블과 그 안의 과거 분석은 지우지 않는다. 새 분석만 이 테이블에 쌓인다.

ALTER TABLE ai_growth_reports
  ADD COLUMN IF NOT EXISTS overall_summary            TEXT   NOT NULL DEFAULT '',  -- ① 한눈에 보기 · 종합 총평
  ADD COLUMN IF NOT EXISTS strength_keywords          JSONB  NOT NULL DEFAULT '[]'::jsonb,  -- ① 강점 키워드 string[]
  ADD COLUMN IF NOT EXISTS learning_insight           TEXT,                        -- ② 배움성찰 (기록 없으면 NULL)
  ADD COLUMN IF NOT EXISTS holland_primary_type       TEXT,                        -- ③ 이하 홀란드 (근거 부족 시 전부 NULL)
  ADD COLUMN IF NOT EXISTS holland_primary_label      TEXT,
  ADD COLUMN IF NOT EXISTS holland_primary_reason     TEXT,
  ADD COLUMN IF NOT EXISTS holland_secondary_type     TEXT,
  ADD COLUMN IF NOT EXISTS holland_secondary_label    TEXT,
  ADD COLUMN IF NOT EXISTS holland_secondary_reason   TEXT,
  ADD COLUMN IF NOT EXISTS holland_career_suggestions JSONB;

-- RLS
-- ai_growth_reports는 20260629_ai_growth_reports.sql에서 이미 RLS가 켜져 있고 정책은 없다.
-- 이건 실수가 아니라 deny-all 의도다 — 모든 접근은 라우트가 requireTeacher·requireTeacherStudent로
-- 소유를 확인한 뒤 supabaseAdmin(service role)으로만 한다. 컬럼 추가는 이 결론을 바꾸지 않는다.
--
--   SELECT — deny-all (라우트에서 처리)
--   INSERT — deny-all (라우트에서 처리)
--   UPDATE — deny-all (라우트에서 처리)
--   DELETE — deny-all (라우트에서 처리)
