import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { planCreateSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = planCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('plans')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', auth.student.id)
    .eq('is_active', true);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: '계획은 최대 5개까지 등록할 수 있습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('plans')
    .insert({ student_id: auth.student.id, title: parsed.data.title })
    .select('id,title,is_active,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data }, { status: 201 });
}
