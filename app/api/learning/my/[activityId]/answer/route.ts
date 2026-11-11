import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  getOrCreateSubmission,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
} from '@/lib/learning-access';
import { loadStudentLearningDetail } from '@/lib/learning-detail';
import { learningAnswerSchema } from '@/lib/validators';

// 학생 성찰 답변 저장 (질문별로 여러 개를 한 번에)
// 저장 후 제출 완료 여부를 다시 판정한다 — 모든 질문에 답하면 완료다(결과물은 없어도 된다).
// 응답에 갱신된 상세(detail)를 함께 실어 보낸다 — 화면이 상세를 다시 GET 하지 않아도 되게.

type Params = { params: { activityId: string } };

export async function PUT(req: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  const parsed = learningAnswerSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const submission = await getOrCreateSubmission(access.activity.id, access.student.id);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });

  // 잠금 확인과 질문 목록은 서로 기다릴 이유가 없어 함께 읽는다.
  const [locked, { data: questions }] = await Promise.all([
    lockedByFeedback(submission),
    supabaseAdmin
      .from('learning_activity_questions')
      .select('id')
      .eq('activity_id', access.activity.id),
  ]);

  // 피드백이 달린 뒤에는 화면 잠금과 별개로 여기서도 막는다.
  if (locked) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  // 이 활동의 질문만 받아들인다 — 다른 활동의 question_id를 섞어 보내도 저장되지 않는다.
  const validIds = new Set((questions ?? []).map((q) => q.id));
  const rows = parsed.data.answers
    .filter((item) => validIds.has(item.questionId))
    .map((item) => ({
      submission_id: submission.id,
      question_id: item.questionId,
      answer: item.answer,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from('learning_submission_answers')
      .upsert(rows, { onConflict: 'submission_id,question_id' });

    if (error) return serverError(error);
  }

  const submitted = await recalcSubmissionStatus(submission);

  const detail = await loadStudentLearningDetail(access.student.id, access.activity);

  return NextResponse.json({ submission: detail.submission, submitted, detail });
}
