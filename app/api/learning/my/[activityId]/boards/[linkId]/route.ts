import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
  SUBMISSION_COLUMNS,
  type LearningSubmissionRow,
} from '@/lib/learning-access';
import { loadStudentLearningDetail } from '@/lib/learning-detail';
import { evidenceViews } from '@/lib/learning-boards';

// 학생 — 내가 붙인 작업장 근거 열기(GET) · 떼기(DELETE)
// 내 제출물에 달린 근거인지 반드시 확인한다 — linkId만 믿으면 남의 근거도 열리고 지워진다.

type Params = { params: { activityId: string; linkId: string } };

async function ownLink(activityId: string, linkId: string) {
  const access = await requireStudentActivity(activityId);
  if (access.error) return { ok: false as const, error: access.error };
  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('activity_id', access.activity.id)
    .eq('student_id', access.student.id)
    .maybeSingle<LearningSubmissionRow>();
  if (!submission) return { ok: false as const, error: NextResponse.json({ error: '제출물을 찾을 수 없어요.' }, { status: 404 }) };
  const { data: link } = await supabaseAdmin
    .from('learning_submission_boards')
    .select('id, board_id')
    .eq('id', linkId)
    .eq('submission_id', submission.id)
    .maybeSingle();
  if (!link) return { ok: false as const, error: NextResponse.json({ error: '작업장을 찾을 수 없어요.' }, { status: 404 }) };
  return { ok: true as const, access, submission, link };
}

/** 근거 작업장과 하위 작업장(내가 볼 수 있는 것만) — 같은 층의 다른 작업장은 보이지 않는다 */
export async function GET(_: Request, { params }: Params) {
  const c = await ownLink(params.activityId, params.linkId);
  if (!c.ok) return c.error;
  try {
    const boards = await evidenceViews({ kind: 'student', id: c.access.student.id }, c.link.board_id as string);
    return NextResponse.json({ boards });
  } catch (e) {
    return serverError(e as Error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const c = await ownLink(params.activityId, params.linkId);
  if (!c.ok) return c.error;
  if (await lockedByFeedback(c.submission)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const { error } = await supabaseAdmin.from('learning_submission_boards').delete().eq('id', c.link.id);
  if (error) return serverError(error);
  const submitted = await recalcSubmissionStatus(c.submission);
  const detail = await loadStudentLearningDetail(c.access.student.id, c.access.activity);
  return NextResponse.json({ ok: true, submitted, detail });
}
