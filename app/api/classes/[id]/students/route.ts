import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { randomPin } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentCreateSchema } from '@/lib/validators';

type Params = { params: { id: string } };

async function ensureTeacherClass(teacherId: string, classId: string) {
  const { data } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .maybeSingle();

  return Boolean(data);
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const allowed = await ensureTeacherClass(auth.teacher.id, params.id);
  if (!allowed) return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,pin_code,created_at')
    .eq('class_id', params.id)
    .order('student_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const allowed = await ensureTeacherClass(auth.teacher.id, params.id);
  if (!allowed) return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });

  const body = await req.json();
  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pinCode = parsed.data.pinCode ?? randomPin();

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({
      class_id: params.id,
      name: parsed.data.name,
      student_number: parsed.data.studentNumber,
      pin_code: pinCode
    })
    .select('id,name,student_number,pin_code,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ student: data }, { status: 201 });
}
