import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type TeacherRole = 'general' | 'paid' | 'admin';

export type TeacherProfile = {
  id: string;
  name: string;
  role: TeacherRole;
  paidUntil: string | null;
};

export async function requireTeacher() {
  const supabase = await createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('teacher_profiles')
    .select('id,name,role,paid_until')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return { error: NextResponse.json({ error: 'Teacher profile not found' }, { status: 403 }) };
  }

  const teacher: TeacherProfile = {
    id: profile.id,
    name: profile.name,
    role: (profile.role ?? 'general') as TeacherRole,
    paidUntil: profile.paid_until ?? null,
  };

  return { user, teacher };
}

/** 교사가 해당 학급의 담당자인지 확인. 아니면 403 응답을 반환한다. */
export async function requireTeacherClass(teacherId: string, classId: string): Promise<NextResponse | null> {
  const { data } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });
  }
  return null;
}

export type OwnedStudent = {
  id: string;
  name: string;
  student_number: number;
  class_id: string;
};

/** 교사가 해당 학생 소속 학급의 담당자인지 확인. 통과 시 학생 기본 정보를 반환한다. */
export async function requireTeacherStudent(teacherId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,class_id,classes!inner(teacher_id)')
    .eq('id', studentId)
    .eq('classes.teacher_id', teacherId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!data) {
    return { error: NextResponse.json({ error: '학생 접근 권한이 없습니다.' }, { status: 403 }) };
  }

  const student: OwnedStudent = {
    id: data.id,
    name: data.name,
    student_number: data.student_number,
    class_id: data.class_id
  };
  return { student };
}

/** AI 기능 사용 가능 여부: admin 또는 paid이고 만료일 미경과 */
export function canUseAi(teacher: TeacherProfile): boolean {
  if (teacher.role === 'admin') return true;
  if (teacher.role === 'paid') {
    if (!teacher.paidUntil) return true;
    return teacher.paidUntil >= new Date().toISOString().slice(0, 10);
  }
  return false;
}

/** 유효한 유료 플랜(또는 관리자) 여부 — 다중 학급, AI 월 한도 등급 결정 등에 사용 */
export const hasActivePaidPlan = canUseAi;
