import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacher } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  // Verify class belongs to this teacher
  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  const { data: letters, error } = await supabaseAdmin
    .from('letters')
    .select('id, title, content, is_read, created_at, updated_at, sender_id, recipient_id')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = letters ?? [];

  // Gather all unique student IDs (senders + recipients)
  const studentIds = [...new Set([...rows.map((l) => l.sender_id), ...rows.map((l) => l.recipient_id)])];

  const { data: students } = studentIds.length
    ? await supabaseAdmin.from('students').select('id, name, student_number').in('id', studentIds)
    : { data: [] };

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  const enriched = rows.map((l) => ({
    ...l,
    sender: studentMap.get(l.sender_id) ?? null,
    recipient: studentMap.get(l.recipient_id) ?? null,
  }));

  return NextResponse.json({ letters: enriched });
}
