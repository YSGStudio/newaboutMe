import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword, DEFAULT_STUDENT_PASSWORD } from '@/lib/password';

type Params = { params: { id: string } };

export async function POST(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: klass, error: classError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!klass) return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('students')
    .update({ password_hash: await hashPassword(DEFAULT_STUDENT_PASSWORD) })
    .eq('class_id', params.id)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: data?.length ?? 0 });
}
