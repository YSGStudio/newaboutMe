import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate } from '@/lib/stats';

type Params = { params: { id: string } };

const enumerateDates = (startDate: string, endDate: string) => {
  const result: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current.getTime() <= end.getTime()) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    result.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
};

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id,name,classes!inner(teacher_id)')
    .eq('id', params.id)
    .eq('classes.teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: '학생 접근 권한이 없습니다.' }, { status: 403 });

  const url = new URL(req.url);
  const period = isPeriod(url.searchParams.get('period')) ? (url.searchParams.get('period') as 'week' | 'month' | 'semester') : 'month';
  const range = getPeriodRange(period);

  const { data: plans, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id')
    .eq('student_id', params.id)
    .eq('is_active', true);

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const planIds = (plans ?? []).map((p) => p.id);
  const totalPlans = planIds.length;
  if (totalPlans === 0) {
    return NextResponse.json({
      range,
      student: { id: params.id, name: student.name },
      points: enumerateDates(range.startDate, range.endDate).map((date) => ({
        date,
        completed: 0,
        total: 0,
        achievementRate: 0
      }))
    });
  }

  const { data: checks, error: checkError } = await supabaseAdmin
    .from('plan_checks')
    .select('plan_id,is_completed,check_date')
    .in('plan_id', planIds)
    .gte('check_date', range.startDate)
    .lte('check_date', range.endDate)
    .eq('is_completed', true);

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  const completedByDate = new Map<string, number>();
  (checks ?? []).forEach((check) => {
    completedByDate.set(check.check_date, (completedByDate.get(check.check_date) ?? 0) + 1);
  });

  const points = enumerateDates(range.startDate, range.endDate).map((date) => {
    const completed = completedByDate.get(date) ?? 0;
    return {
      date,
      completed,
      total: totalPlans,
      achievementRate: safeRate(completed, totalPlans)
    };
  });

  return NextResponse.json({
    range,
    student: { id: params.id, name: student.name },
    points
  });
}
