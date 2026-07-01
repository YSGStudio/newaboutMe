import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SEOUL_UTC_OFFSET_HOURS } from '@/lib/date';

export async function GET(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? '', 10);
  const month = parseInt(url.searchParams.get('month') ?? '', 10);

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year, month 파라미터가 필요합니다.' }, { status: 400 });
  }

  // Seoul 기준 해당 월의 시작/끝을 UTC ISO로 변환
  const startUtc = new Date(Date.UTC(year, month - 1, 1, -SEOUL_UTC_OFFSET_HOURS, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month, 1, -SEOUL_UTC_OFFSET_HOURS, 0, 0, 0) - 1);

  const { data, error } = await supabaseAdmin
    .from('emotion_feeds')
    .select('id,emotion_type,content,created_at')
    .eq('student_id', auth.student.id)
    .gte('created_at', startUtc.toISOString())
    .lte('created_at', endUtc.toISOString())
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feeds: data ?? [] });
}
