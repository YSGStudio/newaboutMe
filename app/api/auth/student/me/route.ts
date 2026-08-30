import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { isEvalFeedbackClass } from '@/lib/eval-access';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  // 평가피드백은 관리자 학급에만 열려 있다(lib/features.ts).
  const evalFeedbackEnabled = await isEvalFeedbackClass(auth.student.classes.teacher_id);

  return NextResponse.json({
    student: {
      id: auth.student.id,
      name: auth.student.name,
      studentNumber: auth.student.student_number,
    },
    class: {
      id: auth.student.classes.id,
      className: auth.student.classes.class_name,
      classCode: auth.student.classes.class_code,
      lettersEnabled: auth.student.classes.letters_enabled,
      evalFeedbackEnabled,
    },
  });
}
