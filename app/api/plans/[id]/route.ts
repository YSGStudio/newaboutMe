import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

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
