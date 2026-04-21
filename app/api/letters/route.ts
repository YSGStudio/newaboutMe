import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';

const letterCreateSchema = z.object({
  recipientId: z.string().uuid(),
  title: z.string().min(1).max(50),
  content: z.string().min(1).max(1000),
});

export async function POST(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = letterCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { recipientId, title, content } = parsed.data;

  if (recipientId === auth.student.id) {
    return NextResponse.json({ error: '자신에게는 편지를 보낼 수 없습니다.' }, { status: 400 });
  }

  const { data: recipient } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', recipientId)
    .eq('class_id', auth.student.class_id)
    .maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: '같은 학급 학생에게만 편지를 보낼 수 있습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('letters')
    .insert({
      class_id: auth.student.class_id,
      sender_id: auth.student.id,
      recipient_id: recipientId,
      title: title.trim(),
      content: content.trim(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ letter: data }, { status: 201 });
}
