import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureProxySubmission, requireTeacherSubmission } from '@/lib/learning-access';
import { learningGradesSchema } from '@/lib/validators';
import { isCriterionQuestion } from '@/lib/learning';

// 교사 요소별 등급·코멘트 저장 (평가요소 질문마다)
// 등급을 null로 보내면 그 요소의 교사 등급을 지운다. 등급과 서술 피드백이 모두 없어지면
// 학생 수정 잠금도 풀린다(lockedByFeedback). 과거 자기평가 컬럼은 건드리지 않는다.

type Params = { params: { submissionId: string } };

export async function PUT(req: Request, { params }: Params) {
  const access = await requireTeacherSubmission(params.submissionId);
  if ('error' in access) return access.error;

  const parsed = learningGradesSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  // 이 제출물이 속한 활동의 평가요소 질문만 받는다.
  const { data: questions } = await supabaseAdmin
    .from('learning_activity_questions')
    .select('id,criterion_title')
    .eq('activity_id', access.activity.id);

  const criterionIds = new Set((questions ?? []).filter(isCriterionQuestion).map((q) => q.id));
  if (parsed.data.grades.some((item) => !criterionIds.has(item.questionId))) {
    return NextResponse.json({ error: '이 활동의 평가요소가 아닙니다.' }, { status: 400 });
  }

  // 교사는 제출 여부와 상관없이 평가할 수 있다. 평가 결과가 학생과 집계에 보이도록 제출로 맞춘다.
  await ensureProxySubmission(access.activity.id, access.submission.student_id);

  const { error } = await supabaseAdmin
    .from('learning_submission_grades')
    .upsert(
      parsed.data.grades.map((item) => ({
        submission_id: access.submission.id,
        question_id: item.questionId,
        teacher_grade: item.grade,
        teacher_comment: item.comment,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'submission_id,question_id' },
    );

  if (error) return serverError(error);

  const { data: grades } = await supabaseAdmin
    .from('learning_submission_grades')
    .select('question_id,teacher_grade,teacher_comment')
    .eq('submission_id', access.submission.id);

  return NextResponse.json({ grades: grades ?? [] });
}
