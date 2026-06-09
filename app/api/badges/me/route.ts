import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BADGES, backfillBadges, countPerfectPlanDays } from '@/lib/badges';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const sid = auth.student.id;

  // 기존 데이터 소급 적용: 18개 미만이면 항상 전체 조건 재검사 (이미 획득한 뱃지는 내부에서 skip)
  const { count: earnedCount, error: countError } = await supabaseAdmin
    .from('student_badges')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', sid);

  if (countError) {
    console.error('[badges/me] student_badges 조회 실패 (마이그레이션 미적용 가능성):', countError.message);
  }

  if ((earnedCount ?? 0) < BADGES.length) {
    await backfillBadges(supabaseAdmin, sid);
  }

  const [
    earnedRows,
    studentRow,
    emotionResult,
    reflectionResult,
    letterResult,
    perfectDays,
  ] = await Promise.all([
    supabaseAdmin.from('student_badges').select('badge_id, earned_at').eq('student_id', sid),
    supabaseAdmin.from('students').select('badge_count, title').eq('id', sid).single(),
    supabaseAdmin.from('emotion_feeds').select('id', { count: 'exact', head: true }).eq('student_id', sid),
    supabaseAdmin.from('eval_reflections').select('id', { count: 'exact', head: true }).eq('student_id', sid),
    supabaseAdmin.from('letters').select('id', { count: 'exact', head: true }).eq('sender_id', sid),
    countPerfectPlanDays(supabaseAdmin, sid),
  ]);

  const earnedMap = new Map(
    (earnedRows.data ?? []).map((r: { badge_id: string; earned_at: string }) => [r.badge_id, r.earned_at])
  );

  const badges = BADGES.map((b) => ({
    ...b,
    earned: earnedMap.has(b.id),
    earnedAt: earnedMap.get(b.id) ?? null,
  }));

  return NextResponse.json({
    badges,
    badgeCount: studentRow.data?.badge_count ?? 0,
    title: studentRow.data?.title ?? '별빛 새싹',
    stats: {
      emotionCount:    emotionResult.count    ?? 0,
      perfectPlanDays: perfectDays,
      reflectionCount: reflectionResult.count ?? 0,
      letterSentCount: letterResult.count     ?? 0,
    },
  });
}
