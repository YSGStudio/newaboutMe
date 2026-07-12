import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { safeRate } from '@/lib/stats';
import { todayDate, getSeoulDayRange } from '@/lib/date';
import { EMOTION_TYPES } from '@/types/domain';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const endDate = todayDate();
  const monthStart = `${endDate.slice(0, 7)}-01`;
  // 날짜 문자열을 UTC로 그대로 해석하면 서울 자정(UTC+9) 근처 기록이 하루씩 밀린다 — 서울 기준 하루 경계로 변환
  const { startIso } = getSeoulDayRange(monthStart);
  const { endIso } = getSeoulDayRange(endDate);

  const { data: feeds, error } = await supabaseAdmin
    .from('emotion_feeds')
    .select('emotion_type')
    .eq('student_id', auth.student.id)
    .eq('is_visible', true)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalFeeds = (feeds ?? []).length;
  const emotionCounts = new Map<string, number>();
  EMOTION_TYPES.forEach((e) => emotionCounts.set(e, 0));
  (feeds ?? []).forEach((feed) => {
    emotionCounts.set(feed.emotion_type, (emotionCounts.get(feed.emotion_type) ?? 0) + 1);
  });

  return NextResponse.json({
    range: { startDate: monthStart, endDate },
    totalFeeds,
    distribution: EMOTION_TYPES.map((emotionType) => ({
      emotionType,
      count: emotionCounts.get(emotionType) ?? 0,
      ratio: safeRate(emotionCounts.get(emotionType) ?? 0, totalFeeds)
    }))
  });
}
