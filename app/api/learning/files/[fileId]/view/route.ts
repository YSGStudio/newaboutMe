import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { LEARNING_BUCKET, SIGNED_URL_TTL } from '@/lib/learning-storage';

/**
 * 결과물 열람 — 교사·학생 공용.
 *
 * 어느 쪽으로 들어오든 파일 → 제출물 → 활동으로 거슬러 올라가 소유권을 확인한 뒤에만
 * 서명 URL을 발급한다. 버킷은 private이고 공개 URL은 만들지 않는다.
 *
 * 신원 확인을 파일 조회보다 먼저 한다 — 순서를 뒤집으면 로그인하지 않은 요청에도
 * "그 id의 파일이 있는지 없는지"가 404/401 차이로 드러난다.
 *
 * 학생: 제출물의 student_id가 세션의 학생과 같아야 한다.
 * 교사: 활동이 속한 학급의 담당 교사여야 한다.
 */

type Params = { params: { fileId: string } };

export async function GET(_: Request, { params }: Params) {
  const teacherAuth = await requireTeacher();
  const isTeacher = !('error' in teacherAuth) || !teacherAuth.error;

  let studentId: string | null = null;

  if (!isTeacher) {
    const studentAuth = await requireStudentSession();
    if ('error' in studentAuth && studentAuth.error) return studentAuth.error;
    studentId = studentAuth.student.id;
  }

  const { data: file } = await supabaseAdmin
    .from('learning_submission_files')
    .select('id,storage_path,submission_id')
    .eq('id', params.fileId)
    .maybeSingle();

  if (!file) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });

  const { data: submission } = await supabaseAdmin
    .from('learning_submissions')
    .select('id,activity_id,student_id')
    .eq('id', file.submission_id)
    .maybeSingle();

  if (!submission) return NextResponse.json({ error: '제출물을 찾을 수 없습니다.' }, { status: 404 });

  if (isTeacher) {
    const { data: activity } = await supabaseAdmin
      .from('learning_activities')
      .select('id,class_id')
      .eq('id', submission.activity_id)
      .maybeSingle();

    if (!activity) return NextResponse.json({ error: '활동을 찾을 수 없습니다.' }, { status: 404 });

    const forbidden = await requireTeacherClass((teacherAuth as { teacher: { id: string } }).teacher.id, activity.class_id);
    if (forbidden) return forbidden;
  } else if (submission.student_id !== studentId) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { data: signed, error } = await supabaseAdmin.storage
    .from(LEARNING_BUCKET)
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL);

  if (error || !signed) {
    return NextResponse.json({ error: '파일 주소를 만들지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
