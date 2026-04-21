import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';
import { requireTeacher } from '@/lib/auth';

const letterUpdateSchema = z.object({
  title: z.string().min(1).max(50).optional(),
  content: z.string().min(1).max(1000).optional(),
}).refine((d) => d.title !== undefined || d.content !== undefined, {
  message: 'title 또는 content 중 하나 이상 필요합니다.',
});

// GET — 학생(발신자/수신자) 또는 교사가 편지 상세 조회
// 수신자가 열람하면 is_read = true 처리
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 학생 세션 시도
  const studentAuth = await requireStudentSession();
  if (!('error' in studentAuth)) {
    const { data: letter, error } = await supabaseAdmin
      .from('letters')
      .select('id, title, content, is_read, created_at, updated_at, sender_id, recipient_id')
      .eq('id', id)
      .maybeSingle();

    if (error || !letter) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });

    const isSender = letter.sender_id === studentAuth.student.id;
    const isRecipient = letter.recipient_id === studentAuth.student.id;
    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 수신자가 처음 열람하는 경우 읽음 처리
    if (isRecipient && !letter.is_read) {
      await supabaseAdmin.from('letters').update({ is_read: true }).eq('id', id);
    }

    const [{ data: sender }, { data: recipient }] = await Promise.all([
      supabaseAdmin.from('students').select('id, name, student_number').eq('id', letter.sender_id).maybeSingle(),
      supabaseAdmin.from('students').select('id, name, student_number').eq('id', letter.recipient_id).maybeSingle(),
    ]);

    return NextResponse.json({ letter: { ...letter, is_read: isRecipient ? true : letter.is_read, sender, recipient } });
  }

  // 교사 세션 시도
  const teacherAuth = await requireTeacher();
  if ('error' in teacherAuth) return teacherAuth.error;

  const { data: letter, error } = await supabaseAdmin
    .from('letters')
    .select('id, title, content, is_read, created_at, updated_at, sender_id, recipient_id, class_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !letter) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });

  // 교사 소속 학급 확인
  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', letter.class_id)
    .eq('teacher_id', teacherAuth.teacher.id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: sender }, { data: recipient }] = await Promise.all([
    supabaseAdmin.from('students').select('id, name, student_number').eq('id', letter.sender_id).maybeSingle(),
    supabaseAdmin.from('students').select('id, name, student_number').eq('id', letter.recipient_id).maybeSingle(),
  ]);

  return NextResponse.json({ letter: { ...letter, sender, recipient } });
}

// PATCH — 교사만 수정
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = letterUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // 교사 소속 학급 확인
  const { data: letter } = await supabaseAdmin
    .from('letters')
    .select('class_id')
    .eq('id', id)
    .maybeSingle();

  if (!letter) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', letter.class_id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
  if (parsed.data.content !== undefined) updates.content = parsed.data.content.trim();

  const { data, error } = await supabaseAdmin
    .from('letters')
    .update(updates)
    .eq('id', id)
    .select('id, title, content, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ letter: data });
}

// DELETE — 교사만 삭제
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: letter } = await supabaseAdmin
    .from('letters')
    .select('class_id')
    .eq('id', id)
    .maybeSingle();

  if (!letter) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', letter.class_id)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('letters').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
