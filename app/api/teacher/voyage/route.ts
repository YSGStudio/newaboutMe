import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStars } from '@/lib/voyage';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: '학급을 선택해주세요.' }, { status: 400 });
  const denied = await requireTeacherClass(auth.teacher.id, classId);
  if (denied) return denied;

  const [{ data: students, error }, stars] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id,name,student_number,voyage_state(total_fuel,current_star,ship_tier,streak_days,last_active_on)')
      .eq('class_id', classId)
      .order('student_number'),
    getStars(supabaseAdmin),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: students ?? [], stars });
}

