import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const reportCreateSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().min(1).max(100),
  items: z.array(z.object({
    rubricId: z.string().uuid().nullable().optional(),
    rubricTitleSnapshot: z.string().min(1).max(100),
    rubricGoalSnapshot: z.string().max(200).nullable().optional(),
    rubricTaskSnapshot: z.string().max(200).nullable().optional(),
    rubricLevelHighSnapshot: z.string().max(200).nullable().optional(),
    rubricLevelMidSnapshot: z.string().max(200).nullable().optional(),
    rubricLevelLowSnapshot: z.string().max(200).nullable().optional(),
    grade: z.enum(['high', 'mid', 'low']),
    teacherFeedback: z.string().max(200).nullable().optional(),
    sortOrder: z.number().int().default(0)
  })).min(1)
});

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // 학생이 내 학급 소속인지 확인
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, classes!inner(teacher_id)')
    .eq('id', parsed.data.studentId)
    .maybeSingle();

  if (!student || (student.classes as unknown as { teacher_id: string }).teacher_id !== auth.teacher.id) {
    return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: report, error: reportError } = await supabaseAdmin
    .from('eval_reports')
    .insert({ student_id: parsed.data.studentId, teacher_id: auth.teacher.id, title: parsed.data.title })
    .select('id,title,created_at')
    .single();

  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 });

  const itemRows = parsed.data.items.map((item, idx) => ({
    report_id: report.id,
    rubric_id: item.rubricId ?? null,
    rubric_title_snapshot: item.rubricTitleSnapshot,
    rubric_goal_snapshot: item.rubricGoalSnapshot ?? null,
    rubric_task_snapshot: item.rubricTaskSnapshot ?? null,
    rubric_level_high_snapshot: item.rubricLevelHighSnapshot ?? null,
    rubric_level_mid_snapshot: item.rubricLevelMidSnapshot ?? null,
    rubric_level_low_snapshot: item.rubricLevelLowSnapshot ?? null,
    grade: item.grade,
    teacher_feedback: item.teacherFeedback ?? null,
    sort_order: item.sortOrder ?? idx
  }));

  const { error: itemsError } = await supabaseAdmin.from('eval_report_items').insert(itemRows);
  if (itemsError) {
    await supabaseAdmin.from('eval_reports').delete().eq('id', report.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ report }, { status: 201 });
}
