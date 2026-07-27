import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
  const limit = 20;
  const { data, error, count } = await supabaseAdmin
    .from('fuel_ledger')
    .select('*', { count: 'exact' })
    .eq('student_id', auth.student.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [], nextOffset: offset + (data?.length ?? 0), hasMore: offset + limit < (count ?? 0) });
}

