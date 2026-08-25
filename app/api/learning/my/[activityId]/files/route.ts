import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireStudentActivity,
  getOrCreateSubmission,
  lockedByFeedback,
  recalcSubmissionStatus,
  LOCKED_MESSAGE,
} from '@/lib/learning-access';
import { checkLearningFile } from '@/lib/learning';
import { LEARNING_BUCKET, buildStoragePath } from '@/lib/learning-storage';

// 학생 결과물 업로드
// 학생은 Supabase Auth 사용자가 아니라 anon 키로 Storage 정책을 통과할 수 없다.
// 그래서 브라우저에서 직접 올리지 않고 이 라우트를 거친다(service role로 업로드).

type Params = { params: { activityId: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStudentActivity(params.activityId);
  if ('error' in access) return access.error;

  const submission = await getOrCreateSubmission(access.activity.id, access.student.id);
  if (!submission) return NextResponse.json({ error: '제출물을 만들지 못했습니다.' }, { status: 500 });

  if (lockedByFeedback(submission)) {
    return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '파일이 없어요.' }, { status: 400 });

  const { count } = await supabaseAdmin
    .from('learning_submission_files')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submission.id);

  const currentCount = count ?? 0;

  // 브라우저에서 이미 걸렀더라도 여기서 같은 기준으로 다시 검사한다.
  const rejection = checkLearningFile({ type: file.type, size: file.size }, currentCount);
  if (rejection) return NextResponse.json({ error: rejection }, { status: 400 });

  const storagePath = buildStoragePath({
    classId: access.activity.class_id,
    activityId: access.activity.id,
    studentId: access.student.id,
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
    // DB 기록에 실패하면 방금 올린 객체를 되돌린다(고아 파일 방지).
    await supabaseAdmin.storage.from(LEARNING_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // 결과물이 생겨서 제출 조건을 채웠을 수 있다 — 상태를 다시 판정한다.
  const submitted = await recalcSubmissionStatus(submission);

  return NextResponse.json({ file: fileRow, submitted }, { status: 201 });
}
