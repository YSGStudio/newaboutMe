import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  getOrCreateSubmission,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
} from '@/lib/learning-access';
import { checkLearningLink } from '@/lib/learning';
import { learningLinkSchema } from '@/lib/validators';

// 학생 결과물 링크 등록
// 파일과 마찬가지로 "결과물 1개"로 세므로, 링크만 올리고 성찰을 써도 제출이 완료된다.

type Params = { params: { activityId: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  const parsed = learningLinkSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const submission = await getOrCreateSubmission(access.activity.id, access.student.id);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });

  if (lockedByFeedback(submission)) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  const { count } = await supabaseAdmin
    .from('learning_submission_links')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id);

  const currentCount = count ?? 0;

  // 화면에서 이미 걸렀더라도 같은 기준으로 다시 검사한다(http/https만 허용).
  const rejection = checkLearningLink(parsed.data.url, currentCount);
  if (rejection) return NextResponse.json({ error: rejection }, { status: 400 });

  const { data: linkRow, error } = await supabaseAdmin
    .from('learning_submission_links')
    .insert({
      submission_id: submission.id,
      url: parsed.data.url.trim(),
      label: parsed.data.label?.trim() || null,
      sort_order: currentCount,
    })
    .select('id,url,label,sort_order')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const submitted = await recalcSubmissionStatus(submission);

  return NextResponse.json({ link: linkRow, submitted }, { status: 201 });
}
