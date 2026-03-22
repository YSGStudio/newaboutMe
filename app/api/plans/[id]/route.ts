import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { planUpdateSchema } from '@/lib/validators';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('id,student_id,title,is_active')
    .eq('id', params.id)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });
  }

  const newTitle = parsed.data.title;
  if (plan.title === newTitle) {
    return NextResponse.json({ plan: { id: plan.id, title: plan.title } });
  }

  await supabaseAdmin
    .from('plan_title_history')
    .insert({ plan_id: plan.id, old_title: plan.title, new_title: newTitle });

  const { data: updated, error } = await supabaseAdmin
    .from('plans')
    .update({ title: newTitle })
    .eq('id', params.id)
    .select('id,title')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: updated });
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('id,student_id,is_active')
    .eq('id', params.id)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('plans')
    .update({ is_active: false })
    .eq('id', params.id)
    .eq('student_id', auth.student.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
