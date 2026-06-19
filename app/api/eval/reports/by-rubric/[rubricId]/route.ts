import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { rubricId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const { data: rubric } = await supabaseAdmin
    .from('eval_rubrics')
    .select('id,title,subject,goal,task,criteria')
    .eq('id', params.rubricId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();
  if (!rubric) return NextResponse.json({ error: '채점기준을 찾을 수 없습니다.' }, { status: 404 });

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();
  if (!cls) return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number')
    .eq('class_id', classId)
    .order('student_number', { ascending: true });

  if (!students || students.length === 0) {
    return NextResponse.json({ rubric, records: [] });
  }

  const studentIds = students.map((s) => s.id);

  const { data: reports, error } = await supabaseAdmin
    .from('eval_reports')
    .select('id, student_id, title, created_at, eval_report_items(id, grade, teacher_feedback, criterion_title_snapshot, sort_order, rubric_id)')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 학생별로 해당 채점기준이 포함된 가장 최근 보고서 1건만 채택
  const latestByStudent = new Map<string, { reportId: string; title: string; createdAt: string; items: { grade: string; teacherFeedback: string | null; criterionTitleSnapshot: string | null; sortOrder: number }[] }>();

  for (const report of reports ?? []) {
    if (latestByStudent.has(report.student_id)) continue;
    const matched = (report.eval_report_items ?? [])
      .filter((item: { rubric_id: string | null }) => item.rubric_id === params.rubricId)
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
    if (matched.length === 0) continue;
    latestByStudent.set(report.student_id, {
      reportId: report.id,
      title: report.title,
      createdAt: report.created_at,
      items: matched.map((item: { grade: string; teacher_feedback: string | null; criterion_title_snapshot: string | null; sort_order: number }) => ({
        grade: item.grade,
        teacherFeedback: item.teacher_feedback,
        criterionTitleSnapshot: item.criterion_title_snapshot,
        sortOrder: item.sort_order,
      })),
    });
  }

  const records = students.map((s) => {
    const found = latestByStudent.get(s.id);
    return {
      studentId: s.id,
      name: s.name,
      studentNumber: s.student_number,
      reportId: found?.reportId ?? null,
      reportTitle: found?.title ?? null,
      createdAt: found?.createdAt ?? null,
      items: found?.items ?? [],
    };
  });

  return NextResponse.json({ rubric, records });
}
