import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { planCheckSchema } from '@/lib/validators';
import { todayDate } from '@/lib/utils';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = planCheckSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('id,student_id,is_active')
    .eq('id', params.id)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });
  }

  const date = todayDate();

  const { data, error } = await supabaseAdmin
    .from('plan_checks')
    .upsert(
      {
        plan_id: params.id,
        check_date: date,
        is_completed: parsed.data.isCompleted,
        checked_at: parsed.data.isCompleted === true ? new Date().toISOString() : null
      },
      { onConflict: 'plan_id,check_date' }
    )
    .select('id,plan_id,check_date,is_completed,checked_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ check: data });
}
