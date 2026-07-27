import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

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
    },
  });
}
