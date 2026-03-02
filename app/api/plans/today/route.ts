import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/utils';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const date = todayDate();

  const { data: plans, error } = await supabaseAdmin
    .from('plans')
    .select('id,title,is_active,created_at,plan_checks(id,is_completed,check_date,checked_at)')
    .eq('student_id', auth.student.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (plans ?? []).map((plan) => {
    const todayCheck = (plan.plan_checks ?? []).find((check) => check.check_date === date);
    const isCompleted = typeof todayCheck?.is_completed === 'boolean' ? todayCheck.is_completed : null;
    return {
      id: plan.id,
      title: plan.title,
      isCompleted,
      checkedAt: todayCheck?.checked_at ?? null
    };
  });

  const completed = normalized.filter((p) => p.isCompleted === true).length;
  const total = normalized.length;

  return NextResponse.json({
    date,
    plans: normalized,
    summary: {
      completed,
      total,
      achievementRate: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  });
}
