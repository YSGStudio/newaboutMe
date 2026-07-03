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

/** AI 기능 사용 가능 여부: admin 또는 paid이고 만료일 미경과 */
export function canUseAi(teacher: TeacherProfile): boolean {
  if (teacher.role === 'admin') return true;
  if (teacher.role === 'paid') {
    if (!teacher.paidUntil) return true;
    return teacher.paidUntil >= new Date().toISOString().slice(0, 10);
  }
  return false;
}

export function requireAiAccess(teacher: TeacherProfile): NextResponse | null {
  if (!canUseAi(teacher)) {
    return NextResponse.json(
      { error: '유료회원만 사용 가능한 기능입니다. 관리자에게 문의해주세요.' },
      { status: 403 }
    );
  }
  return null;
}
