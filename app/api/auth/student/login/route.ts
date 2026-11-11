import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { createStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentLoginSchema } from '@/lib/validators';
import { verifyPassword } from '@/lib/password';
import { isEvalFeedbackClass } from '@/lib/eval-access';

// 브루트포스 방어: 연속 실패 시 일정 시간 로그인 잠금
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

// 학급코드·이름·비밀번호 중 무엇이 틀렸는지 알려 주면 학급코드와 학생 이름을 하나씩 맞춰 볼 수 있다.
// 그래서 셋 다 같은 문구로 답한다.
const LOGIN_FAILED = '학급코드, 이름, 비밀번호를 다시 확인해 주세요.';

function lockedResponse(lockedUntil: string) {
  const remainMinutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  return NextResponse.json(
    { error: `비밀번호를 여러 번 틀려 잠시 잠겼어요. ${remainMinutes}분 후에 다시 시도해 주세요.` },
    { status: 429 }
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = studentLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const classCode = parsed.data.classCode.trim();

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id,class_name,class_code,letters_enabled,teacher_id')
    .eq('class_code', classCode)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 401 });
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,password_hash,failed_login_attempts,locked_until')
    .eq('class_id', classRow.id)
    .eq('name', parsed.data.name);

  if (!student || student.length === 0) {
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 401 });
  }

  if (student.length > 1) {
    return NextResponse.json({ error: '동명이인이 있어 로그인할 수 없습니다. 교사에게 문의하세요.' }, { status: 409 });
  }

  const matchedStudent = student[0];

  // 비밀번호를 확인하기 전에 시도 한 번을 DB에서 원자적으로 차감한다.
  // 읽고 +1 해서 다시 쓰면 동시에 보낸 요청들이 같은 값을 읽어 잠금 한도를 넘길 수 있다.
  // 행이 없으면 지금 잠겨 있는 것이다(20261111_security_hardening.sql).
  const { data: attemptRows, error: attemptError } = await supabaseAdmin.rpc('student_login_attempt', {
    p_student: matchedStudent.id,
    p_max: MAX_FAILED_ATTEMPTS,
    p_lock_minutes: LOCK_MINUTES
  });
  if (attemptError) return serverError(attemptError);

  const attempt = (attemptRows as { attempts: number; locked: boolean; locked_until: string | null }[] | null)?.[0];
  if (!attempt) {
    return lockedResponse(matchedStudent.locked_until ?? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString());
  }

  const passwordOk = await verifyPassword(parsed.data.password, matchedStudent.password_hash);
  if (!passwordOk) {
    if (attempt.locked) {
      return NextResponse.json(
        { error: `비밀번호를 ${MAX_FAILED_ATTEMPTS}번 틀려 ${LOCK_MINUTES}분간 잠겼어요. 잠시 후 다시 시도해 주세요.` },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 401 });
  }

  // 성공하면 이번 시도로 쌓인 횟수와(한도에 닿아 걸렸을 수 있는) 잠금을 함께 푼다.
  if (attempt.attempts > 0 || attempt.locked) {
    await supabaseAdmin
      .from('students')
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq('id', matchedStudent.id);
  }

  await createStudentSession(matchedStudent.id);

  // 평가피드백은 관리자 학급에만 열려 있다(lib/features.ts).
  const evalFeedbackEnabled = await isEvalFeedbackClass(classRow.teacher_id);

  return NextResponse.json({
    ok: true,
    student: { id: matchedStudent.id, name: matchedStudent.name, studentNumber: matchedStudent.student_number },
    class: {
      id: classRow.id,
      className: classRow.class_name,
      classCode: classRow.class_code,
      lettersEnabled: classRow.letters_enabled,
      evalFeedbackEnabled
    }
  });
}
