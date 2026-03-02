import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/utils';
import { studentCreateSchema } from '@/lib/validators';

type Params = { params: { id: string } };

async function ensureTeacherClass(teacherId: string, classId: string) {
  const { data } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .maybeSingle();

  return Boolean(data);
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const allowed = await ensureTeacherClass(auth.teacher.id, params.id);
  if (!allowed) return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number,created_at')
    .eq('class_id', params.id)
    .order('student_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const students = data ?? [];
  if (students.length === 0) return NextResponse.json({ students: [] });

  const studentIds = students.map((student) => student.id);
  const today = todayDate();

  const { data: plans, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id,student_id')
    .in('student_id', studentIds)
    .eq('is_active', true);

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const planRows = plans ?? [];
  const totalByStudent = new Map<string, number>();
  const planToStudent = new Map<string, string>();

  planRows.forEach((plan) => {
    totalByStudent.set(plan.student_id, (totalByStudent.get(plan.student_id) ?? 0) + 1);
    planToStudent.set(plan.id, plan.student_id);
  });

  const planIds = planRows.map((plan) => plan.id);
  const completedByStudent = new Map<string, number>();

  if (planIds.length > 0) {
    const { data: checks, error: checkError } = await supabaseAdmin
      .from('plan_checks')
      .select('plan_id')
      .in('plan_id', planIds)
      .eq('check_date', today)
      .eq('is_completed', true);

    if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

    (checks ?? []).forEach((check) => {
      const studentId = planToStudent.get(check.plan_id);
      if (!studentId) return;
      completedByStudent.set(studentId, (completedByStudent.get(studentId) ?? 0) + 1);
    });
  }

  return NextResponse.json({
    students: students.map((student) => {
      const todayTotal = totalByStudent.get(student.id) ?? 0;
      const todayCompleted = completedByStudent.get(student.id) ?? 0;
      const todayAchievementRate = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
      return {
        ...student,
        todayCompleted,
        todayTotal,
        todayAchievementRate,
        isTodayAllCompleted: todayTotal > 0 && todayCompleted === todayTotal
      };
    })
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const allowed = await ensureTeacherClass(auth.teacher.id, params.id);
  if (!allowed) return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });

  const body = await req.json();
  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({
      class_id: params.id,
      name: parsed.data.name,
      student_number: parsed.data.studentNumber
    })
    .select('id,name,student_number,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ student: data }, { status: 201 });
}
