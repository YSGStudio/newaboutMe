import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacher } from '@/lib/auth';

export async function PATCH(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const classId = body?.classId;
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('letters')
    .update({ teacher_archived_at: new Date().toISOString() })
    .eq('class_id', classId)
    .is('teacher_archived_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
