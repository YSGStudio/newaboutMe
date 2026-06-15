import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const schema = z.object({
  classId: z.string().uuid(),
  titles: z.array(z.object({
    tier: z.number().int().min(1).max(5),
    name: z.string().min(1).max(30),
    threshold: z.number().int().min(0),
  })).length(5),
});

export async function PUT(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { classId, titles } = parsed.data;

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();
  if (!cls) return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });

  const rows = titles.map((t) => ({
    class_id: classId,
    tier: t.tier,
    name: t.name,
    threshold: t.threshold,
  }));

  await supabaseAdmin.from('class_title_settings').delete().eq('class_id', classId);
  const { error } = await supabaseAdmin.from('class_title_settings').insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
