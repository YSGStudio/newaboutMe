import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hasAnyGrade, requireTeacherActivity, sameQuestions, toQuestionRows } from '@/lib/learning-access';
import { ACTIVITY_LOCKED_MESSAGE, isCriterionQuestion, QUESTION_COLUMNS, type LearningQuestionRow } from '@/lib/learning';
import { learningActivityUpdateSchema } from '@/lib/validators';
import { LEARNING_BUCKET } from '@/lib/learning-storage';

// 배움성찰 활동 수정·삭제 (교사 전용)

type Params = { params: { activityId: string } };

export async function PATCH(req: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;

  const parsed = learningActivityUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const { data: existingRows } = await supabaseAdmin
    .from('learning_activity_questions')
    .select(QUESTION_COLUMNS)
    .eq('activity_id', params.activityId)
    .order('sort_order', { ascending: true });
  const existing = (existingRows ?? []) as LearningQuestionRow[];
  const questionsChanged = !sameQuestions(existing, parsed.data.reflectionQuestions);

  // 평가요소 질문이 있는 활동에 자기평가·교사 등급이 생긴 뒤에는 질문을 바꿀 수 없다.
  // 질문을 갈아끼우면 등급이 가리키는 질문이 사라지기 때문이다. 활동명 등은 계속 고칠 수 있다.
  if (questionsChanged && existing.some(isCriterionQuestion) && (await hasAnyGrade(params.activityId))) {
    return NextResponse.json({ error: ACTIVITY_LOCKED_MESSAGE }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('learning_activities')
    .update({
      subject: parsed.data.subject,
      unit: parsed.data.unit,
      title: parsed.data.title,
    })
    .eq('id', params.activityId)
    .select('id,class_id,subject,unit,title,created_at,archived_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 질문이 그대로면 건드리지 않는다.
  if (!questionsChanged) {
    return NextResponse.json({ activity: { ...data, learning_activity_questions: existing } });
  }

  // 질문은 통째로 갈아끼운다. 지워진 질문에 달린 답도 cascade로 함께 사라지므로,
  // 이미 답이 달린 활동의 질문을 고치면 그 답을 잃는다는 점을 화면에서 미리 알린다.
  await supabaseAdmin.from('learning_activity_questions').delete().eq('activity_id', params.activityId);

  const { data: questions, error: questionError } = await supabaseAdmin
    .from('learning_activity_questions')
    .insert(toQuestionRows(params.activityId, parsed.data.reflectionQuestions))
    .select(QUESTION_COLUMNS);

  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });

  return NextResponse.json({ activity: { ...data, learning_activity_questions: questions ?? [] } });
}

export async function DELETE(_: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;

  // DB는 cascade로 지워지지만 Storage 객체는 남는다. 지우기 전에 경로를 모아 둔다.
  const { data: submissions } = await supabaseAdmin
    .from('learning_submissions')
    .select('id')
    .eq('activity_id', params.activityId);

  const submissionIds = (submissions ?? []).map((row) => row.id);

  let storagePaths: string[] = [];
  if (submissionIds.length > 0) {
    const { data: files } = await supabaseAdmin
      .from('learning_submission_files')
      .select('storage_path')
      .in('submission_id', submissionIds);
    storagePaths = (files ?? []).map((file) => file.storage_path);
  }

  const { error } = await supabaseAdmin
    .from('learning_activities')
    .delete()
    .eq('id', params.activityId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 파일 정리는 best-effort — 실패해도 활동 삭제는 이미 끝났으므로 로그만 남긴다.
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabaseAdmin.storage.from(LEARNING_BUCKET).remove(storagePaths);
    if (storageError) {
      console.error('[learning/activities] Storage 정리 실패:', storageError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
