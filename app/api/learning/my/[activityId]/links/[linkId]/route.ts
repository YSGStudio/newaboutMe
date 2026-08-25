import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
  SUBMISSION_COLUMNS,
} from '@/lib/learning-access';

// 학생 결과물 링크 삭제
// 내 제출물에 달린 링크인지 반드시 확인한다 — linkId만 믿고 지우면 남의 링크도 지워진다.

type Params = { params: { activityId: string; linkId: string } };

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

  if (lockedByFeedback(submission)) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  const { data: link } = await supabaseAdmin
    .from('learning_submission_links')
    .select('id')
    .eq('id', params.linkId)
    .eq('submission_id', submission.id)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: '링크를 찾을 수 없어요.' }, { status: 404 });

  const { error } = await supabaseAdmin.from('learning_submission_links').delete().eq('id', link.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const submitted = await recalcSubmissionStatus(submission);

  return NextResponse.json({ ok: true, submitted });
}
