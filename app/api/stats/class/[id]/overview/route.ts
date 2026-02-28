import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPeriodRange, isPeriod, safeRate } from '@/lib/stats';

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ error: '학급 접근 권한이 없습니다.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const period = isPeriod(url.searchParams.get('period')) ? (url.searchParams.get('period') as 'week' | 'month' | 'semester') : 'month';
  const range = getPeriodRange(period);

  const { data: students, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('class_id', params.id);

  if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) {
    return NextResponse.json({
      range,
      totalStudents: 0,
      totalPlans: 0,
      averageAchievementRate: 0,
      planRanking: []
    });
  }

  const { data: plans, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id,title,student_id')
    .in('student_id', studentIds)
    .eq('is_active', true);

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const planList = plans ?? [];
  const planIds = planList.map((p) => p.id);

  if (planIds.length === 0) {
    return NextResponse.json({
      range,
      totalStudents: studentIds.length,
      totalPlans: 0,
      averageAchievementRate: 0,
      planRanking: []
    });
  }

  const { data: checks, error: checkError } = await supabaseAdmin
    .from('plan_checks')
    .select('plan_id,is_completed,check_date')
    .in('plan_id', planIds)
    .gte('check_date', range.startDate)
    .lte('check_date', range.endDate);

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  const completedByPlan = new Map<string, number>();
  (checks ?? []).forEach((check) => {
    if (!check.is_completed) return;
    completedByPlan.set(check.plan_id, (completedByPlan.get(check.plan_id) ?? 0) + 1);
  });

  const groupByTitle = new Map<string, { planCount: number; completed: number }>();
  planList.forEach((plan) => {
    const current = groupByTitle.get(plan.title) ?? { planCount: 0, completed: 0 };
    current.planCount += 1;
    current.completed += completedByPlan.get(plan.id) ?? 0;
    groupByTitle.set(plan.title, current);
  });

  const planRanking = Array.from(groupByTitle.entries())
    .map(([title, value]) => {
      const totalPossible = value.planCount * range.days;
      return {
        title,
        completed: value.completed,
        totalPossible,
        achievementRate: safeRate(value.completed, totalPossible)
      };
    })
    .sort((a, b) => b.achievementRate - a.achievementRate);

  const totalCompleted = Array.from(completedByPlan.values()).reduce((acc, v) => acc + v, 0);
  const totalPossible = planList.length * range.days;

  return NextResponse.json({
    range,
    totalStudents: studentIds.length,
    totalPlans: planList.length,
    averageAchievementRate: safeRate(totalCompleted, totalPossible),
    planRanking
  });
}
