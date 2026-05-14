import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 });

  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', classId)
    .order('student_number', { ascending: true });

  if (!students || students.length === 0) return NextResponse.json({ summaries: [] });

  const studentIds = students.map((s) => s.id);

  const { data: reports } = await supabaseAdmin
    .from('eval_reports')
    .select('id, title, created_at, student_id, eval_report_items(grade)')
    .in('student_id', studentIds)
    .eq('teacher_id', auth.teacher.id)
    .order('created_at', { ascending: false });

  const reportsArr = reports ?? [];

  const summaries = students.map((s) => {
    const studentReports = reportsArr.filter((r) => r.student_id === s.id);
    const gradeCounts = { high: 0, mid: 0, low: 0 };
    studentReports.forEach((r) => {
      (r.eval_report_items as { grade: string }[]).forEach((item) => {
        if (item.grade in gradeCounts) gradeCounts[item.grade as keyof typeof gradeCounts]++;
      });
    });
    const latest = studentReports[0] ?? null;
    return {
      studentId: s.id,
      name: s.name,
      studentNumber: s.student_number,
      reportCount: studentReports.length,
      gradeCounts,
      latestReport: latest ? { title: latest.title, createdAt: latest.created_at } : null,
    };
  });

  return NextResponse.json({ summaries });
}
