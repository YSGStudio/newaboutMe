import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

type Params = { params: { id: string } };

const linkUrlSchema = z.string().max(2000).transform((v) => {
  const s = v.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}).refine((v) => {
  if (!v) return true;
  try { new URL(v); return true; } catch { return false; }
}, { message: '올바른 URL을 입력하세요.' });

const rubricUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  subject: z.string().max(30).nullable().optional(),
  goal: z.string().max(200).nullable().optional(),
  task: z.string().max(200).nullable().optional(),
  criteria: z.array(z.object({
    title: z.string().min(1).max(100),
    levelHigh: z.string().max(200).nullable().optional(),
    levelMid: z.string().max(200).nullable().optional(),
    levelLow: z.string().max(200).nullable().optional(),
  })).optional(),
  linkUrl: linkUrlSchema.nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = rubricUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.subject !== undefined) update.subject = parsed.data.subject;
  if (parsed.data.goal !== undefined) update.goal = parsed.data.goal;
  if (parsed.data.task !== undefined) update.task = parsed.data.task;
  if (parsed.data.criteria !== undefined) {
    update.criteria = parsed.data.criteria.map((c) => ({
      title: c.title,
      level_high: c.levelHigh ?? null,
      level_mid: c.levelMid ?? null,
      level_low: c.levelLow ?? null,
    }));
  }
  if (parsed.data.linkUrl !== undefined) update.link_url = parsed.data.linkUrl || null;

  const { data, error } = await supabaseAdmin
    .from('eval_rubrics')
    .update(update)
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id)
    .select('id,title,subject,goal,task,criteria,sort_order,link_url')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rubric: data });
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { error } = await supabaseAdmin
    .from('eval_rubrics')
    .update({ is_active: false })
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
