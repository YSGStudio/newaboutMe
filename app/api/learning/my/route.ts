import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getLearningStatus } from '@/lib/learning';

// 학생 배움성찰 목록 — 내 학급 활동 + 내 제출 상태
// 다른 학생의 제출물은 조회 자체를 하지 않는다(student_id로 먼저 좁힌다).

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const { data: activities, error } = await supabaseAdmin
    .from('learning_activities')
    .select('id,subject,unit,title,created_at,learning_activity_questions(id)')
    .eq('class_id', auth.student.class_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = activities ?? [];
  if (rows.length === 0) return NextResponse.json({ activities: [] });

  const { data: submissions } = await supabaseAdmin
    .from('learning_submissions')
    .select('id,activity_id,status,submitted_by,feedback_text')
    .eq('student_id', auth.student.id)
    .in('activity_id', rows.map((row) => row.id));

  const byActivity = new Map((submissions ?? []).map((row) => [row.activity_id, row]));

  const submissionIds = (submissions ?? []).map((row) => row.id);
  // 결과물 개수 = 파일 + 링크. 카드에 "몇 개 냈는지" 보여주는 용도다.
  const materialCounts = new Map<string, number>();

  if (submissionIds.length > 0) {
    const [filesRes, linksRes] = await Promise.all([
      supabaseAdmin.from('learning_submission_files').select('submission_id').in('submission_id', submissionIds),
      supabaseAdmin.from('learning_submission_links').select('submission_id').in('submission_id', submissionIds),
    ]);

    [...(filesRes.data ?? []), ...(linksRes.data ?? [])].forEach((row) => {
      materialCounts.set(row.submission_id, (materialCounts.get(row.submission_id) ?? 0) + 1);
    });
  }

  return NextResponse.json({
    activities: rows.map((activity) => {
      const submission = byActivity.get(activity.id) ?? null;
      const { learning_activity_questions: questions, ...rest } = activity;
      return {
        ...rest,
        status: getLearningStatus(submission),
        submittedByTeacher: submission?.submitted_by === 'teacher',
        materialCount: submission ? materialCounts.get(submission.id) ?? 0 : 0,
        questionCount: questions?.length ?? 0,
      };
    }),
  });
}
