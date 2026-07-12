import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { studentPasswordChangeSchema } from '@/lib/validators';
import { hashPassword } from '@/lib/password';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = studentPasswordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const owned = await requireTeacherStudent(auth.teacher.id, params.id);
  if ('error' in owned) return owned.error;

  const { error: updateError } = await supabaseAdmin
    .from('students')
    .update({ password_hash: await hashPassword(parsed.data.password) })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
