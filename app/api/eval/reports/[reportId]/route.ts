import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { denyEvalTeacher } from '@/lib/eval-access';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 평가피드백은 관리자 계정에만 열려 있다(lib/features.ts).
  const denied = denyEvalTeacher(auth.teacher);
  if (denied) return denied;

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
      .select('id, rubric_id, rubric_title_snapshot, rubric_subject_snapshot, rubric_goal_snapshot, rubric_task_snapshot, rubric_level_high_snapshot, rubric_level_mid_snapshot, rubric_level_low_snapshot, criterion_title_snapshot, grade, teacher_feedback, sort_order')
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

  // 평가피드백은 관리자 계정에만 열려 있다(lib/features.ts).
  const denied = denyEvalTeacher(auth.teacher);
  if (denied) return denied;

  // 본인 보고서인지 먼저 확인한다.
  // 확인보다 먼저 storage 경로를 수집하면, 남의 보고서 삭제 요청에도
  // (DB 삭제는 0건이라 막히지만) 그쪽 이미지 파일이 지워진다.
  const { data: ownReport } = await supabaseAdmin
    .from('eval_reports')
    .select('id')
    .eq('id', params.reportId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!ownReport) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 이미지 storage 경로 수집
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

  // Storage 이미지 삭제 (DB 삭제가 성공한 뒤에만)
  if (images && images.length > 0) {
    await supabaseAdmin.storage.from('eval-images').remove(images.map((img) => img.storage_path));
  }

  return NextResponse.json({ ok: true });
}
