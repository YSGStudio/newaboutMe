import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireTeacherActivity,
  ensureProxySubmission,
  assertStudentInClass,
} from '@/lib/learning-access';
import { checkLearningLink } from '@/lib/learning';
import { learningLinkSchema } from '@/lib/validators';

/**
 * 교사 대리 등록 — 링크.
 *
 * 파일 대리 업로드(proxy-files)와 같은 흐름이다. 미제출 학생의 제출물 행을 만들면서
 * 링크를 붙이고, 성찰 답변이 없어도 제출로 인정한다.
 */

type Params = { params: { activityId: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => ({}));
  const studentId = typeof body?.studentId === 'string' ? body.studentId : '';

  if (!studentId) return NextResponse.json({ error: '학생을 선택해주세요.' }, { status: 400 });

  const parsed = learningLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const inClass = await assertStudentInClass(studentId, access.activity.class_id);
  if (!inClass) return NextResponse.json({ error: '이 학급의 학생이 아닙니다.' }, { status: 403 });

  const submission = await ensureProxySubmission(access.activity.id, studentId);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });

  const { count } = await supabaseAdmin
    .from('learning_submission_links')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id);

  const currentCount = count ?? 0;

  // 학생 등록과 같은 기준으로 검사한다(개수 상한, http/https만 허용).
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

  return NextResponse.json({ link: linkRow, submissionId: submission.id }, { status: 201 });
}
