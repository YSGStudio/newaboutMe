/**
 * 모둠 프로젝트 인증 어댑터.
 * 교사(Supabase Auth)와 학생(자체 쿠키 세션)을 Actor 하나로 합친다.
 *
 * 한 브라우저에 두 세션이 함께 있을 수 있어서 화면이 X-GP-Actor 헤더로 쓸 세션을 고른다.
 * 서버는 고른 세션을 그대로 검증하므로 헤더 값 자체는 아무 권한도 주지 않는다.
 */
import 'server-only';
import type { NextResponse } from 'next/server';
import { requireTeacher, type TeacherProfile } from '@/lib/auth';
import { requireStudentSession } from '@/lib/student-session';

export type Actor =
  | { kind: 'teacher'; id: string; name: string; profile: TeacherProfile }
  | { kind: 'student'; id: string; name: string; classId: string };

export const ACTOR_HEADER = 'x-gp-actor';

async function teacherActor(): Promise<{ actor: Actor } | { error: NextResponse }> {
  const auth = await requireTeacher();
  if ('error' in auth) return { error: auth.error as NextResponse };
  return { actor: { kind: 'teacher', id: auth.teacher.id, name: auth.teacher.name, profile: auth.teacher } };
}

async function studentActor(): Promise<{ actor: Actor } | { error: NextResponse }> {
  const auth = await requireStudentSession();
  if ('error' in auth) return { error: auth.error as NextResponse };
  return { actor: { kind: 'student', id: auth.student.id, name: auth.student.name, classId: auth.student.class_id } };
}

export async function requireActor(req: Request): Promise<{ actor: Actor } | { error: NextResponse }> {
  const wanted = req.headers.get(ACTOR_HEADER);
  if (wanted === 'teacher') return teacherActor();
  if (wanted === 'student') return studentActor();

  // 헤더가 없으면 있는 세션을 쓴다(화면은 항상 헤더를 보낸다).
  const teacher = await teacherActor();
  if ('actor' in teacher) return teacher;
  const student = await studentActor();
  return 'actor' in student ? student : teacher;
}

/** 작성자 쌍 컬럼 값을 만든다. 예: actorColumns(actor, 'created_by') */
export function actorColumns<P extends string>(actor: Actor, prefix: P) {
  return {
    [`${prefix}_teacher_id`]: actor.kind === 'teacher' ? actor.id : null,
    [`${prefix}_student_id`]: actor.kind === 'student' ? actor.id : null,
  } as Record<`${P}_teacher_id` | `${P}_student_id`, string | null>;
}
