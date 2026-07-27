import type { SupabaseClient } from '@supabase/supabase-js';
import { todayDate } from '@/lib/date';

export const FUEL_RULES = {
  plan_check: { base: 5, dailyCap: 1 },
  emotion_feed: { base: 8, dailyCap: 1, minChars: 20 },
  reflection: { base: 10, dailyCap: 1, minChars: 40 },
  letter: { base: 12, dailyCap: 2, minChars: 15 },
  badge: { base: 50, dailyCap: null },
  weekly_streak: { base: 30, dailyCap: null },
  comeback: { base: 20, dailyCap: null },
} as const;

export type FuelSource = keyof typeof FUEL_RULES | 'teacher_grant' | 'teacher_revoke';

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

const multiplierFor = (days: number) => days >= 10 ? 2 : days >= 5 ? 1.5 : days >= 3 ? 1.2 : 1;

const previousSchoolDate = (date: string) => {
  const cursor = new Date(`${date}T00:00:00+09:00`);
  do cursor.setDate(cursor.getDate() - 1);
  while (cursor.getDay() === 0 || cursor.getDay() === 6);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(cursor);
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

  const { data: existing } = await supabase
    .from('fuel_ledger')
    .select('id')
    .eq('student_id', studentId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (existing) {
    const { data: state } = await supabase.from('voyage_state').select('total_fuel').eq('student_id', studentId).maybeSingle();
    return { granted: false, amount: 0, multiplier: 1, totalFuel: state?.total_fuel ?? 0, arrivedStars: [], reason: 'already_granted' };
  }

  if (rule?.dailyCap) {
    const { count } = await supabase
      .from('fuel_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('source_type', sourceType)
      .eq('earned_on', earnedOn);
    if ((count ?? 0) >= rule.dailyCap) {
      const { data: state } = await supabase.from('voyage_state').select('total_fuel').eq('student_id', studentId).maybeSingle();
      return { granted: false, amount: 0, multiplier: 1, totalFuel: state?.total_fuel ?? 0, arrivedStars: [], reason: 'daily_cap' };
    }
  }

  await supabase.from('voyage_state').upsert({ student_id: studentId }, { onConflict: 'student_id', ignoreDuplicates: true });
  const { data: state, error: stateError } = await supabase
    .from('voyage_state')
    .select('total_fuel,current_star,ship_tier,streak_days,last_active_on')
    .eq('student_id', studentId)
    .single();
  if (stateError || !state) throw stateError ?? new Error('항해 상태를 불러오지 못했습니다.');

  const streakDays = isRevoke ? state.streak_days : updateStreak(state.last_active_on, state.streak_days, earnedOn);
  const multiplier = options?.applyBooster === false || isRevoke ? 1 : multiplierFor(streakDays);
  const amount = isRevoke ? -Math.abs(baseAmount) : Math.floor(baseAmount * multiplier);
  const totalFuel = Math.max(0, state.total_fuel + amount);

  const { error: ledgerError } = await supabase.from('fuel_ledger').insert({
    student_id: studentId,
    source_type: sourceType,
    source_id: sourceId,
    base_amount: baseAmount,
    multiplier,
    amount: totalFuel - state.total_fuel,
    earned_on: earnedOn,
    note: options?.note ?? null,
  });
  if (ledgerError) {
    if (ledgerError.code === '23505') {
      return { granted: false, amount: 0, multiplier, totalFuel: state.total_fuel, arrivedStars: [], reason: 'already_granted' };
    }
    throw ledgerError;
  }

  const { data: starsData, error: starsError } = await supabase
    .from('stars')
    .select('level,name,emoji,fuel_threshold,reward_ship_tier,reward_title,fact')
    .lte('fuel_threshold', totalFuel)
    .gt('level', state.current_star)
    .order('level');
  if (starsError) throw starsError;

  const arrivedStars = (starsData ?? []) as VoyageStar[];
  let currentStar = state.current_star;
  let shipTier = state.ship_tier;
  for (const star of arrivedStars) {
    currentStar = Math.max(currentStar, star.level);
    shipTier = Math.max(shipTier, star.reward_ship_tier ?? 1);
    await supabase.from('star_arrivals').upsert(
      { student_id: studentId, star_level: star.level },
      { onConflict: 'student_id,star_level', ignoreDuplicates: true },
    );
  }

  await supabase.from('voyage_state').update({
    total_fuel: totalFuel,
    current_star: currentStar,
    ship_tier: shipTier,
    streak_days: streakDays,
    last_active_on: isRevoke ? state.last_active_on : earnedOn,
    updated_at: new Date().toISOString(),
  }).eq('student_id', studentId);

  return { granted: true, amount: totalFuel - state.total_fuel, multiplier, totalFuel, arrivedStars };
}

export async function grantBadgeFuel(
  supabase: SupabaseClient,
  studentId: string,
  badges: Array<{ badge: { id: string } }>,
) {
  for (const awarded of badges) {
    await grantFuel(supabase, studentId, 'badge', awarded.badge.id, { applyBooster: true });
  }
}

export const isQualityContent = (content: string, minChars: number) => {
  const compact = content.trim().replace(/\s/g, '');
  return compact.length >= minChars && !/(.)\1{4,}/u.test(compact);
};

