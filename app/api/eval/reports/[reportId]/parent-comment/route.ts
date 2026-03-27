import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

type Params = { params: { reportId: string } };

const schema = z.object({ content: z.string().min(1).max(300) });

export async function POST(req: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  // 본인 보고서인지 확인
  const { data: report } = await supabaseAdmin
    .from('eval_reports')
    .select('id')
    .eq('id', params.reportId)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });

  // 이미 작성했는지 확인
  const { data: existing } = await supabaseAdmin
    .from('eval_parent_comments')
    .select('id')
    .eq('report_id', params.reportId)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: '부모님 응원은 한 번만 작성할 수 있습니다.' }, { status: 409 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('eval_parent_comments')
    .insert({ report_id: params.reportId, content: parsed.data.content })
    .select('id,content,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ parentComment: data }, { status: 201 });
}
