import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSeoulDayRange, todayDate } from '@/lib/date';
import { feedCreateSchema, feedUpdateSchema } from '@/lib/validators';

export async function GET(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const queryDate = url.searchParams.get('date');
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const targetDate = queryDate && datePattern.test(queryDate) ? queryDate : todayDate();
  const { startIso, endIso } = getSeoulDayRange(targetDate);

  const { data, error } = await supabaseAdmin
    .from('emotion_feeds')
    .select('id,emotion_type,content,image_url,created_at')
    .eq('student_id', auth.student.id)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return serverError(error);
  return NextResponse.json({ feed: data, date: targetDate });
}

export async function POST(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = feedCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { startIso, endIso } = getSeoulDayRange(todayDate());

  const { count } = await supabaseAdmin
    .from('emotion_feeds')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', auth.student.id)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if ((count ?? 0) >= 1) {
    return NextResponse.json({ error: '하루 최대 1개의 피드만 작성할 수 있습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('emotion_feeds')
    .insert({
      student_id: auth.student.id,
      emotion_type: parsed.data.emotionType,
      content: parsed.data.content,
      image_url: parsed.data.imageUrl ?? null
    })
    .select('id,emotion_type,content,image_url,created_at')
    .single();

  if (error) return serverError(error);

  // 저장 성공을 먼저 돌려준다. 뱃지·연료는 클라이언트가 /api/rewards/claim으로
  // 이어서 요청하며, 원장/뱃지 unique 제약 덕분에 재시도해도 중복 지급되지 않는다.
  return NextResponse.json({ feed: data }, { status: 201 });
}

/**
 * 오늘 쓴 감정 기록의 감정과 적은 글을 고칩니다.
 * 대상은 세션 학생의 "오늘(서울 기준)" 기록으로 서버가 직접 찾으므로
 * 지난 날짜나 다른 학생의 기록은 고칠 수 없습니다.
 */
export async function PATCH(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = feedUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { startIso, endIso } = getSeoulDayRange(todayDate());

  const { data: todayFeed, error: findError } = await supabaseAdmin
    .from('emotion_feeds')
    .select('id')
    .eq('student_id', auth.student.id)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return serverError(findError);
  if (!todayFeed) {
    return NextResponse.json({ error: '오늘 쓴 감정 기록만 고칠 수 있어요.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('emotion_feeds')
    .update({ emotion_type: parsed.data.emotionType, content: parsed.data.content })
    .eq('id', todayFeed.id)
    .eq('student_id', auth.student.id)
    .select('id,emotion_type,content,image_url,created_at')
    .single();

  if (error) return serverError(error);
  return NextResponse.json({ feed: data });
}
