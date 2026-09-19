-- 배움성찰 활동 보관(완료) — 교사가 "완료"를 누른 활동을 보관함으로 옮긴다.
--
-- archived_at이 있으면 보관된 활동이다. 교사 배움성찰 탭의 "보관함"에서만 보이고,
-- "되돌리기"로 다시 진행 중 목록으로 옮길 수 있다(archived_at = null).
-- 학생 화면, 통계, AI생성은 보관 여부와 관계없이 그대로 기록을 읽는다.
-- 컬럼만 추가하므로 기존 데이터는 바뀌지 않는다(모두 진행 중으로 남는다).

alter table learning_activities
  add column if not exists archived_at timestamptz;

-- RLS: learning_activities는 이미 enable row level security + 정책 없음(deny-all)이다
-- (20260826_learning_reflections.sql). 컬럼만 늘어나므로 정책 변화는 없다.
--
--   테이블                | SELECT   | INSERT   | UPDATE   | DELETE
--   learning_activities   | deny-all | deny-all | deny-all | deny-all
alter table learning_activities enable row level security;
