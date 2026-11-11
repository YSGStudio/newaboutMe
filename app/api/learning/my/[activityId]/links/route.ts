import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api-error';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  getOrCreateSubmission,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
} from '@/lib/learning-access';
import { loadStudentLearningDetail } from '@/lib/learning-detail';
import { checkLearningLink } from '@/lib/learning';
import { learningLinkSchema } from '@/lib/validators';

// 학생 결과물 링크 등록
// 파일과 마찬가지로 "결과물 1개"로 센다. 질문이 없는 활동은 링크 하나만으로도 제출이 완료된다.

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

  // 잠금 확인과 현재 개수 세기는 서로 기다릴 이유가 없어 함께 돌린다.
  const [locked, { count }] = await Promise.all([
    lockedByFeedback(submission),
    supabaseAdmin
      .from('learning_submission_links')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submission.id),
  ]);

  if (locked) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

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

  if (error) return serverError(error);

  const submitted = await recalcSubmissionStatus(submission);
  // 결과물을 마지막으로 채워 제출이 끝났을 수 있다 — 그때도 연료·뱃지를 준다.
  // 갱신된 상세도 함께 실어 보낸다 — 화면이 상세를 다시 GET 하지 않아도 되게.
  const detail = await loadStudentLearningDetail(access.student.id, access.activity);

  return NextResponse.json({ link: linkRow, submitted, detail }, { status: 201 });
}
