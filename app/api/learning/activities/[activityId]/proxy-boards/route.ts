import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { requireTeacherActivity, ensureProxySubmission, assertStudentInClass } from '@/lib/learning-access';
import { attachBoard, boardOptions, BoardEvidenceError, MAX_BOARDS_PER_SUBMISSION } from '@/lib/learning-boards';

/**
 * 교사 대리 등록 — 별빛보드 작업장 근거.
 * GET ?studentId=: 고를 수 있는 작업장(그 학급의 공용 작업장 + 그 학생의 개인 보드)
 * POST { studentId, boardId }: 링크 대리 등록(proxy-links)과 같은 흐름 — 제출물을 만들며 붙이고 제출로 인정한다.
 */

type Params = { params: { activityId: string } };

export async function GET(req: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;
  const studentId = new URL(req.url).searchParams.get('studentId') ?? '';
  if (!studentId || !(await assertStudentInClass(studentId, access.activity.class_id))) {
    return NextResponse.json({ error: '이 학급의 학생이 아닙니다.' }, { status: 403 });
  }
  try {
    const options = await boardOptions({ kind: 'teacher', id: access.teacher.id }, access.activity.class_id, studentId);
    return NextResponse.json({ options, max: MAX_BOARDS_PER_SUBMISSION });
  } catch (e) {
    return serverError(e as Error);
  }
}

export async function POST(req: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const studentId = typeof body?.studentId === 'string' ? body.studentId : '';
  const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
  if (!studentId) return NextResponse.json({ error: '학생을 선택해주세요.' }, { status: 400 });
  if (!boardId) return NextResponse.json({ error: '작업장을 선택해주세요.' }, { status: 400 });
  if (!(await assertStudentInClass(studentId, access.activity.class_id))) {
    return NextResponse.json({ error: '이 학급의 학생이 아닙니다.' }, { status: 403 });
  }

  const submission = await ensureProxySubmission(access.activity.id, studentId);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });

  try {
    await attachBoard({
      viewer: { kind: 'teacher', id: access.teacher.id },
      classId: access.activity.class_id,
      studentId,
      submissionId: submission.id,
      boardId,
    });
  } catch (e) {
    if (e instanceof BoardEvidenceError) return NextResponse.json({ error: e.message }, { status: e.status });
    return serverError(e as Error);
  }
  return NextResponse.json({ submissionId: submission.id }, { status: 201 });
}
