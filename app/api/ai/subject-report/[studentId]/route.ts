import { NextResponse } from 'next/server';
import { requireTeacher, requireAiAccess, requireTeacherStudent } from '@/lib/auth';
import { getAiUsage, logAiUsage, quotaExceededResponse } from '@/lib/ai/usage';
import { getSavedSubjectReport, generateAndSaveSubjectReport, NoEvalDataError } from '@/lib/ai/subjectReport';

type Params = { params: { studentId: string } };

// 학생 선택 시 자동으로 저장된 분석 결과를 불러온다 (없으면 report: null)
export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;

  const report = await getSavedSubjectReport(params.studentId);
  return NextResponse.json({ report });
}

// "AI 분석" 버튼 — 항상 새로 분석하고 기존 저장 결과를 덮어쓴다
export async function POST(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const aiBlock = requireAiAccess(auth.teacher);
  if (aiBlock) return aiBlock;

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;
  const student = owned.student;

  const usage = await getAiUsage(auth.teacher);
  if (usage.remaining !== null && usage.remaining <= 0) {
    return quotaExceededResponse(usage);
  }

  try {
    const result = await generateAndSaveSubjectReport(student.id, auth.teacher.id, student.student_number, student.name);
    await logAiUsage(auth.teacher.id, 'subject_report', student.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NoEvalDataError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[ai/subject-report] 생성 실패:', (err as Error).message);
    return NextResponse.json({ error: 'AI 분석 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
