import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const criterionSchema = z.object({
  title: z.string().min(1).max(100),
  levelHigh: z.string().max(200).optional().nullable(),
  levelMid: z.string().max(200).optional().nullable(),
  levelLow: z.string().max(200).optional().nullable(),
});

const rubricSchema = z.object({
  title: z.string().min(1).max(100),
  goal: z.string().max(200).optional().nullable(),
  task: z.string().max(200).optional().nullable(),
  criteria: z.array(criterionSchema).default([]),
});

export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('eval_rubrics')
    .select('id,title,goal,task,criteria,sort_order,created_at')
    .eq('teacher_id', auth.teacher.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rubrics: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = rubricSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { count } = await supabaseAdmin
    .from('eval_rubrics')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', auth.teacher.id)
    .eq('is_active', true);

  const criteria = parsed.data.criteria.map((c) => ({
    title: c.title,
    level_high: c.levelHigh ?? null,
    level_mid: c.levelMid ?? null,
    level_low: c.levelLow ?? null,
  }));

  const { data, error } = await supabaseAdmin
    .from('eval_rubrics')
    .insert({
      teacher_id: auth.teacher.id,
      title: parsed.data.title,
      goal: parsed.data.goal ?? null,
      task: parsed.data.task ?? null,
      criteria,
      sort_order: (count ?? 0),
    })
    .select('id,title,goal,task,criteria,sort_order,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rubric: data }, { status: 201 });
}
