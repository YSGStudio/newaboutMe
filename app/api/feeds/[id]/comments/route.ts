import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { teacherCommentSchema } from '@/lib/validators';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = teacherCommentSchema.safeParse(body);
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

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('class_id')
    .eq('id', feed.student_id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: '피드 작성자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', student.class_id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: '해당 학급 피드에 댓글 권한이 없습니다.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_comments')
    .insert({
      teacher_id: auth.teacher.id,
      feed_id: params.id,
      content: parsed.data.content
    })
    .select('id,teacher_id,feed_id,content,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data }, { status: 201 });
}
