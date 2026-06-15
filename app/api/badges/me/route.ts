import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BADGES, backfillBadges, countPerfectPlanDays, ClassTitleSetting } from '@/lib/badges';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const sid = auth.student.id;

  // 학급 설정 조회 (class_badge_settings, class_title_settings)
  const { data: studentRow0 } = await supabaseAdmin
    .from('students')
    .select('class_id')
    .eq('id', sid)
    .single();

  const classId: string | null = studentRow0?.class_id ?? null;

  let enabledBadgeIds: Set<string> | undefined;
  let classTitles: ClassTitleSetting[] | undefined;

  if (classId) {
    const [{ data: badgeRows }, { data: titleRows }] = await Promise.all([
      supabaseAdmin.from('class_badge_settings').select('badge_id,is_enabled').eq('class_id', classId),
      supabaseAdmin.from('class_title_settings').select('tier,name,threshold').eq('class_id', classId).order('tier'),
    ]);

    if (badgeRows && badgeRows.length > 0) {
      enabledBadgeIds = new Set(
        badgeRows.filter((r: { badge_id: string; is_enabled: boolean }) => r.is_enabled).map((r: { badge_id: string }) => r.badge_id)
      );
    }
    if (titleRows && titleRows.length === 5) {
      classTitles = titleRows as ClassTitleSetting[];
    }
  }

  // 소급 적용: 미획득 뱃지가 있으면 전체 조건 재검사
  const { count: earnedCount, error: countError } = await supabaseAdmin
    .from('student_badges')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', sid);

  if (countError) {
    console.error('[badges/me] student_badges 조회 실패 (마이그레이션 미적용 가능성):', countError.message);
  }

  const totalEnabled = enabledBadgeIds ? enabledBadgeIds.size : BADGES.length;
  if ((earnedCount ?? 0) < totalEnabled) {
    await backfillBadges(supabaseAdmin, sid, enabledBadgeIds, classTitles);
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
    isEnabled: enabledBadgeIds ? enabledBadgeIds.has(b.id) : true,
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
