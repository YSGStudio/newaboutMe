import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import {
  requireStudentActivity,
  getOrCreateSubmission,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
} from '@/lib/learning-access';
import { loadStudentLearningDetail } from '@/lib/learning-detail';
import { attachBoard, boardOptions, BoardEvidenceError, MAX_BOARDS_PER_SUBMISSION } from '@/lib/learning-boards';

// 학생 결과물 — 별빛보드 작업장 근거
// GET: 고를 수 있는 작업장(우리 반 진행 중 프로젝트에서 내가 볼 수 있는 것)
// POST { boardId }: 내 제출물에 붙인다. 파일·링크처럼 "결과물 1개"로 센다.

type Params = { params: { activityId: string } };

export async function GET(_: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;
  try {
    const options = await boardOptions({ kind: 'student', id: access.student.id }, access.activity.class_id);
    return NextResponse.json({ options, max: MAX_BOARDS_PER_SUBMISSION });
  } catch (e) {
    return serverError(e as Error);
  }
}

export async function POST(req: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
  if (!boardId) return NextResponse.json({ error: '작업장을 골라 주세요.' }, { status: 400 });

  const submission = await getOrCreateSubmission(access.activity.id, access.student.id);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });
  if (await lockedByFeedback(submission)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });

  try {
    await attachBoard({
      viewer: { kind: 'student', id: access.student.id },
      classId: access.activity.class_id,
      studentId: access.student.id,
      submissionId: submission.id,
      boardId,
    });
  } catch (e) {
    if (e instanceof BoardEvidenceError) return NextResponse.json({ error: e.message }, { status: e.status });
    return serverError(e as Error);
  }

  const submitted = await recalcSubmissionStatus(submission);
  const detail = await loadStudentLearningDetail(access.student.id, access.activity);
  return NextResponse.json({ submitted, detail }, { status: 201 });
}
