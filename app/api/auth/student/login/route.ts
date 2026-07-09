import { NextResponse } from 'next/server';
import { createStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentLoginSchema } from '@/lib/validators';
import { verifyPassword } from '@/lib/password';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = studentLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const classCode = parsed.data.classCode.trim();

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id,class_name,class_code,letters_enabled')
    .eq('class_code', classCode)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: '학급코드를 확인해주세요.' }, { status: 401 });
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,password_hash')
    .eq('class_id', classRow.id)
    .eq('name', parsed.data.name);

  if (!student || student.length === 0) {
    return NextResponse.json({ error: '이름을 확인해주세요.' }, { status: 401 });
  }

  if (student.length > 1) {
    return NextResponse.json({ error: '동명이인이 있어 로그인할 수 없습니다. 교사에게 문의하세요.' }, { status: 409 });
  }

  const matchedStudent = student[0];

  const passwordOk = await verifyPassword(parsed.data.password, matchedStudent.password_hash);
  if (!passwordOk) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  await createStudentSession(matchedStudent.id);

  return NextResponse.json({
    ok: true,
    student: { id: matchedStudent.id, name: matchedStudent.name, studentNumber: matchedStudent.student_number },
    class: { id: classRow.id, className: classRow.class_name, classCode: classRow.class_code, lettersEnabled: classRow.letters_enabled }
  });
}
