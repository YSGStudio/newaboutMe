import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate } from '@/lib/stats';
import { EMOTION_TYPES } from '@/types/domain';

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const forbidden = await requireTeacherClass(auth.teacher.id, params.id);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const period = isPeriod(url.searchParams.get('period')) ? (url.searchParams.get('period') as 'week' | 'month' | 'semester') : 'month';
  const range = getPeriodRange(period);

  const { data, error } = await supabaseAdmin
    .from('emotion_feeds')
    .select('emotion_type,students!inner(class_id)')
    .eq('students.class_id', params.id)
    .eq('is_visible', true)
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalFeeds = (data ?? []).length;
  const counts = new Map<string, number>();
  EMOTION_TYPES.forEach((emotion) => counts.set(emotion, 0));

  (data ?? []).forEach((item) => {
    counts.set(item.emotion_type, (counts.get(item.emotion_type) ?? 0) + 1);
  });

  return NextResponse.json({
    range,
    totalFeeds,
    distribution: EMOTION_TYPES.map((emotionType) => ({
      emotionType,
      count: counts.get(emotionType) ?? 0,
      ratio: safeRate(counts.get(emotionType) ?? 0, totalFeeds)
    }))
  });
}
