-- 일일계획 기능 완전 삭제 — 데이터 단계 (백업 → 코드 → 데이터 순서의 마지막).
--
-- ⚠ 되돌릴 수 없다. 반드시 아래 두 가지를 먼저 확인하고 실행한다.
--   1) 백업: ~/starlog-backups/2026-10-09-plans/ 에 plans(233) · plan_checks(5,291) ·
--      plan_title_history(110) 를 JSON으로 내보내 두었다(2026-10-09).
--   2) 코드: 계획 테이블을 읽던 화면·라우트·뱃지·통계·AI 리포트 코드를 지운 배포가
--      운영에 먼저 나가 있어야 한다. 예전 코드가 살아 있는 상태에서 실행하면 500이 난다.
--
-- 남기는 것(의도):
--   - fuel_ledger의 source_type='plan_check' 행 — 학생의 연료 내역·잔고 근거라 지우지 않는다.
--   - student_badges의 plan_* 행 — 이미 받은 계획 뱃지는 도감에 남긴다(lib/badges.ts retired).
--   - class_badge_settings의 plan_* 행 — 화면이 더 이상 읽지 않아 무해하다.
--
-- 복구가 필요하면: supabase/schema.sql(plans · plan_checks)과
-- 20260322_plan_title_history.sql의 정의로 테이블을 다시 만들고 백업 JSON을 다시 넣는다.

drop table if exists public.plan_title_history;
drop table if exists public.plan_checks;
drop table if exists public.plans;

-- AI 성장 리포트의 "일일계획 실천 분석" 칸. 코드가 더 이상 읽거나 쓰지 않는다.
alter table public.ai_growth_reports drop column if exists plan_analysis;
