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
import { checkAndAwardBadge } from '@/lib/badges';
import { FUEL_RULES, grantBadgeFuel, grantFuel, isQualityContent } from '@/lib/voyage';

// 학생 성찰 답변 저장 (질문별로 여러 개를 한 번에)
// 저장 후 제출 완료 여부를 다시 판정한다 — 결과물 1개 이상 + 모든 질문에 답이 있어야 완료다.

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
  if (lockedByFeedback(submission)) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  // 이 활동의 질문만 받아들인다 — 다른 활동의 question_id를 섞어 보내도 저장되지 않는다.
  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id')
    .eq('activity_id', access.activity.id);

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const submitted = await recalcSubmissionStatus(submission);

  const { data: refreshed } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', submission.id)
    .maybeSingle();

  // 별빛 퀘스트(뱃지)와 별빛 여행(연료) 연결.
  // 평가피드백의 성찰일기와 같은 규칙을 쓴다 — 성찰을 남기면 reflection 연료와 성찰 뱃지를 받는다.
  // 제출이 완료된 순간에만 지급하고, source_id로 제출물 id를 써서 활동당 한 번만 쌓이게 한다
  // (fuel_ledger의 unique 제약이 중복을 막는다).
  let newBadges: Awaited<ReturnType<typeof checkAndAwardBadge>> = [];

  if (submitted) {
    newBadges = await checkAndAwardBadge(supabaseAdmin, access.student.id, 'reflection_save');
    try {
      // 질문이 여러 개면 답을 합쳐 분량을 본다 — 질문 수에 따라 기준이 달라지면 안 되기 때문이다.
      const combined = rows.map((row) => row.answer).join(' ');
      if (isQualityContent(combined, FUEL_RULES.reflection.minChars)) {
        await grantFuel(supabaseAdmin, access.student.id, 'reflection', submission.id);
      }
      await grantBadgeFuel(supabaseAdmin, access.student.id, newBadges);
    } catch (fuelError) {
      // 연료 지급 실패가 성찰 저장을 되돌리게 두지 않는다.
      console.error('[voyage] 배움성찰 연료 지급 실패:', fuelError);
    }
  }

  return NextResponse.json({ submission: refreshed, submitted, newBadges });
}
