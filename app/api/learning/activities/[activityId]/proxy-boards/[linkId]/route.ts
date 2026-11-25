import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTeacherActivity, recalcSubmissionStatus, SUBMISSION_COLUMNS, type LearningSubmissionRow } from '@/lib/learning-access';
import { evidenceViews } from '@/lib/learning-boards';

// 교사 — 학생 제출물에 붙은 작업장 근거 열기(GET) · 떼기(DELETE)
// 근거 → 제출물 → 이 활동인지 확인한다(활동은 requireTeacherActivity가 학급 → 교사로 확인).

type Params = { params: { activityId: string; linkId: string } };

async function teacherLink(activityId: string, linkId: string) {
  const access = await requireTeacherActivity(activityId);
  if (access.error) return { ok: false as const, error: access.error };
  const { data: link } = await supabaseAdmin
    .from('learning_submission_boards')
    .select('id, board_id, submission_id')
    .eq('id', linkId)
    .maybeSingle();
  if (!link) return { ok: false as const, error: NextResponse.json({ error: '작업장을 찾을 수 없습니다.' }, { status: 404 }) };
  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', link.submission_id as string)
    .eq('activity_id', access.activity.id)
    .maybeSingle<LearningSubmissionRow>();
  if (!submission) return { ok: false as const, error: NextResponse.json({ error: '작업장을 찾을 수 없습니다.' }, { status: 404 }) };
  return { ok: true as const, access, link, submission };
}

export async function GET(_: Request, { params }: Params) {
  const c = await teacherLink(params.activityId, params.linkId);
  if (!c.ok) return c.error;
  try {
    const boards = await evidenceViews({ kind: 'teacher', id: c.access.teacher.id }, c.link.board_id as string);
    return NextResponse.json({ boards });
  } catch (e) {
    return serverError(e as Error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const c = await teacherLink(params.activityId, params.linkId);
  if (!c.ok) return c.error;
  const { error } = await supabaseAdmin.from('learning_submission_boards').delete().eq('id', c.link.id);
  if (error) return serverError(error);
  await recalcSubmissionStatus(c.submission);
  return NextResponse.json({ ok: true });
}
