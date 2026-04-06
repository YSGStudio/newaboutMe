import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 본인 보고서인지 확인
  const { data: report, error } = await supabaseAdmin
    .from('eval_reports')
    .select('id, title, created_at, student_id')
    .eq('id', params.reportId)
    .eq('teacher_id', auth.teacher.id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  }

  const [student, items, images, links, reflections, parentComments] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id, name, student_number')
      .eq('id', report.student_id)
      .single(),
    supabaseAdmin
      .from('eval_report_items')
      .select('id, rubric_id, rubric_title_snapshot, rubric_goal_snapshot, rubric_task_snapshot, rubric_level_high_snapshot, rubric_level_mid_snapshot, rubric_level_low_snapshot, criterion_title_snapshot, grade, teacher_feedback, sort_order')
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
        id: report.id,
        title: report.title,
        created_at: report.created_at,
        students: student.data ?? null,
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

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 이미지 storage 경로 먼저 수집
  const { data: images } = await supabaseAdmin
    .from('eval_report_images')
    .select('storage_path')
    .eq('report_id', params.reportId);

  const { error } = await supabaseAdmin
    .from('eval_reports')
    .delete()
    .eq('id', params.reportId)
    .eq('teacher_id', auth.teacher.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Storage 이미지 삭제
  if (images && images.length > 0) {
    await supabaseAdmin.storage.from('eval-images').remove(images.map((img) => img.storage_path));
  }

  return NextResponse.json({ ok: true });
}
