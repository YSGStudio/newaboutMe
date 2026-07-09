import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentPasswordChangeSchema } from '@/lib/validators';
import { hashPassword } from '@/lib/password';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = studentPasswordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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
  if (!klass) return NextResponse.json({ error: '비밀번호 변경 권한이 없습니다.' }, { status: 403 });

  const { error: updateError } = await supabaseAdmin
    .from('students')
    .update({ password_hash: await hashPassword(parsed.data.password) })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
