import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { studentId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, classes!inner(teacher_id)')
    .eq('id', params.studentId)
    .maybeSingle();

  if (!student || (student.classes as unknown as { teacher_id: string }).teacher_id !== auth.teacher.id) {
    return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('eval_reports')
    .select('id,title,created_at, eval_report_items(id,grade,sort_order), eval_report_images(id,sort_order), eval_report_links(id), eval_reflections(id), eval_parent_comments(id)')
    .eq('student_id', params.studentId)
    .eq('teacher_id', auth.teacher.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}
