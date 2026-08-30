import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { denyEvalStudent } from '@/lib/eval-access';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  // 평가피드백은 관리자 학급에만 열려 있다(lib/features.ts).
  const denied = await denyEvalStudent(auth.student.classes.teacher_id);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('eval_reports')
    .select(`
      id, title, created_at,
      eval_report_items(id, grade, sort_order, rubric_title_snapshot, rubric_subject_snapshot),
      eval_report_images(id, storage_path, sort_order),
      eval_reflections(id),
      eval_parent_comments(id)
    `)
    .eq('student_id', auth.student.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}
