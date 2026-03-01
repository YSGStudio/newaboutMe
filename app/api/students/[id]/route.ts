import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id,class_id')
    .eq('id', params.id)
    .maybeSingle();

  if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });

  const { data: klass, error: classError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', student.class_id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!klass) return NextResponse.json({ error: '학생 삭제 권한이 없습니다.' }, { status: 403 });

  const { error: deleteError } = await supabaseAdmin.from('students').delete().eq('id', params.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
