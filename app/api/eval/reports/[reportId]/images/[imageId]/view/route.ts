import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string; imageId: string } };

export async function GET(req: Request, { params }: Params) {
  // 교사 또는 학생 세션 확인.
  // 어느 쪽으로 들어오든 아래에서 보고서 소유권을 반드시 확인하도록,
  // 여기서는 "어떤 컬럼으로 소유권을 따질지"만 정한다.
  const teacherAuth = await requireTeacher();

  let ownerFilter: { column: 'teacher_id' | 'student_id'; value: string };

  if (!('error' in teacherAuth)) {
    ownerFilter = { column: 'teacher_id', value: teacherAuth.teacher.id };
  } else {
    const studentAuth = await requireStudentSession();
    if ('error' in studentAuth) return studentAuth.error;
    ownerFilter = { column: 'student_id', value: studentAuth.student.id };
  }

  // 이미지 조회
  const { data: image } = await supabaseAdmin
    .from('eval_report_images')
    .select('id, storage_path, report_id')
    .eq('id', params.imageId)
    .eq('report_id', params.reportId)
    .maybeSingle();

  if (!image) return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });

  // 보고서 소유권 확인 — 교사는 본인이 작성한 보고서만, 학생은 본인 보고서만 열람할 수 있다.
  const { data: report } = await supabaseAdmin
    .from('eval_reports')
    .select('id')
    .eq('id', params.reportId)
    .eq(ownerFilter.column, ownerFilter.value)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  // signed URL 발급 (10분 유효)
  const { data: signedData, error } = await supabaseAdmin.storage
    .from('eval-images')
    .createSignedUrl(image.storage_path, 600);

  if (error || !signedData) return NextResponse.json({ error: '이미지 URL 발급에 실패했습니다.' }, { status: 500 });

  return NextResponse.json({ url: signedData.signedUrl });
}
