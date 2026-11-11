import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
  SUBMISSION_COLUMNS,
} from '@/lib/learning-access';
import { loadStudentLearningDetail } from '@/lib/learning-detail';
import { removeStorageObjects } from '@/lib/learning-storage';

// 학생 결과물 삭제
// 내 제출물에 달린 파일인지 반드시 확인한다 — fileId만 믿고 지우면 남의 파일도 지워진다.

type Params = { params: { activityId: string; fileId: string } };

export async function DELETE(_: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('activity_id', access.activity.id)
    .eq('student_id', access.student.id)
    .maybeSingle();

  if (!submission) return NextResponse.json({ error: '제출물을 찾을 수 없어요.' }, { status: 404 });

  // 잠금 확인과 대상 찾기는 서로 기다릴 이유가 없어 함께 읽는다.
  // submission_id로 좁혀서 조회 — 다른 학생 파일의 id를 넣어도 여기서 걸린다.
  const [locked, { data: file }] = await Promise.all([
    lockedByFeedback(submission),
    supabaseAdmin
      .from('learning_submission_files')
      .select('id,storage_path')
      .eq('id', params.fileId)
      .eq('submission_id', submission.id)
      .maybeSingle(),
  ]);

  if (locked) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  if (!file) return NextResponse.json({ error: '파일을 찾을 수 없어요.' }, { status: 404 });

  const { error } = await supabaseAdmin.from('learning_submission_files').delete().eq('id', file.id);
  if (error) return serverError(error);

  // 질문이 없는 활동은 마지막 결과물을 지우면 제출 조건이 깨진다 — 상태를 다시 판정한다.
  // 저장소 객체 지우기는 판정과 무관해서 함께 돌린다.
  const [, submitted] = await Promise.all([
    removeStorageObjects([file.storage_path]),
    recalcSubmissionStatus(submission),
  ]);

  // 갱신된 상세를 함께 실어 보낸다 — 화면이 상세를 다시 GET 하지 않아도 되게.
  const detail = await loadStudentLearningDetail(access.student.id, access.activity);

  return NextResponse.json({ ok: true, submitted, detail });
}
