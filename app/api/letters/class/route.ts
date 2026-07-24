import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  // includeArchived=true면 교사가 읽음처리한 편지까지 함께 반환한다.
  // (교사 화면에서 지난 편지까지 검색할 수 있도록 하기 위함)
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  let query = supabaseAdmin
    .from('letters')
    .select('id, title, content, is_read, created_at, updated_at, sender_id, recipient_id, teacher_archived_at')
    .eq('class_id', classId);

  if (!includeArchived) query = query.is('teacher_archived_at', null);

  const { data: letters, error } = await query.order('created_at', { ascending: false });

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
