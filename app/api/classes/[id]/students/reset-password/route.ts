import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword, DEFAULT_STUDENT_PASSWORD } from '@/lib/password';

type Params = { params: { id: string } };

export async function POST(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const forbidden = await requireTeacherClass(auth.teacher.id, params.id);
  if (forbidden) return forbidden;

  const { data, error } = await supabaseAdmin
    .from('students')
    .update({ password_hash: await hashPassword(DEFAULT_STUDENT_PASSWORD) })
    .eq('class_id', params.id)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: data?.length ?? 0 });
}
