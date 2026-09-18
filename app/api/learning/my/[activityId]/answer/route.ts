import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  getOrCreateSubmission,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
  SUBMISSION_COLUMNS,
} from '@/lib/learning-access';
import { learningAnswerSchema } from '@/lib/validators';
import { isCriterionQuestion } from '@/lib/learning';
import { rewardLearningSubmission } from '@/lib/learning-rewards';

// 학생 성찰 답변 저장 (질문별로 여러 개를 한 번에)
// 저장 후 제출 완료 여부를 다시 판정한다 — 결과물 1개 이상 + 모든 질문에 답하면 완료다.

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

  // 피드백이 달린 뒤에는 화면 잠금과 별개로 여기서도 막는다.
  if (await lockedByFeedback(submission)) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  // 이 활동의 질문만 받아들인다 — 다른 활동의 question_id를 섞어 보내도 저장되지 않는다.
  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id,criterion_title')
    .eq('activity_id', access.activity.id);

  const validIds = new Set((questions ?? []).map((q) => q.id));
  const criterionIds = new Set((questions ?? []).filter(isCriterionQuestion).map((q) => q.id));

  // 이전 화면에서 보낸 자기평가는 과거 클라이언트 호환을 위해서만 받아 저장한다.
  const selfGrades = parsed.data.selfGrades ?? [];
  if (selfGrades.some((item) => !criterionIds.has(item.questionId))) {
    return NextResponse.json({ error: '이 활동의 평가요소가 아니에요.' }, { status: 400 });
  }
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 자기평가만 쓴다 — 교사 등급·코멘트 컬럼은 upsert 대상에 넣지 않으므로 기존 값이 그대로 남는다.
  if (selfGrades.length > 0) {
    const { error } = await supabaseAdmin
      .from('learning_submission_grades')
      .upsert(
        selfGrades.map((item) => ({
          submission_id: submission.id,
          question_id: item.questionId,
          self_grade: item.grade,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'submission_id,question_id' },
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const submitted = await recalcSubmissionStatus(submission);

  const { data: refreshed } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', submission.id)
    .maybeSingle();

  // 별빛 퀘스트(뱃지)와 별빛 여행(연료) 연결 — 제출이 완료됐을 때만 지급한다(lib/learning-rewards.ts).
  const newBadges = submitted ? await rewardLearningSubmission(access.student.id, submission.id) : [];

  return NextResponse.json({ submission: refreshed, submitted, newBadges });
}
