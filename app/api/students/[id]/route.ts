import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.id);
  if ('error' in owned) return owned.error;

  const { error: deleteError } = await supabaseAdmin.from('students').delete().eq('id', params.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
