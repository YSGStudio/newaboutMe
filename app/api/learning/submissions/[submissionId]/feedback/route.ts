import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacherSubmission, SUBMISSION_COLUMNS } from '@/lib/learning-access';
import { learningFeedbackSchema } from '@/lib/validators';

// 교사 피드백 저장·수정·삭제
// 피드백은 선택 사항이다. 쓰지 않은 학생에게 미완료 표시를 하지 않으며,
// 피드백이 없어도 활동과 학생 제출은 정상 완료로 본다.

type Params = { params: { submissionId: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireTeacherSubmission(params.submissionId);
  if ('error' in access) return access.error;

  const parsed = learningFeedbackSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('learning_submissions')
    .update({
      feedback_text: parsed.data.feedback,
      feedback_updated_at: new Date().toISOString(),
    })
    .eq('id', params.submissionId)
    .select(SUBMISSION_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data });
}

// 피드백을 지우면 학생의 수정 잠금도 함께 풀린다.
export async function DELETE(_: Request, { params }: Params) {
  const access = await requireTeacherSubmission(params.submissionId);
  if ('error' in access) return access.error;

  const { data, error } = await supabaseAdmin
    .from('learning_submissions')
    .update({ feedback_text: null, feedback_updated_at: null })
    .eq('id', params.submissionId)
    .select(SUBMISSION_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data });
}
