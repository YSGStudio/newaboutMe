import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string } };

export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('eval_reports')
    .select(`
      id, title, created_at,
      students(id, name, student_number),
      eval_report_items(id, rubric_id, rubric_title_snapshot, rubric_goal_snapshot, rubric_task_snapshot, rubric_level_high_snapshot, rubric_level_mid_snapshot, rubric_level_low_snapshot, grade, teacher_feedback, sort_order),
      eval_report_images(id, storage_path, sort_order),
      eval_reflections(id, content, created_at),
      eval_parent_comments(id, content, created_at)
    `)
    .eq('id', params.reportId)
    .eq('teacher_id', auth.teacher.id)
    .single();

  if (error) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ report: data });
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
