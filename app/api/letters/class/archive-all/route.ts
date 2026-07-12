import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';

export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const classId = body?.classId;
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  const { error } = await supabaseAdmin
    .from('letters')
    .update({ teacher_archived_at: new Date().toISOString() })
    .eq('class_id', classId)
    .is('teacher_archived_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
