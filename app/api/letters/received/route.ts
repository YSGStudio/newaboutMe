import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data: letters, error } = await supabaseAdmin
    .from('letters')
    .select('id, title, is_read, created_at, sender_id')
    .eq('recipient_id', auth.student.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = letters ?? [];
  const senderIds = [...new Set(rows.map((l) => l.sender_id))];

  const { data: senders } = senderIds.length
    ? await supabaseAdmin.from('students').select('id, name, student_number').in('id', senderIds)
    : { data: [] };

  const senderMap = new Map((senders ?? []).map((s) => [s.id, s]));
  const enriched = rows.map((l) => ({ ...l, sender: senderMap.get(l.sender_id) ?? null }));

  return NextResponse.json({ letters: enriched });
}
