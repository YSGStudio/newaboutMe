import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const schema = z.object({
  classId: z.string().uuid(),
  badges: z.array(z.object({
    badgeId: z.string().min(1),
    isEnabled: z.boolean(),
  })),
});

export async function PUT(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { classId, badges } = parsed.data;

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  const rows = badges.map((b) => ({
    class_id: classId,
    badge_id: b.badgeId,
    is_enabled: b.isEnabled,
  }));

  const { error } = await supabaseAdmin
    .from('class_badge_settings')
    .upsert(rows, { onConflict: 'class_id,badge_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
