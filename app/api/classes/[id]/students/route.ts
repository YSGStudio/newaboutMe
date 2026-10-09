import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentCreateSchema } from '@/lib/validators';
import { hashPassword, DEFAULT_STUDENT_PASSWORD } from '@/lib/password';

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const forbidden = await requireTeacherClass(auth.teacher.id, params.id);
  if (forbidden) return forbidden;

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,created_at')
    .eq('class_id', params.id)
    .order('student_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data ?? [] });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const forbidden = await requireTeacherClass(auth.teacher.id, params.id);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({
      class_id: params.id,
      name: parsed.data.name,
      student_number: parsed.data.studentNumber,
      password_hash: await hashPassword(DEFAULT_STUDENT_PASSWORD)
    })
    .select('id,name,student_number,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ student: data }, { status: 201 });
}
