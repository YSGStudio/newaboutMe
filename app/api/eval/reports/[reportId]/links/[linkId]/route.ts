import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string; linkId: string } };

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 본인 보고서인지 확인
  const { data: report } = await supabaseAdmin
    .from('eval_reports')
    .select('id')
    .eq('id', params.reportId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('eval_report_links')
    .delete()
    .eq('id', params.linkId)
    .eq('report_id', params.reportId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
