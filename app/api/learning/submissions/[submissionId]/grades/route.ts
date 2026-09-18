import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacherSubmission } from '@/lib/learning-access';
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

  // 아직 제출이 끝나지 않은 제출물에는 등급을 매기지 않는다. 등급이 생기면 학생 수정이 잠긴다.
  if (access.submission.status !== 'submitted') {
    return NextResponse.json({ error: '제출이 끝난 뒤에 평가할 수 있습니다.' }, { status: 409 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: grades } = await supabaseAdmin
    .from('learning_submission_grades')
    .select('question_id,self_grade,teacher_grade,teacher_comment')
    .eq('submission_id', access.submission.id);

  return NextResponse.json({ grades: grades ?? [] });
}
