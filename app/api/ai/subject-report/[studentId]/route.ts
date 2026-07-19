import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { getAiUsage, logAiUsage } from '@/lib/ai/usage';
import { getSavedSubjectReport, generateAndSaveSubjectReport, NoEvalDataError } from '@/lib/ai/subjectReport';

type Params = { params: { studentId: string } };

// 종합평가는 학생의 전체 평가 이력을 프롬프트에 담아 토큰 사용량이 크므로 2회 차감한다.
const SUBJECT_REPORT_COST = 2;

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

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;
  const student = owned.student;

  const usage = await getAiUsage(auth.teacher);
  if (usage.remaining !== null && usage.remaining < SUBJECT_REPORT_COST) {
    return NextResponse.json(
      {
        error: `종합평가 분석에는 ${SUBJECT_REPORT_COST}회가 필요합니다. 남은 사용 횟수가 ${usage.remaining}회로 부족해 분석을 시작할 수 없습니다. 다음 달 1일에 초기화됩니다.`,
        usage,
      },
      { status: 429 }
    );
  }

  try {
    const result = await generateAndSaveSubjectReport(student.id, auth.teacher.id, student.student_number, student.name);
    await Promise.all(
      Array.from({ length: SUBJECT_REPORT_COST }, () => logAiUsage(auth.teacher.id, 'subject_report', student.id))
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NoEvalDataError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[ai/subject-report] 생성 실패:', (err as Error).message);
    return NextResponse.json({ error: 'AI 분석 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
