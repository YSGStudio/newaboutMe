-- 연속 기록(스트릭) 보정 — 데이터 보정 전용, 스키마 변경 없음.
--
-- 원인: lib/voyage.ts의 previousSchoolDate가 서버 시간대(Vercel=UTC)에서 요일을 계산해
-- 월·화요일의 "직전 등교일"을 토요일로 판정했다. 그 결과 금→월, 월→화 연속이 매주 끊겨
-- 최대 연속이 3일에 묶였고 1.5배(5일)·2배(10일) 부스터가 한 번도 적용되지 않았다.
--
-- 보정 방식: plan_check·emotion_feed 원장을 학생별로 시간순 재생해 올바른 규칙
-- (평일끼리 연결, 주말 활동은 연속에 영향 없음·배율 1)로 배율을 다시 계산한다.
-- 원래 받아야 했던 양보다 적게 받은 만큼만 더한다(더 받은 경우 회수하지 않음).
-- 보정분은 fuel_ledger에 source_type='streak_fix' 1행으로 남기고,
-- voyage_state의 연료·연속 일수·마지막 활동일과 별 도달을 함께 갱신한다.
--
-- 재실행 안전: fuel_ledger의 unique(student_id, source_type, source_id)로 학생당 1회만
-- 들어가고, 상태 갱신은 이번에 실제로 들어간 행에만 적용된다.

with recursive r0 as (
  select id, student_id, earned_on, base_amount, amount,
    row_number() over (partition by student_id order by created_at, id) rn,
    extract(isodow from earned_on) in (6, 7) wk,
    earned_on - case extract(isodow from earned_on)::int when 1 then 3 when 7 then 2 else 1 end prev_school
  from public.fuel_ledger
  where source_type in ('plan_check', 'emotion_feed')
), r as (
  select r0.*,
    case when wk then 0 else 1 end streak,
    case when wk then null else earned_on end last_on
  from r0 where rn = 1
  union all
  select n.*,
    case when n.wk then r.streak
         when r.last_on = n.earned_on then r.streak
         when r.last_on = n.prev_school then r.streak + 1
         else greatest(1, case when r.streak > 0 then ceil(r.streak / 2.0)::int else 1 end) end,
    case when n.wk then r.last_on else n.earned_on end
  from r join r0 n on n.student_id = r.student_id and n.rn = r.rn + 1
), per as (
  select student_id,
    sum(greatest(0, floor(base_amount * case when wk then 1.0 when streak >= 10 then 2 when streak >= 5 then 1.5 when streak >= 3 then 1.2 else 1 end)::int - amount))::int owed,
    (array_agg(streak order by rn desc))[1] final_streak,
    (array_agg(last_on order by rn desc))[1] final_last
  from r group by student_id
), ins as (
  insert into public.fuel_ledger (student_id, source_type, source_id, base_amount, multiplier, amount, earned_on, note)
  select student_id, 'streak_fix', 'streak-fix-20261007', owed, 1, owed, date '2026-10-07', '주말을 건너뛴 연속 기록 보정'
  from per where owed > 0
  on conflict (student_id, source_type, source_id) do nothing
  returning student_id, amount
), calc as (
  -- 같은 행을 한 문장에서 두 번 갱신하지 않도록, 새 연료·별·티어를 먼저 계산한다.
  select v.student_id, ins.amount, v.total_fuel + ins.amount new_total, per.final_streak, per.final_last,
    greatest(v.current_star, coalesce(max(s.level), 0)) new_star,
    greatest(v.ship_tier, coalesce(max(s.reward_ship_tier), 1)) new_tier,
    v.current_star old_star
  from ins
  join per using (student_id)
  join public.voyage_state v using (student_id)
  left join public.stars s on s.fuel_threshold <= v.total_fuel + ins.amount and s.level > v.current_star
  group by v.student_id, v.total_fuel, ins.amount, per.final_streak, per.final_last, v.current_star, v.ship_tier
), arrived as (
  insert into public.star_arrivals (student_id, star_level)
  select calc.student_id, s.level from calc
  join public.stars s on s.fuel_threshold <= calc.new_total and s.level > calc.old_star
  on conflict (student_id, star_level) do nothing
  returning student_id
)
update public.voyage_state v set
  total_fuel     = v.total_fuel + calc.amount,
  streak_days    = calc.final_streak,
  last_active_on = calc.final_last,
  current_star   = calc.new_star,
  ship_tier      = calc.new_tier,
  updated_at     = now()
from calc
where v.student_id = calc.student_id;
