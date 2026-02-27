import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { classCreateSchema } from '@/lib/validators';
import { randomCode } from '@/lib/utils';

export async function GET() {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id,class_name,grade,section,class_code,created_at')
    .eq('teacher_id', auth.teacher.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = classCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let classCode = randomCode();
  for (let i = 0; i < 5; i += 1) {
    const { data: exists } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('class_code', classCode)
      .maybeSingle();
    if (!exists) break;
    classCode = randomCode();
  }

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({
      teacher_id: auth.teacher.id,
      class_name: parsed.data.className,
      grade: parsed.data.grade,
      section: parsed.data.section,
      class_code: classCode
    })
    .select('id,class_name,grade,section,class_code,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ class: data }, { status: 201 });
}
