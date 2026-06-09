import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BADGES } from '@/lib/badges';
import { countPerfectPlanDays } from '@/lib/badges';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const sid = auth.student.id;

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
