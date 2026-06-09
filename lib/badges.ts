import { SupabaseClient } from '@supabase/supabase-js';
import { todayDate, getSeoulDayRange } from '@/lib/date';

export type BadgeCategory = 'emotion' | 'plan' | 'reflection' | 'letter';
export type BadgeTrigger = 'emotion_save' | 'plan_complete' | 'reflection_save' | 'mail_send';

export type BadgeDef = {
  id: string;
  name: string;
  icon: string;
  category: BadgeCategory;
  categoryColor: string;
  condition: string;
};

export const BADGES: BadgeDef[] = [
  // 감정 기록 (6개)
  { id: 'emotion_first',    name: '첫 별빛',     icon: '⭐', category: 'emotion',     categoryColor: '#fbbf24', condition: '감정 기록 첫 1회' },
  { id: 'emotion_10',       name: '감정 탐험가',  icon: '🗺️', category: 'emotion',     categoryColor: '#fbbf24', condition: '감정 기록 누적 10회' },
  { id: 'emotion_30',       name: '감정 수집가',  icon: '🎒', category: 'emotion',     categoryColor: '#fbbf24', condition: '감정 기록 누적 30회' },
  { id: 'emotion_100',      name: '감정 박사',    icon: '🎓', category: 'emotion',     categoryColor: '#fbbf24', condition: '감정 기록 누적 100회' },
  { id: 'emotion_7days',    name: '7일의 기록',   icon: '🔥', category: 'emotion',     categoryColor: '#fbbf24', condition: '7일 연속 감정 기록' },
  { id: 'emotion_rainbow',  name: '감정 무지개',  icon: '🌈', category: 'emotion',     categoryColor: '#fbbf24', condition: '6가지 감정 카테고리 모두 기록' },
  { id: 'emotion_10types',  name: '감정 만물상',  icon: '🎭', category: 'emotion',     categoryColor: '#fbbf24', condition: '10가지 감정 종류 기록' },
  // 계획 관리 (5개)
  { id: 'plan_first',       name: '첫 계획',      icon: '✅', category: 'plan',        categoryColor: '#22c55e', condition: '계획 처음으로 완료' },
  { id: 'plan_perfect_1',   name: '오늘도 실천',  icon: '🌱', category: 'plan',        categoryColor: '#22c55e', condition: '계획 달성률 100% 처음 달성' },
  { id: 'plan_perfect_5',   name: '작은 실천가',  icon: '🏅', category: 'plan',        categoryColor: '#22c55e', condition: '계획 달성률 100% 누적 5회' },
  { id: 'plan_perfect_30',  name: '큰 실천가',    icon: '🏆', category: 'plan',        categoryColor: '#22c55e', condition: '계획 달성률 100% 누적 30일' },
  { id: 'plan_check_100',   name: '백일의 기적',  icon: '💯', category: 'plan',        categoryColor: '#22c55e', condition: '모든 계획 체크 누적 100일' },
  { id: 'plan_perfect_day', name: '완벽한 하루',  icon: '🌙', category: 'plan',        categoryColor: '#22c55e', condition: '감정 기록 + 계획 달성률 100%를 같은 날 달성' },
  // 성찰일기 (4개)
  { id: 'reflection_first', name: '첫 성찰',      icon: '📖', category: 'reflection',  categoryColor: '#3b82f6', condition: '성찰일기 첫 작성' },
  { id: 'reflection_5',     name: '생각하는 아이', icon: '💭', category: 'reflection', categoryColor: '#3b82f6', condition: '성찰일기 누적 5회 작성' },
  { id: 'reflection_10',    name: '깊은 생각',    icon: '🧠', category: 'reflection',  categoryColor: '#3b82f6', condition: '성찰일기 누적 10회 작성' },
  { id: 'reflection_20',    name: '성찰 마스터',  icon: '🪞', category: 'reflection',  categoryColor: '#3b82f6', condition: '성찰일기 누적 20회 작성' },
  // 클래스메일 (3개)
  { id: 'letter_first',     name: '첫 편지',      icon: '💌', category: 'letter',      categoryColor: '#f472b6', condition: '클래스메일 첫 발송' },
  { id: 'letter_10',        name: '따뜻한 마음',  icon: '💛', category: 'letter',      categoryColor: '#f472b6', condition: '클래스메일 누적 10통 발송' },
  { id: 'letter_20',        name: '우리 반 연결고리', icon: '🤝', category: 'letter', categoryColor: '#f472b6', condition: '클래스메일 누적 20통 발송' },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]));

const TRIGGER_BADGE_IDS: Record<BadgeTrigger, string[]> = {
  emotion_save:    ['emotion_first', 'emotion_10', 'emotion_30', 'emotion_100', 'emotion_7days', 'emotion_rainbow', 'emotion_10types', 'plan_perfect_day'],
  plan_complete:   ['plan_first', 'plan_perfect_1', 'plan_perfect_5', 'plan_perfect_30', 'plan_check_100', 'plan_perfect_day'],
  reflection_save: ['reflection_first', 'reflection_5', 'reflection_10', 'reflection_20'],
  mail_send:       ['letter_first', 'letter_10', 'letter_20'],
};

export function getTitleByBadgeCount(count: number): string {
  if (count >= 20) return '별빛 전설';
  if (count >= 15) return '별빛 마스터';
  if (count >= 10) return '별빛 기록자';
  if (count >= 5)  return '별빛 탐험가';
  return '별빛 새싹';
}

export type AwardedBadge = { badge: BadgeDef; newTitle: string | null };

// 기존 데이터를 소급 적용: 모든 뱃지 조건을 한 번에 검사
export async function backfillBadges(
  supabase: SupabaseClient,
  studentId: string,
): Promise<void> {
  const allBadgeIds = BADGES.map((b) => b.id);
  await awardBadgeList(supabase, studentId, allBadgeIds);
}

async function awardBadgeList(
  supabase: SupabaseClient,
  studentId: string,
  badgeIds: string[],
): Promise<AwardedBadge[]> {
  // 이미 획득한 뱃지 목록
  const { data: earned } = await supabase
    .from('student_badges')
    .select('badge_id')
    .eq('student_id', studentId);

  const earnedSet = new Set((earned ?? []).map((r: { badge_id: string }) => r.badge_id));

  // 학생 현재 badge_count 조회
  const { data: studentRow } = await supabase
    .from('students')
    .select('badge_count')
    .eq('id', studentId)
    .single();

  let currentCount: number = studentRow?.badge_count ?? 0;
  const newlyAwarded: AwardedBadge[] = [];

  for (const badgeId of badgeIds) {
    if (earnedSet.has(badgeId)) continue;

    const met = await checkCondition(supabase, studentId, badgeId);
    if (!met) continue;

    const { error: insertError } = await supabase
      .from('student_badges')
      .insert({ student_id: studentId, badge_id: badgeId });

    if (insertError) {
      console.error(`[badges] ${badgeId} insert 실패:`, insertError.message);
      continue;
    }

    currentCount += 1;
    const newTitle = getTitleByBadgeCount(currentCount);
    const prevTitle = getTitleByBadgeCount(currentCount - 1);

    await supabase
      .from('students')
      .update({ badge_count: currentCount, title: newTitle })
      .eq('id', studentId);

    newlyAwarded.push({
      badge: BADGE_MAP[badgeId],
      newTitle: newTitle !== prevTitle ? newTitle : null,
    });
  }

  return newlyAwarded;
}

export async function checkAndAwardBadge(
  supabase: SupabaseClient,
  studentId: string,
  trigger: BadgeTrigger
): Promise<AwardedBadge[]> {
  return awardBadgeList(supabase, studentId, TRIGGER_BADGE_IDS[trigger]);
}

async function checkCondition(
  supabase: SupabaseClient,
  studentId: string,
  badgeId: string
): Promise<boolean> {
  switch (badgeId) {
    // ── 감정 기록 ──────────────────────────────────────────
    case 'emotion_first': {
      const { count } = await supabase
        .from('emotion_feeds')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId);
      return (count ?? 0) >= 1;
    }
    case 'emotion_10':
    case 'emotion_30':
    case 'emotion_100': {
      const threshold = badgeId === 'emotion_10' ? 10 : badgeId === 'emotion_30' ? 30 : 100;
      const { count } = await supabase
        .from('emotion_feeds')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId);
      return (count ?? 0) >= threshold;
    }
    case 'emotion_7days': {
      // 오늘 포함 최근 7일 모두 기록 존재하는지
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        dates.push(kst.toISOString().slice(0, 10));
      }
      const checks = await Promise.all(
        dates.map(async (date) => {
          const { startIso, endIso } = getSeoulDayRange(date);
          const { count } = await supabase
            .from('emotion_feeds')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .gte('created_at', startIso)
            .lte('created_at', endIso);
          return (count ?? 0) > 0;
        })
      );
      return checks.every(Boolean);
    }
    case 'emotion_rainbow': {
      const { data } = await supabase
        .from('emotion_feeds')
        .select('emotion_type')
        .eq('student_id', studentId);
      if (!data) return false;
      // emotion_type → category 매핑은 서버에서 할 수 없으므로 emotion_type 자체로 카테고리 추론
      // 6 카테고리: joy_vitality, affection_bond, anxiety_tension, sadness_lethargy, anger_rejection, social_emotions
      const EMOTION_CATEGORY_MAP: Record<string, string> = {
        moved: 'joy_vitality', joyful: 'joy_vitality', surprised: 'joy_vitality',
        satisfied: 'joy_vitality', fulfilled: 'joy_vitality', refreshed: 'joy_vitality',
        amazed: 'joy_vitality', passionate: 'joy_vitality', excited: 'joy_vitality',
        thankful: 'affection_bond', longing: 'affection_bond', affectionate: 'affection_bond',
        trusting: 'affection_bond', loving: 'affection_bond',
        worried: 'anxiety_tension', curious: 'anxiety_tension', flustered: 'anxiety_tension',
        fearful: 'anxiety_tension', burdened: 'anxiety_tension', anxious: 'anxiety_tension',
        shy: 'anxiety_tension',
        pitiful: 'sadness_lethargy', sad: 'sadness_lethargy', lonely: 'sadness_lethargy',
        lethargic: 'sadness_lethargy', hopeless: 'sadness_lethargy',
        hateful: 'anger_rejection', disappointed: 'anger_rejection', wronged: 'anger_rejection',
        disgusted: 'anger_rejection', angry: 'anger_rejection',
        sorry: 'social_emotions', envious: 'social_emotions', embarrassed: 'social_emotions',
        jealous: 'social_emotions',
      };
      const cats = new Set(data.map((r: { emotion_type: string }) => EMOTION_CATEGORY_MAP[r.emotion_type]).filter(Boolean));
      return cats.size >= 6;
    }
    case 'emotion_10types': {
      const { data } = await supabase
        .from('emotion_feeds')
        .select('emotion_type')
        .eq('student_id', studentId);
      if (!data) return false;
      const types = new Set(data.map((r: { emotion_type: string }) => r.emotion_type));
      return types.size >= 10;
    }

    // ── 계획 관리 ──────────────────────────────────────────
    case 'plan_first': {
      const { data: myPlans } = await supabase
        .from('plans')
        .select('id')
        .eq('student_id', studentId);
      if (!myPlans || myPlans.length === 0) return false;
      const { count } = await supabase
        .from('plan_checks')
        .select('id', { count: 'exact', head: true })
        .eq('is_completed', true)
        .in('plan_id', myPlans.map((p: { id: string }) => p.id));
      return (count ?? 0) >= 1;
    }
    case 'plan_perfect_1':
    case 'plan_perfect_5':
    case 'plan_perfect_30': {
      const threshold = badgeId === 'plan_perfect_1' ? 1 : badgeId === 'plan_perfect_5' ? 5 : 30;
      const perfectDays = await countPerfectPlanDays(supabase, studentId);
      return perfectDays >= threshold;
    }
    case 'plan_check_100': {
      const checkedDays = await countAllCheckedDays(supabase, studentId);
      return checkedDays >= 100;
    }
    case 'plan_perfect_day': {
      const today = todayDate();
      const { startIso, endIso } = getSeoulDayRange(today);
      const { count: emotionCount } = await supabase
        .from('emotion_feeds')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      if ((emotionCount ?? 0) < 1) return false;
      const perfectDays = await countPerfectPlanDays(supabase, studentId);
      // 오늘이 완벽한 날인지 확인
      const todayPerfect = await isTodayPerfect(supabase, studentId);
      return (emotionCount ?? 0) >= 1 && todayPerfect && perfectDays >= 0;
    }

    // ── 성찰일기 ──────────────────────────────────────────
    case 'reflection_first': {
      const { count } = await supabase
        .from('eval_reflections')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId);
      return (count ?? 0) >= 1;
    }
    case 'reflection_5':
    case 'reflection_10':
    case 'reflection_20': {
      const threshold = badgeId === 'reflection_5' ? 5 : badgeId === 'reflection_10' ? 10 : 20;
      const { count } = await supabase
        .from('eval_reflections')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId);
      return (count ?? 0) >= threshold;
    }

    // ── 클래스메일 ──────────────────────────────────────────
    case 'letter_first': {
      const { count } = await supabase
        .from('letters')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', studentId);
      return (count ?? 0) >= 1;
    }
    case 'letter_10':
    case 'letter_20': {
      const threshold = badgeId === 'letter_10' ? 10 : 20;
      const { count } = await supabase
        .from('letters')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', studentId);
      return (count ?? 0) >= threshold;
    }

    default:
      return false;
  }
}

export async function countPerfectPlanDays(supabase: SupabaseClient, studentId: string): Promise<number> {
  // plan_checks에서 해당 학생의 날짜별 전체/완료 개수를 집계해 100% 달성 날짜 수 반환
  const { data: plans } = await supabase
    .from('plans')
    .select('id')
    .eq('student_id', studentId)
    .eq('is_active', true);

  if (!plans || plans.length === 0) return 0;

  const planIds = plans.map((p: { id: string }) => p.id);

  const { data: checks } = await supabase
    .from('plan_checks')
    .select('check_date, is_completed')
    .in('plan_id', planIds);

  if (!checks || checks.length === 0) return 0;

  // 날짜별로 그룹핑
  const dateMap = new Map<string, { total: number; completed: number }>();
  for (const c of checks) {
    const entry = dateMap.get(c.check_date) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (c.is_completed) entry.completed += 1;
    dateMap.set(c.check_date, entry);
  }

  let perfectCount = 0;
  for (const { total, completed } of dateMap.values()) {
    if (total > 0 && total === completed) perfectCount += 1;
  }
  return perfectCount;
}

export async function countAllCheckedDays(supabase: SupabaseClient, studentId: string): Promise<number> {
  const { data: plans } = await supabase
    .from('plans')
    .select('id')
    .eq('student_id', studentId)
    .eq('is_active', true);

  if (!plans || plans.length === 0) return 0;
  const planIds = plans.map((p: { id: string }) => p.id);
  const totalPlans = planIds.length;

  const { data: checks } = await supabase
    .from('plan_checks')
    .select('check_date, plan_id')
    .in('plan_id', planIds);

  if (!checks || checks.length === 0) return 0;

  const dateMap = new Map<string, Set<string>>();
  for (const c of checks) {
    if (!dateMap.has(c.check_date)) dateMap.set(c.check_date, new Set());
    dateMap.get(c.check_date)!.add(c.plan_id);
  }

  let count = 0;
  for (const planSet of dateMap.values()) {
    if (planSet.size >= totalPlans) count++;
  }
  return count;
}

async function isTodayPerfect(supabase: SupabaseClient, studentId: string): Promise<boolean> {
  const today = todayDate();

  const { data: plans } = await supabase
    .from('plans')
    .select('id')
    .eq('student_id', studentId)
    .eq('is_active', true);

  if (!plans || plans.length === 0) return false;

  const planIds = plans.map((p: { id: string }) => p.id);

  const { data: checks } = await supabase
    .from('plan_checks')
    .select('is_completed')
    .in('plan_id', planIds)
    .eq('check_date', today);

  if (!checks || checks.length === 0 || checks.length < plans.length) return false;
  return checks.every((c: { is_completed: boolean }) => c.is_completed === true);
}
