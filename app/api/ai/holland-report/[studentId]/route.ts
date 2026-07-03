import { NextResponse } from 'next/server';
import { requireTeacher, requireAiAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSavedHollandReport, generateAndSaveHollandReport, InsufficientHollandDataError } from '@/lib/ai/hollandReport';

type Params = { params: { studentId: string } };

async function loadStudentOrNull(studentId: string, teacherId: string) {
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number, classes!inner(teacher_id)')
    .eq('id', studentId)
    .maybeSingle();

  if (!student || (student.classes as unknown as { teacher_id: string }).teacher_id !== teacherId) {
    return null;
  }
  return student;
}

// 학생 선택 시 저장된 결과 조회 (없으면 report: null)
export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const student = await loadStudentOrNull(params.studentId, auth.teacher.id);
  if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });

  const report = await getSavedHollandReport(params.studentId);
  return NextResponse.json({ report });
}

// "AI 생성" 버튼 — 항상 새로 분석하고 기존 저장 결과를 덮어쓴다
export async function POST(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const aiBlock = requireAiAccess(auth.teacher);
  if (aiBlock) return aiBlock;

  const student = await loadStudentOrNull(params.studentId, auth.teacher.id);
  if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });

  try {
    const result = await generateAndSaveHollandReport(student.id, auth.teacher.id, student.student_number, student.name);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InsufficientHollandDataError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[ai/holland-report] 생성 실패:', (err as Error).message);
    return NextResponse.json({ error: 'AI 분석 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
