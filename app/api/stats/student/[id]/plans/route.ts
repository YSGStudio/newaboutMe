import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate } from '@/lib/stats';

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id,name,class_id,classes!inner(teacher_id)')
    .eq('id', params.id)
    .eq('classes.teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: '학생 접근 권한이 없습니다.' }, { status: 403 });

  const url = new URL(req.url);
  const period = isPeriod(url.searchParams.get('period')) ? (url.searchParams.get('period') as 'week' | 'month' | 'semester') : 'month';
  const range = getPeriodRange(period);

  const { data: plans, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id,title')
    .eq('student_id', params.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length === 0) {
    return NextResponse.json({
      range,
      student: { id: params.id, name: student.name },
      plans: []
    });
  }

  const { data: checks, error: checkError } = await supabaseAdmin
    .from('plan_checks')
    .select('plan_id,is_completed,check_date')
    .in('plan_id', planIds)
    .gte('check_date', range.startDate)
    .lte('check_date', range.endDate);

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  const completedMap = new Map<string, number>();
  (checks ?? []).forEach((check) => {
    if (!check.is_completed) return;
    completedMap.set(check.plan_id, (completedMap.get(check.plan_id) ?? 0) + 1);
  });

  return NextResponse.json({
    range,
    student: { id: params.id, name: student.name },
    plans: (plans ?? []).map((plan) => {
      const completed = completedMap.get(plan.id) ?? 0;
      const totalPossible = range.days;
      return {
        planId: plan.id,
        title: plan.title,
        completed,
        totalPossible,
        achievementRate: safeRate(completed, totalPossible)
      };
    })
  });
}
