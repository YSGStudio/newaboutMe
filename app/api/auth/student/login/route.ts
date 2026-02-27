import { NextResponse } from 'next/server';
import { createStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentLoginSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = studentLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const classCode = parsed.data.classCode.toUpperCase();

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id,class_name,class_code')
    .eq('class_code', classCode)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: '학급코드를 확인해주세요.' }, { status: 401 });
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,pin_code')
    .eq('class_id', classRow.id)
    .eq('student_number', parsed.data.studentNumber)
    .maybeSingle();

  if (!student || student.pin_code !== parsed.data.pinCode) {
    return NextResponse.json({ error: '학생 번호 또는 PIN이 올바르지 않습니다.' }, { status: 401 });
  }

  await createStudentSession(student.id);

  return NextResponse.json({
    ok: true,
    student: { id: student.id, name: student.name, studentNumber: student.student_number },
    class: { id: classRow.id, className: classRow.class_name, classCode: classRow.class_code }
  });
}
