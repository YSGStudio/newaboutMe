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

  const { data: reports, error } = await supabaseAdmin
    .from('eval_reports')
    .select('id, title, created_at, eval_report_items(id, grade, sort_order), eval_report_images(id, sort_order), eval_report_links(id)')
    .eq('student_id', params.studentId)
    .eq('teacher_id', auth.teacher.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reports || reports.length === 0) return NextResponse.json({ reports: [] });

  const reportIds = reports.map((r) => r.id);

  const [reflectionsRes, parentCommentsRes] = await Promise.all([
    supabaseAdmin.from('eval_reflections').select('report_id').in('report_id', reportIds),
    supabaseAdmin.from('eval_parent_comments').select('report_id').in('report_id', reportIds),
  ]);

  const hasReflection = new Set((reflectionsRes.data ?? []).map((r) => r.report_id));
  const hasParentComment = new Set((parentCommentsRes.data ?? []).map((r) => r.report_id));

  const enriched = reports.map((r) => ({
    ...r,
    eval_reflections: hasReflection.has(r.id) ? [{ id: 'exists' }] : [],
    eval_parent_comments: hasParentComment.has(r.id) ? [{ id: 'exists' }] : [],
  }));

  return NextResponse.json({ reports: enriched });
}
