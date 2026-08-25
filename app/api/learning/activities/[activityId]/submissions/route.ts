import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacherActivity } from '@/lib/learning-access';
import { getLearningStatus } from '@/lib/learning';
import { signPaths } from '@/lib/learning-storage';

// 활동 상세 — 학생 카드 그리드용 데이터 (교사 전용)
// 제출한 학생만이 아니라 "학급 전체 학생"을 내려야 미제출이 카드로 보인다.

type Params = { params: { activityId: string } };

export async function GET(_: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;

  const { activity } = access;

  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id,question,sort_order')
    .eq('activity_id', activity.id)
    .order('sort_order', { ascending: true });

  const { data: students, error } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number')
    .eq('class_id', activity.class_id)
    .order('student_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roster = students ?? [];

  const { data: submissions } = await supabaseAdmin
    .from('learning_submissions')
    .select('id,student_id,status,submitted_by,submitted_at,feedback_text,feedback_updated_at')
    .eq('activity_id', params.activityId);

  const byStudent = new Map((submissions ?? []).map((row) => [row.student_id, row]));

  const submissionIds = (submissions ?? []).map((row) => row.id);
  type FileOut = { id: string; file_name: string; mime_type: string; sort_order: number; url: string | null };
  const filesBySubmission = new Map<string, FileOut[]>();

  if (submissionIds.length > 0) {
    const { data: files } = await supabaseAdmin
      .from('learning_submission_files')
      .select('id,submission_id,file_name,mime_type,sort_order,storage_path')
      .in('submission_id', submissionIds)
      .order('sort_order', { ascending: true });

    const rows = files ?? [];
    // 학급 전체 파일의 서명 URL을 한 번에 발급한다 — 카드에서 바로 썸네일을 보여주기 위해서다.
    const signed = await signPaths(rows.map((row) => row.storage_path));

    rows.forEach((file) => {
      const bucket = filesBySubmission.get(file.submission_id) ?? [];
      bucket.push({
        id: file.id,
        file_name: file.file_name,
        mime_type: file.mime_type,
        sort_order: file.sort_order,
        url: signed.get(file.storage_path) ?? null,
      });
      filesBySubmission.set(file.submission_id, bucket);
    });
  }

  // 링크와 질문별 답변도 함께 모은다 — 교사가 카드를 열 때 추가 요청 없이 바로 보이게 한다.
  const linksBySubmission = new Map<string, { id: string; url: string; label: string | null; sort_order: number }[]>();
  const answersBySubmission = new Map<string, Map<string, string>>();

  if (submissionIds.length > 0) {
    const [linksRes, answersRes] = await Promise.all([
      supabaseAdmin
        .from('learning_submission_links')
        .select('id,submission_id,url,label,sort_order')
        .in('submission_id', submissionIds)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('learning_submission_answers')
        .select('submission_id,question_id,answer')
        .in('submission_id', submissionIds),
    ]);

    (linksRes.data ?? []).forEach(({ submission_id, ...link }) => {
      const bucket = linksBySubmission.get(submission_id) ?? [];
      bucket.push(link);
      linksBySubmission.set(submission_id, bucket);
    });

    (answersRes.data ?? []).forEach((row) => {
      const bucket = answersBySubmission.get(row.submission_id) ?? new Map<string, string>();
      bucket.set(row.question_id, row.answer);
      answersBySubmission.set(row.submission_id, bucket);
    });
  }

  const questionRows = questions ?? [];

  return NextResponse.json({
    activity,
    questions: questionRows,
    students: roster.map((student) => {
      const submission = byStudent.get(student.id) ?? null;
      const answerMap = submission ? answersBySubmission.get(submission.id) : undefined;
      return {
        student,
        status: getLearningStatus(submission),
        submission: submission
          ? {
              ...submission,
              files: filesBySubmission.get(submission.id) ?? [],
              links: linksBySubmission.get(submission.id) ?? [],
              // 질문 순서대로 답을 붙여 보낸다 — 교사 화면에서 질문·답을 짝지어 그리기 위해서다.
              answers: questionRows.map((q) => ({
                questionId: q.id,
                question: q.question,
                answer: answerMap?.get(q.id) ?? '',
              })),
            }
          : null,
      };
    }),
  });
}
