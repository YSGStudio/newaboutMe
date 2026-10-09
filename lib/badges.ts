import { SupabaseClient } from '@supabase/supabase-js';
import { formatDateInSeoul } from '@/lib/date';
import { EMOTION_META } from '@/types/domain';
import type { EmotionType } from '@/types/domain';

export type BadgeCategory = 'emotion' | 'plan' | 'reflection' | 'letter';
export type BadgeTrigger = 'emotion_save' | 'reflection_save' | 'mail_send';

export type BadgeDef = {
  id: string;
  name: string;
  icon: string;
  category: BadgeCategory;
  categoryColor: string;
  condition: string;
  /** 더 이상 새로 지급하지 않는 뱃지. 이미 받은 학생의 도감에만 남는다. */
  retired?: boolean;
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
  // 계획 관리 (6개) — 2026-10-09 일일계획 기능을 삭제하면서 지급을 멈췄다(retired).
  // 이미 받은 학생의 도감·뱃지 수·별빛 캐릭터는 그대로 두기 위해 정의는 남긴다.
  { id: 'plan_first',       name: '첫 계획',      icon: '✅', category: 'plan',        categoryColor: '#22c55e', condition: '계획 처음으로 완료', retired: true },
  { id: 'plan_perfect_1',   name: '오늘도 실천',  icon: '🌱', category: 'plan',        categoryColor: '#22c55e', condition: '계획 달성률 100% 처음 달성', retired: true },
  { id: 'plan_perfect_5',   name: '작은 실천가',  icon: '🏅', category: 'plan',        categoryColor: '#22c55e', condition: '계획 달성률 100% 누적 5회', retired: true },
  { id: 'plan_perfect_30',  name: '큰 실천가',    icon: '🏆', category: 'plan',        categoryColor: '#22c55e', condition: '계획 달성률 100% 누적 30일', retired: true },
  { id: 'plan_check_100',   name: '백일의 기적',  icon: '💯', category: 'plan',        categoryColor: '#22c55e', condition: '모든 계획 체크 누적 100일', retired: true },
  { id: 'plan_perfect_day', name: '완벽한 하루',  icon: '🌙', category: 'plan',        categoryColor: '#22c55e', condition: '감정 기록 + 계획 달성률 100%를 같은 날 달성', retired: true },
  // 성찰일기 (4개)
  { id: 'reflection_first', name: '첫 성찰',      icon: '📖', category: 'reflection',  categoryColor: '#3b82f6', condition: '성찰일기 첫 작성' },
  { id: 'reflection_5',     name: '생각하는 아이', icon: '💭', category: 'reflection', categoryColor: '#3b82f6', condition: '성찰일기 누적 5회 작성' },
  { id: 'reflection_10',    name: '깊은 생각',    icon: '🧠', category: 'reflection',  categoryColor: '#3b82f6', condition: '성찰일기 누적 10회 작성' },
  { id: 'reflection_20',    name: '성찰 마스터',  icon: '🪞', category: 'reflection',  categoryColor: '#3b82f6', condition: '성찰일기 누적 20회 작성' },
  // 별빛메일 (3개)
  { id: 'letter_first',     name: '첫 편지',      icon: '💌', category: 'letter',      categoryColor: '#f472b6', condition: '별빛메일 첫 발송' },
  { id: 'letter_10',        name: '따뜻한 마음',  icon: '💛', category: 'letter',      categoryColor: '#f472b6', condition: '별빛메일 누적 10통 발송' },
  { id: 'letter_20',        name: '우리 반 연결고리', icon: '🤝', category: 'letter', categoryColor: '#f472b6', condition: '별빛메일 누적 20통 발송' },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]));

/** 지금 지급 중인 뱃지. 학급 설정·소급 지급·도감의 미획득 목록은 이것만 본다. */
export const ACTIVE_BADGES = BADGES.filter((b) => !b.retired);

const TRIGGER_BADGE_IDS: Record<BadgeTrigger, string[]> = {
  emotion_save:    ['emotion_first', 'emotion_10', 'emotion_30', 'emotion_100', 'emotion_7days', 'emotion_rainbow', 'emotion_10types'],
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
    ? ACTIVE_BADGES.filter((b) => enabledBadgeIds.has(b.id)).map((b) => b.id)
    : ACTIVE_BADGES.map((b) => b.id);
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
  const needsEmotion = badgeIds.some((id) => id.startsWith('emotion_'));
  const needsReflection = badgeIds.some((id) => id.startsWith('reflection_'));
  const needsLetters = badgeIds.some((id) => id.startsWith('letter_'));

  const [emotionRes, reflectionRes, learningReflectionRes, letterRes] = await Promise.all([
    needsEmotion
      ? supabase.from('emotion_feeds').select('emotion_type,created_at').eq('student_id', studentId)
      : Promise.resolve(null),
    // 성찰 횟수는 두 기능을 합쳐 센다.
    // 평가피드백(eval_reflections)은 축소 예정이고, 배움성찰이 그 자리를 이어받는다.
    // 배움성찰은 활동 하나에 질문이 여럿일 수 있으므로 "답을 쓴 제출물 1건"을 1회로 센다.
    needsReflection
      ? supabase.from('eval_reflections').select('id', { count: 'exact', head: true }).eq('student_id', studentId)
      : Promise.resolve(null),
    needsReflection
      ? supabase
          .from('learning_submissions')
          .select('id,learning_submission_answers!inner(id)')
          .eq('student_id', studentId)
          .neq('learning_submission_answers.answer', '')
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

  // 배움성찰은 한 제출물에 답이 여러 개 붙으므로 제출물 id 기준으로 중복을 제거한다.
  const learningReflectionCount = learningReflectionRes
    ? new Set(((learningReflectionRes.data ?? []) as { id: string }[]).map((row) => row.id)).size
    : 0;

  return {
    emotion,
    reflectionCount: reflectionRes || learningReflectionRes
      ? (reflectionRes?.count ?? 0) + learningReflectionCount
      : null,
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

    // ── 성찰일기 ──────────────────────────────────────────
    case 'reflection_first':
      return (stats.reflectionCount ?? 0) >= 1;
    case 'reflection_5':
      return (stats.reflectionCount ?? 0) >= 5;
    case 'reflection_10':
      return (stats.reflectionCount ?? 0) >= 10;
    case 'reflection_20':
      return (stats.reflectionCount ?? 0) >= 20;

    // ── 별빛메일 ──────────────────────────────────────────
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
