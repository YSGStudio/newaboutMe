import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('eval_reports')
    .select(`
      id, title, created_at,
      eval_report_items(id, rubric_title_snapshot, rubric_goal_snapshot, rubric_task_snapshot, rubric_level_high_snapshot, rubric_level_mid_snapshot, rubric_level_low_snapshot, grade, teacher_feedback, sort_order),
      eval_report_images(id, sort_order),
      eval_reflections(id, content, created_at),
      eval_parent_comments(id, content, created_at)
    `)
    .eq('id', params.reportId)
    .eq('student_id', auth.student.id)
    .single();

  if (error) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ report: data });
}
