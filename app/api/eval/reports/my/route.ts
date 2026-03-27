import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('eval_reports')
    .select(`
      id, title, created_at,
      eval_report_items(id, grade, sort_order),
      eval_report_images(id, sort_order),
      eval_reflections(id),
      eval_parent_comments(id)
    `)
    .eq('student_id', auth.student.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}
