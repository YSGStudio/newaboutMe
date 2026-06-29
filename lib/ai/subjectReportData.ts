import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type RawEvalItem = {
  criterionTitle: string | null;
  grade: 'high' | 'mid' | 'low';
  teacherFeedback: string | null;
};

export type RawEvalReport = {
  title: string;
  subject: string | null;
  goal: string | null;
  task: string | null;
  items: RawEvalItem[];
};

// 종합평가: 기간 제한 없이 학생의 전체 평가기록을 가져온다 (전근 기록 전체 분석)
export async function gatherAllEvalReports(studentId: string, teacherId: string): Promise<RawEvalReport[]> {
  const { data } = await supabaseAdmin
    .from('eval_reports')
    .select(`
      title,
      eval_report_items(rubric_subject_snapshot, rubric_goal_snapshot, rubric_task_snapshot, criterion_title_snapshot, grade, teacher_feedback, sort_order)
    `)
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((r: {
    title: string;
    eval_report_items: {
      rubric_subject_snapshot: string | null;
      rubric_goal_snapshot: string | null;
      rubric_task_snapshot: string | null;
      criterion_title_snapshot: string | null;
      grade: 'high' | 'mid' | 'low';
      teacher_feedback: string | null;
      sort_order: number;
    }[];
  }) => {
    const sortedItems = [...r.eval_report_items].sort((a, b) => a.sort_order - b.sort_order);
    return {
      title: r.title,
      subject: sortedItems[0]?.rubric_subject_snapshot ?? null,
      goal: sortedItems[0]?.rubric_goal_snapshot ?? null,
      task: sortedItems[0]?.rubric_task_snapshot ?? null,
      items: sortedItems.map((it) => ({
        criterionTitle: it.criterion_title_snapshot,
        grade: it.grade,
        teacherFeedback: it.teacher_feedback,
      })),
    };
  });
}
