import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data: letters, error } = await supabaseAdmin
    .from('letters')
    .select('id, title, created_at, recipient_id')
    .eq('sender_id', auth.student.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = letters ?? [];
  const recipientIds = [...new Set(rows.map((l) => l.recipient_id))];

  const { data: recipients } = recipientIds.length
    ? await supabaseAdmin.from('students').select('id, name, student_number').in('id', recipientIds)
    : { data: [] };

  const recipientMap = new Map((recipients ?? []).map((s) => [s.id, s]));
  const enriched = rows.map((l) => ({ ...l, recipient: recipientMap.get(l.recipient_id) ?? null }));

  return NextResponse.json({ letters: enriched });
}
