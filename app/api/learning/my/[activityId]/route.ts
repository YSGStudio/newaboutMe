import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentActivity, SUBMISSION_COLUMNS } from '@/lib/learning-access';
import { getLearningStatus } from '@/lib/learning';
import { signPaths } from '@/lib/learning-storage';

// 학생 책 상세 — 활동 정보 + 내 제출물 + 내 파일 + 선생님 피드백
// 제출물이 아직 없을 수 있다(미제출). 그때는 submission: null로 내려보내고
// 화면에서 빈 제출 폼을 그린다. 여기서 미리 행을 만들지 않는다.

type Params = { params: { activityId: string } };

export async function GET(_: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  const { student, activity } = access;

  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id,question,sort_order')
    .eq('activity_id', activity.id)
    .order('sort_order', { ascending: true });

  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('activity_id', activity.id)
    .eq('student_id', student.id)
    .maybeSingle();

  // 파일마다 따로 서명 URL을 요청하지 않도록, 소유권 확인이 끝난 여기서 한 번에 붙여 보낸다.
  let files: { id: string; file_name: string; mime_type: string; sort_order: number; url: string | null }[] = [];
  let links: { id: string; url: string; label: string | null; sort_order: number }[] = [];
  let answers: { question_id: string; answer: string }[] = [];

  if (submission) {
    const [filesRes, linksRes, answersRes] = await Promise.all([
      supabaseAdmin
        .from('learning_submission_files')
        .select('id,file_name,mime_type,sort_order,storage_path')
        .eq('submission_id', submission.id)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('learning_submission_links')
        .select('id,url,label,sort_order')
        .eq('submission_id', submission.id)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('learning_submission_answers')
        .select('question_id,answer')
        .eq('submission_id', submission.id),
    ]);

    const rows = filesRes.data ?? [];
    const signed = await signPaths(rows.map((row) => row.storage_path));
    files = rows.map(({ storage_path, ...row }) => ({ ...row, url: signed.get(storage_path) ?? null }));
    links = linksRes.data ?? [];
    answers = answersRes.data ?? [];
  }

  const answerMap = new Map(answers.map((a) => [a.question_id, a.answer]));

  return NextResponse.json({
    activity,
    // 질문마다 내 답을 붙여 내려보낸다 — 화면에서 질문과 답을 짝지어 그리기 위해서다.
    questions: (questions ?? []).map((q) => ({ ...q, answer: answerMap.get(q.id) ?? '' })),
    submission: submission ? { ...submission, files, links } : null,
    status: getLearningStatus(submission),
  });
}
