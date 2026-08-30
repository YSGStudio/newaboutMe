import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { canSeeEvalFeedback } from '@/lib/features';
import type { TeacherProfile } from '@/lib/auth';

/**
 * 평가피드백 접근 판단 (서버).
 *
 * 평가피드백은 관리자 계정과 그 관리자가 담임인 학급의 학생에게만 열려 있습니다(lib/features.ts).
 * 화면에서 탭을 감추는 것만으로는 라우트가 막히지 않으므로, app/api/eval/** 에서 이 함수로
 * 같은 조건을 다시 확인합니다.
 */

/** 교사가 평가피드백을 쓸 수 있는지. 아니면 403 응답을 반환한다. */
export function denyEvalTeacher(teacher: TeacherProfile): NextResponse | null {
  if (canSeeEvalFeedback(teacher.role)) return null;
  return NextResponse.json({ error: '평가피드백을 사용할 수 없는 계정입니다.' }, { status: 403 });
}

/** 학급 담임이 평가피드백을 쓸 수 있는 계정인지 — 학생 쪽 판단에 쓴다. */
export async function isEvalFeedbackClass(teacherId: string | null | undefined): Promise<boolean> {
  if (!teacherId) return false;

  const { data: profile } = await supabaseAdmin
    .from('teacher_profiles')
    .select('role')
    .eq('id', teacherId)
    .maybeSingle();

  return canSeeEvalFeedback(profile?.role ?? null);
}

/** 학생이 평가피드백을 볼 수 있는지. 아니면 403 응답을 반환한다. */
export async function denyEvalStudent(teacherId: string | null | undefined): Promise<NextResponse | null> {
  if (await isEvalFeedbackClass(teacherId)) return null;
  return NextResponse.json({ error: '평가기록을 볼 수 없습니다.' }, { status: 403 });
}
