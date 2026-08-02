import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/adminSettings';

// 학급 데이터 백업 내보내기 (관리자 전용) — 지정한 학급의 핵심 기록을 JSON으로 반환한다.
export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  if (auth.teacher.role !== 'admin') {
    return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
  }

  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const { data: cls, error: clsError } = await supabaseAdmin
    .from('classes')
    .select('id, class_name, grade, section, class_code, created_at')
    .eq('id', classId)
    .maybeSingle();
  if (clsError) return NextResponse.json({ error: clsError.message }, { status: 500 });
  if (!cls) return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', classId)
    .order('student_number');

  const studentIds = (students ?? []).map((s) => s.id);
  const [feedsRes, evalsRes] = studentIds.length
    ? await Promise.all([
        supabaseAdmin.from('emotion_feeds').select('student_id, emotion_type, content, created_at').in('student_id', studentIds).order('created_at'),
        supabaseAdmin.from('eval_reports').select('id, student_id, title, created_at').in('student_id', studentIds).order('created_at'),
      ])
    : [{ data: [] }, { data: [] }];

  await logAdminAction(
    { id: auth.teacher.id, name: auth.teacher.name },
    'data_export',
    `학급 데이터 내보내기: ${cls.class_name} (학생 ${studentIds.length}명)`,
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    class: cls,
    students: students ?? [],
    emotionFeeds: feedsRes.data ?? [],
    evalReports: evalsRes.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="starlog-class-${classId}.json"`,
    },
  });
}
