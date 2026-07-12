import { NextResponse } from 'next/server';
import { createStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentLoginSchema } from '@/lib/validators';
import { verifyPassword } from '@/lib/password';

// 브루트포스 방어: 연속 실패 시 일정 시간 로그인 잠금
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
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
    .select('id,name,student_number,password_hash,failed_login_attempts,locked_until')
    .eq('class_id', classRow.id)
    .eq('name', parsed.data.name);

  if (!student || student.length === 0) {
    return NextResponse.json({ error: '이름을 확인해주세요.' }, { status: 401 });
  }

  if (student.length > 1) {
    return NextResponse.json({ error: '동명이인이 있어 로그인할 수 없습니다. 교사에게 문의하세요.' }, { status: 409 });
  }

  const matchedStudent = student[0];

  if (matchedStudent.locked_until && new Date(matchedStudent.locked_until).getTime() > Date.now()) {
    const remainMinutes = Math.ceil((new Date(matchedStudent.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `비밀번호를 여러 번 틀려 잠시 잠겼어요. ${remainMinutes}분 후에 다시 시도해주세요.` },
      { status: 429 }
    );
  }

  const passwordOk = await verifyPassword(parsed.data.password, matchedStudent.password_hash);
  if (!passwordOk) {
    const attempts = (matchedStudent.failed_login_attempts ?? 0) + 1;
    const willLock = attempts >= MAX_FAILED_ATTEMPTS;
    await supabaseAdmin
      .from('students')
      .update({
        failed_login_attempts: willLock ? 0 : attempts,
        locked_until: willLock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null
      })
      .eq('id', matchedStudent.id);

    if (willLock) {
      return NextResponse.json(
        { error: `비밀번호를 ${MAX_FAILED_ATTEMPTS}번 틀려 ${LOCK_MINUTES}분간 잠겼어요. 잠시 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  if ((matchedStudent.failed_login_attempts ?? 0) > 0 || matchedStudent.locked_until) {
    await supabaseAdmin
      .from('students')
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq('id', matchedStudent.id);
  }

  await createStudentSession(matchedStudent.id);

  return NextResponse.json({
    ok: true,
    student: { id: matchedStudent.id, name: matchedStudent.name, studentNumber: matchedStudent.student_number },
    class: { id: classRow.id, className: classRow.class_name, classCode: classRow.class_code, lettersEnabled: classRow.letters_enabled }
  });
}
