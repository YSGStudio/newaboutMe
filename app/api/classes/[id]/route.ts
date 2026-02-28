import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
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

  const { error } = await supabaseAdmin.from('classes').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
