import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherClass } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAiUsage } from '@/lib/ai/usage';
import { getSavedSubjectsByStudent } from '@/lib/ai/learningSubjectReport';

// AI생성 탭 학생 목록 — 학급 학생과 학생별로 저장된 교과발달상황 과목 (교사 전용)

export async function GET(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const classId = new URL(req.url).searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'classId가 필요합니다.' }, { status: 400 });

  const forbidden = await requireTeacherClass(auth.teacher.id, classId);
  if (forbidden) return forbidden;

  const { data: students, error } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number')
    .eq('class_id', classId)
    .order('student_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roster = students ?? [];
  const [saved, usage] = await Promise.all([
    getSavedSubjectsByStudent(roster.map((s) => s.id)),
    getAiUsage(auth.teacher),
  ]);

  return NextResponse.json({
    usage,
    students: roster.map((student) => ({ ...student, savedSubjects: saved.get(student.id) ?? [] })),
  });
}
