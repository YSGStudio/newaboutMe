import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { countWeekdaysBetweenInclusive, safeRate } from '@/lib/stats';
import { todayDate } from '@/lib/utils';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const endDate = todayDate();
  const monthStart = `${endDate.slice(0, 7)}-01`;

  const { data: plans, error: planError } = await supabaseAdmin
    .from('plans')
    .select('id,title,created_at')
    .eq('student_id', auth.student.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const planIds = (plans ?? []).map((plan) => plan.id);
  if (planIds.length === 0) {
    return NextResponse.json({
      range: { startDate: monthStart, endDate },
      plans: []
    });
  }

  const { data: checks, error: checkError } = await supabaseAdmin
    .from('plan_checks')
    .select('plan_id,is_completed,check_date')
    .in('plan_id', planIds)
    .eq('is_completed', true)
    .gte('check_date', monthStart)
    .lte('check_date', endDate);

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  const completedByPlan = new Map<string, number>();
  (checks ?? []).forEach((check) => {
    completedByPlan.set(check.plan_id, (completedByPlan.get(check.plan_id) ?? 0) + 1);
  });

  const result = (plans ?? []).map((plan) => {
    const planStart = plan.created_at.slice(0, 10) > monthStart ? plan.created_at.slice(0, 10) : monthStart;
    const totalPossible = countWeekdaysBetweenInclusive(planStart, endDate);
    const completed = completedByPlan.get(plan.id) ?? 0;
    return {
      planId: plan.id,
      title: plan.title,
      completed,
      totalPossible,
      achievementRate: safeRate(completed, totalPossible)
    };
  });

  return NextResponse.json({
    range: { startDate: monthStart, endDate },
    plans: result
  });
}
