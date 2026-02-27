import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reactionSchema } from '@/lib/validators';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: feed } = await supabaseAdmin
    .from('emotion_feeds')
    .select('id,student_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!feed) {
    return NextResponse.json({ error: '피드를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: feedStudent } = await supabaseAdmin
    .from('students')
    .select('class_id')
    .eq('id', feed.student_id)
    .maybeSingle();

  if (!feedStudent) {
    return NextResponse.json({ error: '피드 작성자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const feedClassId = feedStudent.class_id;
  if (feedClassId !== auth.student.class_id) {
    return NextResponse.json({ error: '같은 반 피드에만 반응할 수 있습니다.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('feed_reactions').upsert(
    {
      feed_id: params.id,
      student_id: auth.student.id,
      reaction_type: parsed.data.reactionType
    },
    { onConflict: 'feed_id,student_id' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
