import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

type Params = { params: { reportId: string } };

const schema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    grade: z.enum(['high', 'mid', 'low']),
    teacherFeedback: z.string().max(200).nullable().optional(),
  })).min(1),
});

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

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

  const results = await Promise.all(
    parsed.data.items.map((item) =>
      supabaseAdmin
        .from('eval_report_items')
        .update({ grade: item.grade, teacher_feedback: item.teacherFeedback ?? null })
        .eq('id', item.id)
        .eq('report_id', params.reportId)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
