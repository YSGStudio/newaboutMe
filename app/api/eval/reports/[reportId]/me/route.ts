import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  // 본인 보고서인지 확인
  const { data: report, error } = await supabaseAdmin
    .from('eval_reports')
    .select('id, title, created_at')
    .eq('id', params.reportId)
    .eq('student_id', auth.student.id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 각 관련 데이터를 별도 쿼리로 조회
  const [items, images, links, reflections, parentComments] = await Promise.all([
    supabaseAdmin
      .from('eval_report_items')
      .select('id, rubric_title_snapshot, rubric_goal_snapshot, rubric_task_snapshot, rubric_level_high_snapshot, rubric_level_mid_snapshot, rubric_level_low_snapshot, criterion_title_snapshot, grade, teacher_feedback, sort_order')
      .eq('report_id', params.reportId)
      .order('sort_order'),
    supabaseAdmin
      .from('eval_report_images')
      .select('id, storage_path, sort_order')
      .eq('report_id', params.reportId)
      .order('sort_order'),
    supabaseAdmin
      .from('eval_report_links')
      .select('id, url, label, sort_order')
      .eq('report_id', params.reportId)
      .order('sort_order'),
    supabaseAdmin
      .from('eval_reflections')
      .select('id, content, created_at')
      .eq('report_id', params.reportId),
    supabaseAdmin
      .from('eval_parent_comments')
      .select('id, content, created_at')
      .eq('report_id', params.reportId),
  ]);

  return NextResponse.json(
    {
      report: {
        ...report,
        eval_report_items: items.data ?? [],
        eval_report_images: images.data ?? [],
        eval_report_links: links.data ?? [],
        eval_reflections: reflections.data ?? [],
        eval_parent_comments: parentComments.data ?? [],
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
