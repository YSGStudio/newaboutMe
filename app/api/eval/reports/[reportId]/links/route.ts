import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

type Params = { params: { reportId: string } };

const schema = z.object({
  url: z.string().max(2000).transform((v) => {
    const s = v.trim();
    if (s && !/^https?:\/\//i.test(s)) return `https://${s}`;
    return s;
  }).refine((v) => {
    try { new URL(v); return true; } catch { return false; }
  }, { message: '올바른 URL을 입력하세요.' }),
  label: z.string().max(100).optional().nullable(),
});

export async function POST(req: Request, { params }: Params) {
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

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { count } = await supabaseAdmin
    .from('eval_report_links')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', params.reportId);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: '링크는 최대 10개까지 추가할 수 있습니다.' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('eval_report_links')
    .insert({ report_id: params.reportId, url: parsed.data.url, label: parsed.data.label ?? null, sort_order: count ?? 0 })
    .select('id,url,label,sort_order')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data }, { status: 201 });
}
