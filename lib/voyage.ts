import type { SupabaseClient } from '@supabase/supabase-js';
import { todayDate, formatDateInSeoul } from '@/lib/date';

export const FUEL_RULES = {
  plan_check: { base: 5, dailyCap: 1 },
  emotion_feed: { base: 8, dailyCap: 1, minChars: 20 },
  reflection: { base: 10, dailyCap: 1, minChars: 40 },
  letter: { base: 5, dailyCap: 2, minChars: 15 },
  badge: { base: 50, dailyCap: null },
  weekly_streak: { base: 30, dailyCap: null },
  comeback: { base: 20, dailyCap: null },
} as const;

export type FuelSource = keyof typeof FUEL_RULES | 'teacher_grant' | 'teacher_revoke';

const BOOSTER_ELIGIBLE_SOURCES = new Set<FuelSource>(['plan_check', 'emotion_feed']);

export type VoyageStar = {
  level: number;
  name: string;
  emoji: string;
  fuel_threshold: number;
  reward_ship_tier: number | null;
  reward_title: string | null;
  fact: string;
};

export type FuelGrantResult = {
  granted: boolean;
  amount: number;
  multiplier: number;
  totalFuel: number;
  arrivedStars: VoyageStar[];
  reason?: 'already_granted' | 'daily_cap';
};

// 별(stars)은 마이그레이션으로만 바뀌는 정적 참조 데이터라 프로세스 단위로 캐시한다.
// grantFuel의 도달 판정과 각 라우트의 목록 응답에서 매 요청 조회를 없앤다.
let starsCache: VoyageStar[] | null = null;

export async function getStars(supabase: SupabaseClient): Promise<VoyageStar[]> {
  if (starsCache) return starsCache;
  const { data, error } = await supabase
    .from('stars')
    .select('level,name,emoji,fuel_threshold,reward_ship_tier,reward_title,fact')
    .order('level');
  if (error) throw error;
  starsCache = (data ?? []) as VoyageStar[];
  return starsCache;
}

// 학생의 활성 계획이 오늘 모두 체크(완료/미완료 판정)되었는지.
// 계획 체크 라우트와 /voyage/me가 동일 로직을 각자 갖고 있던 것을 하나로 모은다.
export async function areAllActivePlansChecked(
  supabase: SupabaseClient,
  studentId: string,
  date: string,
): Promise<boolean> {
  const { data: activePlans } = await supabase
    .from('plans')
    .select('id')
    .eq('student_id', studentId)
    .eq('is_active', true);
  const planIds = (activePlans ?? []).map((plan) => plan.id);
  if (planIds.length === 0) return false;

  const { data: checks } = await supabase
    .from('plan_checks')
    .select('plan_id,is_completed')
    .in('plan_id', planIds)
    .eq('check_date', date);
  const checkedIds = new Set(
    (checks ?? [])
      .filter((check) => typeof check.is_completed === 'boolean')
      .map((check) => check.plan_id),
  );
  return planIds.every((id) => checkedIds.has(id));
}

const multiplierFor = (days: number) => days >= 10 ? 2 : days >= 5 ? 1.5 : days >= 3 ? 1.2 : 1;

const previousSchoolDate = (date: string) => {
  const cursor = new Date(`${date}T00:00:00+09:00`);
  do cursor.setDate(cursor.getDate() - 1);
  while (cursor.getDay() === 0 || cursor.getDay() === 6);
  return formatDateInSeoul(cursor);
};

const updateStreak = (lastActiveOn: string | null, streakDays: number, earnedOn: string) => {
  if (lastActiveOn === earnedOn) return streakDays;
  if (lastActiveOn === previousSchoolDate(earnedOn)) return streakDays + 1;
  return Math.max(1, streakDays > 0 ? Math.ceil(streakDays / 2) : 1);
};

export async function grantFuel(
  supabase: SupabaseClient,
  studentId: string,
  sourceType: FuelSource,
  sourceId: string,
  options?: { baseAmount?: number; note?: string; earnedOn?: string; applyBooster?: boolean },
): Promise<FuelGrantResult> {
  const earnedOn = options?.earnedOn ?? todayDate();
  const rule = sourceType in FUEL_RULES ? FUEL_RULES[sourceType as keyof typeof FUEL_RULES] : null;
  const baseAmount = options?.baseAmount ?? rule?.base ?? 0;
  const isRevoke = sourceType === 'teacher_revoke' || baseAmount < 0;
  // 매일 반복하는 감정 기록과 계획 체크만 연속 일수 및 부스터에 반영한다.
  // 성찰일기·별빛메일·배지·교사 지급 등은 기본 연료만 지급한다.
  const appliesBooster = !isRevoke
    && options?.applyBooster !== false
    && BOOSTER_ELIGIBLE_SOURCES.has(sourceType);

  // 현재 상태를 1회만 읽는다(없으면 기본값). 사전 중복 SELECT는 제거 —
  // fuel_ledger의 unique 제약(23505)이 중복을 판정한다.
  const { data: existingState } = await supabase
    .from('voyage_state')
    .select('total_fuel,current_star,ship_tier,streak_days,last_active_on')
    .eq('student_id', studentId)
    .maybeSingle();
  const state = existingState ?? {
    total_fuel: 0, current_star: 0, ship_tier: 1, streak_days: 0, last_active_on: null as string | null,
  };

  // 일일 상한 — source_id가 매 활동마다 달라지는 소스(감정·성찰·편지)에만 필요.
  // plan_check처럼 source_id가 날짜인 경우는 unique 제약이 이미 하루 1회를 보장한다.
  if (rule?.dailyCap && sourceId !== earnedOn) {
    const { count } = await supabase
      .from('fuel_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('source_type', sourceType)
      .eq('earned_on', earnedOn);
    if ((count ?? 0) >= rule.dailyCap) {
      return { granted: false, amount: 0, multiplier: 1, totalFuel: state.total_fuel, arrivedStars: [], reason: 'daily_cap' };
    }
  }

  const streakDays = appliesBooster
    ? updateStreak(state.last_active_on, state.streak_days, earnedOn)
    : state.streak_days;
  const multiplier = appliesBooster ? multiplierFor(streakDays) : 1;
  const amount = isRevoke ? -Math.abs(baseAmount) : Math.floor(baseAmount * multiplier);

  // 원장을 먼저 기록해 중복을 차단한다. 성공한 경우에만 실제 연료를 더한다.
  const { error: ledgerError } = await supabase.from('fuel_ledger').insert({
    student_id: studentId,
    source_type: sourceType,
    source_id: sourceId,
    base_amount: baseAmount,
    multiplier,
    amount,
    earned_on: earnedOn,
    note: options?.note ?? null,
  });
  if (ledgerError) {
    if (ledgerError.code === '23505') {
      return { granted: false, amount: 0, multiplier, totalFuel: state.total_fuel, arrivedStars: [], reason: 'already_granted' };
    }
    throw ledgerError;
  }

  // 연료 잔고를 DB에서 원자적으로 증가(동시 지급 lost update 방지) + 스트릭/최근활동일 갱신.
  const { data: newTotal, error: rpcError } = await supabase.rpc('voyage_add_fuel', {
    p_student: studentId,
    p_amount: amount,
    p_streak: streakDays,
    p_last_active: earnedOn,
    p_apply_streak: appliesBooster,
  });
  if (rpcError) throw rpcError;
  const totalFuel = typeof newTotal === 'number' ? newTotal : Math.max(0, state.total_fuel + amount);

  // 도달 판정은 캐시된 stars로 메모리에서 처리(별도 DB 조회 없음).
  const stars = await getStars(supabase);
  const arrivedStars = stars.filter((star) => star.fuel_threshold <= totalFuel && star.level > state.current_star);

  if (arrivedStars.length > 0) {
    const currentStar = Math.max(state.current_star, ...arrivedStars.map((s) => s.level));
    const shipTier = Math.max(state.ship_tier, ...arrivedStars.map((s) => s.reward_ship_tier ?? 1));
    // 별 도달 기록(배치)과 단계/티어 갱신을 병렬로. greatest 대신 값 비교는 이미 마쳤고,
    // current_star/ship_tier는 단조 증가라 동시성에서도 안전하다.
    await Promise.all([
      supabase.from('star_arrivals').upsert(
        arrivedStars.map((s) => ({ student_id: studentId, star_level: s.level })),
        { onConflict: 'student_id,star_level', ignoreDuplicates: true },
      ),
      supabase.from('voyage_state').update({ current_star: currentStar, ship_tier: shipTier }).eq('student_id', studentId),
    ]);
  }

  return { granted: true, amount, multiplier, totalFuel, arrivedStars };
}

export async function grantBadgeFuel(
  supabase: SupabaseClient,
  studentId: string,
  badges: Array<{ badge: { id: string } }>,
) {
  for (const awarded of badges) {
    await grantFuel(supabase, studentId, 'badge', awarded.badge.id, { applyBooster: false });
  }
}

export const isQualityContent = (content: string, minChars: number) => {
  const compact = content.trim().replace(/\s/g, '');
  return compact.length >= minChars && !/(.)\1{4,}/u.test(compact);
};
