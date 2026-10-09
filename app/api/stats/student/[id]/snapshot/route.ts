import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate } from '@/lib/stats';
import { EMOTION_TYPES } from '@/types/domain';

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.id);
  if ('error' in owned) return owned.error;
  const student = owned.student;

  const url = new URL(req.url);
  const period = isPeriod(url.searchParams.get('period')) ? (url.searchParams.get('period') as 'week' | 'month' | 'semester') : 'month';
  const range = getPeriodRange(period);

  const { data: feeds, error: feedError } = await supabaseAdmin
    .from('emotion_feeds')
    .select('emotion_type')
    .eq('student_id', params.id)
    .eq('is_visible', true)
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .limit(1000);

  if (feedError) return NextResponse.json({ error: feedError.message }, { status: 500 });

  const totalFeeds = (feeds ?? []).length;
  const emotionCounts = new Map<string, number>();
  EMOTION_TYPES.forEach((emotion) => emotionCounts.set(emotion, 0));

  (feeds ?? []).forEach((feed) => {
    emotionCounts.set(feed.emotion_type, (emotionCounts.get(feed.emotion_type) ?? 0) + 1);
  });

  return NextResponse.json({
    range,
    student: {
      id: student.id,
      name: student.name,
      studentNumber: student.student_number
    },
    emotions: {
      totalFeeds,
      distribution: EMOTION_TYPES.map((emotionType) => ({
        emotionType,
        count: emotionCounts.get(emotionType) ?? 0,
        ratio: safeRate(emotionCounts.get(emotionType) ?? 0, totalFeeds)
      }))
    }
  });
}
