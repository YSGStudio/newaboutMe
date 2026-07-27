-- 연료 잔고를 원자적으로 증가시키는 함수.
-- grantFuel이 "읽기 → JS 합산 → 절대값 쓰기"로 갱신하면 서로 다른 소스의 동시 지급이
-- 서로를 덮어써 연료가 유실될 수 있다(lost update). 이 함수로 total_fuel을 DB에서
-- 원자적으로 더하고(없으면 행 생성), 스트릭/최근활동일도 같은 호출에서 함께 갱신한다.
-- 반환값은 갱신 후의 total_fuel.

create or replace function public.voyage_add_fuel(
  p_student uuid,
  p_amount int,
  p_streak int,
  p_last_active date,
  p_apply_streak boolean
) returns int
language sql
as $$
  insert into public.voyage_state (student_id, total_fuel, streak_days, last_active_on)
  values (
    p_student,
    greatest(0, p_amount),
    greatest(0, p_streak),
    case when p_apply_streak then p_last_active else null end
  )
  on conflict (student_id) do update set
    total_fuel     = greatest(0, public.voyage_state.total_fuel + p_amount),
    streak_days    = case when p_apply_streak then greatest(0, p_streak) else public.voyage_state.streak_days end,
    last_active_on = case when p_apply_streak then p_last_active else public.voyage_state.last_active_on end,
    updated_at     = now()
  returning total_fuel;
$$;
