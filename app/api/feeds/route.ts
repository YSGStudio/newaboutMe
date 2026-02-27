import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { feedCreateSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = feedCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('emotion_feeds')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', auth.student.id)
    .gte('created_at', todayStart.toISOString());

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: '하루 최대 3개의 피드만 작성할 수 있습니다.' }, { status: 400 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feed: data }, { status: 201 });
}
