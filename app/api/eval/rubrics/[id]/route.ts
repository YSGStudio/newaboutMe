import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

type Params = { params: { id: string } };

const rubricUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  goal: z.string().max(200).nullable().optional(),
  task: z.string().max(200).nullable().optional(),
  levelHigh: z.string().max(200).nullable().optional(),
  levelMid: z.string().max(200).nullable().optional(),
  levelLow: z.string().max(200).nullable().optional()
});

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = rubricUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.goal !== undefined) update.goal = parsed.data.goal;
  if (parsed.data.task !== undefined) update.task = parsed.data.task;
  if (parsed.data.levelHigh !== undefined) update.level_high = parsed.data.levelHigh;
  if (parsed.data.levelMid !== undefined) update.level_mid = parsed.data.levelMid;
  if (parsed.data.levelLow !== undefined) update.level_low = parsed.data.levelLow;

  const { data, error } = await supabaseAdmin
    .from('eval_rubrics')
    .update(update)
    .eq('id', params.id)
    .eq('teacher_id', auth.teacher.id)
    .select('id,title,goal,task,level_high,level_mid,level_low,sort_order')
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
