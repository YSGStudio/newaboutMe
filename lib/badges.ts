import { SupabaseClient } from '@supabase/supabase-js';
import { todayDate, formatDateInSeoul } from '@/lib/date';
import { EMOTION_META } from '@/types/domain';
import type { EmotionType } from '@/types/domain';

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

export type ClassTitleSetting = { tier: number; name: string; threshold: number };

export function getTitleByBadgeCount(count: number, classTitles?: ClassTitleSetting[]): string {
  if (classTitles && classTitles.length > 0) {
    const sorted = [...classTitles].sort((a, b) => b.threshold - a.threshold);
    const match = sorted.find((s) => count >= s.threshold);
    return match?.name ?? sorted[sorted.length - 1].name;
  }
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
  enabledBadgeIds?: Set<string>,
  classTitles?: ClassTitleSetting[],
): Promise<void> {
  const allBadgeIds = enabledBadgeIds
    ? BADGES.filter((b) => enabledBadgeIds.has(b.id)).map((b) => b.id)
    : BADGES.map((b) => b.id);
  await awardBadgeList(supabase, studentId, allBadgeIds, classTitles);
}

async function awardBadgeList(
  supabase: SupabaseClient,
  studentId: string,
  badgeIds: string[],
  classTitles?: ClassTitleSetting[],
): Promise<AwardedBadge[]> {
  // 이미 획득한 뱃지 목록 + 학생 현재 badge_count 조회
  const [{ data: earned }, { data: studentRow }] = await Promise.all([
    supabase.from('student_badges').select('badge_id').eq('student_id', studentId),
    supabase.from('students').select('badge_count').eq('id', studentId).single(),
  ]);

  const earnedSet = new Set((earned ?? []).map((r: { badge_id: string }) => r.badge_id));
  const remaining = badgeIds.filter((id) => !earnedSet.has(id));
  if (remaining.length === 0) return [];

  // 검사 대상 뱃지가 필요로 하는 데이터만 일괄 로드한 뒤 조건은 메모리에서 판정
  const stats = await loadBadgeStats(supabase, studentId, remaining);

  let currentCount: number = studentRow?.badge_count ?? 0;
  const newlyAwarded: AwardedBadge[] = [];

  for (const badgeId of remaining) {
    if (!checkCondition(stats, badgeId)) continue;

    const { error: insertError } = await supabase
      .from('student_badges')
      .insert({ student_id: studentId, badge_id: badgeId });

    if (insertError) {
      console.error(`[badges] ${badgeId} insert 실패:`, insertError.message);
      continue;
    }

    currentCount += 1;
    const newTitle = getTitleByBadgeCount(currentCount, classTitles);
    const prevTitle = getTitleByBadgeCount(currentCount - 1, classTitles);

    newlyAwarded.push({
      badge: BADGE_MAP[badgeId],
      newTitle: newTitle !== prevTitle ? newTitle : null,
    });
  }

  if (newlyAwarded.length > 0) {
    await supabase
      .from('students')
      .update({ badge_count: currentCount, title: getTitleByBadgeCount(currentCount, classTitles) })
      .eq('id', studentId);
  }

  return newlyAwarded;
}

export async function checkAndAwardBadge(
  supabase: SupabaseClient,
  studentId: string,
  trigger: BadgeTrigger,
  enabledBadgeIds?: Set<string>,
  classTitles?: ClassTitleSetting[],
): Promise<AwardedBadge[]> {
  const ids = enabledBadgeIds
    ? TRIGGER_BADGE_IDS[trigger].filter((id) => enabledBadgeIds.has(id))
    : TRIGGER_BADGE_IDS[trigger];
  return awardBadgeList(supabase, studentId, ids, classTitles);
}

type BadgeStats = {
  emotion: { total: number; typeCount: number; categoryCount: number; recordedDates: Set<string> } | null;
  plans: { perfectDays: number; checkedAllDays: number; anyCompleted: boolean; todayPerfect: boolean } | null;
  reflectionCount: number | null;
  letterCount: number | null;
};

// 검사할 뱃지들이 필요로 하는 테이블만 골라 각 1회씩 조회한다.
// (기존에는 뱃지마다 개별 쿼리를 날려 요청당 최대 15~20 쿼리가 발생했음)
async function loadBadgeStats(
  supabase: SupabaseClient,
  studentId: string,
  badgeIds: string[],
): Promise<BadgeStats> {
  const needsEmotion = badgeIds.some((id) => id.startsWith('emotion_') || id === 'plan_perfect_day');
  const needsPlans = badgeIds.some((id) => id.startsWith('plan_'));
  const needsReflection = badgeIds.some((id) => id.startsWith('reflection_'));
  const needsLetters = badgeIds.some((id) => id.startsWith('letter_'));

  const [emotionRes, plansRes, reflectionRes, letterRes] = await Promise.all([
    needsEmotion
      ? supabase.from('emotion_feeds').select('emotion_type,created_at').eq('student_id', studentId)
      : Promise.resolve(null),
    needsPlans
      ? supabase.from('plans').select('id').eq('student_id', studentId).eq('is_active', true)
      : Promise.resolve(null),
    needsReflection
      ? supabase.from('eval_reflections').select('id', { count: 'exact', head: true }).eq('student_id', studentId)
      : Promise.resolve(null),
    needsLetters
      ? supabase.from('letters').select('id', { count: 'exact', head: true }).eq('sender_id', studentId)
      : Promise.resolve(null),
  ]);

  let emotion: BadgeStats['emotion'] = null;
  if (emotionRes) {
    const rows = (emotionRes.data ?? []) as { emotion_type: string; created_at: string }[];
    const types = new Set<string>();
    const categories = new Set<string>();
    const recordedDates = new Set<string>();
    for (const row of rows) {
      types.add(row.emotion_type);
      const category = EMOTION_META[row.emotion_type as EmotionType]?.category;
      if (category) categories.add(category);
      recordedDates.add(formatDateInSeoul(new Date(row.created_at)));
    }
    emotion = { total: rows.length, typeCount: types.size, categoryCount: categories.size, recordedDates };
  }

  let plans: BadgeStats['plans'] = null;
  if (plansRes) {
    const planIds = ((plansRes.data ?? []) as { id: string }[]).map((p) => p.id);
    if (planIds.length === 0) {
      plans = { perfectDays: 0, checkedAllDays: 0, anyCompleted: false, todayPerfect: false };
    } else {
      const { data: checks } = await supabase
        .from('plan_checks')
        .select('plan_id,check_date,is_completed')
        .in('plan_id', planIds);

      const byDate = new Map<string, { total: number; completed: number; plans: Set<string> }>();
      let anyCompleted = false;
      for (const c of (checks ?? []) as { plan_id: string; check_date: string; is_completed: boolean }[]) {
        const entry = byDate.get(c.check_date) ?? { total: 0, completed: 0, plans: new Set<string>() };
        entry.total += 1;
        entry.plans.add(c.plan_id);
        if (c.is_completed) {
          entry.completed += 1;
          anyCompleted = true;
        }
        byDate.set(c.check_date, entry);
      }

      let perfectDays = 0;
      let checkedAllDays = 0;
      for (const entry of byDate.values()) {
        if (entry.total > 0 && entry.total === entry.completed) perfectDays += 1;
        if (entry.plans.size >= planIds.length) checkedAllDays += 1;
      }

      const todayEntry = byDate.get(todayDate());
      const todayPerfect = Boolean(
        todayEntry && todayEntry.plans.size >= planIds.length && todayEntry.total === todayEntry.completed
      );

      plans = { perfectDays, checkedAllDays, anyCompleted, todayPerfect };
    }
  }

  return {
    emotion,
    plans,
    reflectionCount: reflectionRes ? reflectionRes.count ?? 0 : null,
    letterCount: letterRes ? letterRes.count ?? 0 : null,
  };
}

// 오늘 포함 최근 7일의 KST 날짜 문자열 목록
function last7SeoulDates(): string[] {
  return Array.from({ length: 7 }, (_, i) => formatDateInSeoul(new Date(Date.now() - i * 86400000)));
}

function checkCondition(stats: BadgeStats, badgeId: string): boolean {
  switch (badgeId) {
    // ── 감정 기록 ──────────────────────────────────────────
    case 'emotion_first':
      return (stats.emotion?.total ?? 0) >= 1;
    case 'emotion_10':
      return (stats.emotion?.total ?? 0) >= 10;
    case 'emotion_30':
      return (stats.emotion?.total ?? 0) >= 30;
    case 'emotion_100':
      return (stats.emotion?.total ?? 0) >= 100;
    case 'emotion_7days': {
      const recorded = stats.emotion?.recordedDates;
      if (!recorded) return false;
      return last7SeoulDates().every((date) => recorded.has(date));
    }
    case 'emotion_rainbow':
      return (stats.emotion?.categoryCount ?? 0) >= 6;
    case 'emotion_10types':
      return (stats.emotion?.typeCount ?? 0) >= 10;

    // ── 계획 관리 ──────────────────────────────────────────
    case 'plan_first':
      return stats.plans?.anyCompleted ?? false;
    case 'plan_perfect_1':
      return (stats.plans?.perfectDays ?? 0) >= 1;
    case 'plan_perfect_5':
      return (stats.plans?.perfectDays ?? 0) >= 5;
    case 'plan_perfect_30':
      return (stats.plans?.perfectDays ?? 0) >= 30;
    case 'plan_check_100':
      return (stats.plans?.checkedAllDays ?? 0) >= 100;
    case 'plan_perfect_day': {
      const recordedToday = stats.emotion?.recordedDates.has(todayDate()) ?? false;
      return recordedToday && (stats.plans?.todayPerfect ?? false);
    }

    // ── 성찰일기 ──────────────────────────────────────────
    case 'reflection_first':
      return (stats.reflectionCount ?? 0) >= 1;
    case 'reflection_5':
      return (stats.reflectionCount ?? 0) >= 5;
    case 'reflection_10':
      return (stats.reflectionCount ?? 0) >= 10;
    case 'reflection_20':
      return (stats.reflectionCount ?? 0) >= 20;

    // ── 클래스메일 ──────────────────────────────────────────
    case 'letter_first':
      return (stats.letterCount ?? 0) >= 1;
    case 'letter_10':
      return (stats.letterCount ?? 0) >= 10;
    case 'letter_20':
      return (stats.letterCount ?? 0) >= 20;

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

