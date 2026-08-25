import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireTeacherActivity,
  ensureProxySubmission,
  assertStudentInClass,
} from '@/lib/learning-access';
import { checkLearningFile } from '@/lib/learning';
import { LEARNING_BUCKET, buildStoragePath } from '@/lib/learning-storage';

/**
 * 교사 대리 업로드 — 미제출 학생의 결과물을 교사가 대신 올린다.
 *
 * PRD는 이 라우트를 `/submissions/[submissionId]/files`로 적었지만,
 * 대리 업로드의 대상은 대부분 "아직 제출물 행이 없는" 미제출 학생이다.
 * submissionId를 미리 알 수 없어 activityId + studentId를 받아 행을 만들면서 올린다.
 * (제출물 생성과 업로드가 한 번의 호출로 끝난다.)
 *
 * 성찰 답변이 없어도 저장되며, status는 'submitted' / submitted_by는 'teacher'가 된다.
 */

type Params = { params: { activityId: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireTeacherActivity(params.activityId);
  if ('error' in access) return access.error;

  const formData = await req.formData();
  const studentId = formData.get('studentId');
  const file = formData.get('file') as File | null;

  if (typeof studentId !== 'string' || !studentId) {
    return NextResponse.json({ error: '학생을 선택해주세요.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });

  const inClass = await assertStudentInClass(studentId, access.activity.class_id);
  if (!inClass) return NextResponse.json({ error: '이 학급의 학생이 아닙니다.' }, { status: 403 });

  const submission = await ensureProxySubmission(access.activity.id, studentId);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });

  const { count } = await supabaseAdmin
    .from('learning_submission_files')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id);

  const currentCount = count ?? 0;

  const rejection = checkLearningFile({ type: file.type, size: file.size }, currentCount);
  if (rejection) return NextResponse.json({ error: rejection }, { status: 400 });

  const storagePath = buildStoragePath({
    classId: access.activity.class_id,
    activityId: access.activity.id,
    studentId,
    fileName: file.name,
  });

  const { error: uploadError } = await supabaseAdmin.storage
    .from(LEARNING_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: fileRow, error: dbError } = await supabaseAdmin
    .from('learning_submission_files')
    .insert({
      submission_id: submission.id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: currentCount,
    })
    .select('id,file_name,mime_type,sort_order')
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from(LEARNING_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // 제출 상태는 ensureProxySubmission에서 이미 세웠다(대리 등록은 성찰 답변 없이도 제출로 인정).

  return NextResponse.json({ file: fileRow, submissionId: submission.id }, { status: 201 });
}
