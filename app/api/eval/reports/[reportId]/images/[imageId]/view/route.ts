import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string; imageId: string } };

export async function GET(req: Request, { params }: Params) {
  // 교사 또는 학생 세션 확인
  const teacherAuth = await requireTeacher();
  const isTeacher = !('error' in teacherAuth);

  let studentId: string | null = null;
  if (!isTeacher) {
    const studentAuth = await requireStudentSession();
    if ('error' in studentAuth) return studentAuth.error;
    studentId = studentAuth.student.id;
  }

  // 이미지 조회
  const { data: image } = await supabaseAdmin
    .from('eval_report_images')
    .select('id, storage_path, report_id')
    .eq('id', params.imageId)
    .eq('report_id', params.reportId)
    .maybeSingle();

  if (!image) return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });

  // 학생인 경우 본인 보고서인지 확인
  if (!isTeacher && studentId) {
    const { data: report } = await supabaseAdmin
      .from('eval_reports')
      .select('id')
      .eq('id', params.reportId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!report) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  // signed URL 발급 (10분 유효)
  const { data: signedData, error } = await supabaseAdmin.storage
    .from('eval-images')
    .createSignedUrl(image.storage_path, 600);

  if (error || !signedData) return NextResponse.json({ error: '이미지 URL 발급에 실패했습니다.' }, { status: 500 });

  return NextResponse.json({ url: signedData.signedUrl });
}
