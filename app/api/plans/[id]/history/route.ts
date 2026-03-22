import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  // 본인 계획인지 확인
  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('id')
    .eq('id', params.id)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: history, error } = await supabaseAdmin
    .from('plan_title_history')
    .select('id,old_title,new_title,changed_at')
    .eq('plan_id', params.id)
    .order('changed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: history ?? [] });
}
