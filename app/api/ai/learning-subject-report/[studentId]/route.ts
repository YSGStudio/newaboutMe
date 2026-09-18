import { NextResponse } from 'next/server';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { getAiUsage, logAiUsage } from '@/lib/ai/usage';
import { gatherLearningSubjectRecords } from '@/lib/ai/learningSubjectReportData';
import {
  generateLearningSubjectReports,
  getSavedLearningSubjectReports,
  NoLearningRecordError,
} from '@/lib/ai/learningSubjectReport';
import { learningSubjectReportSchema } from '@/lib/validators';

// AI생성 탭 — 한 학생의 배움성찰 기록(과목별)과 저장된 교과발달상황 조회, 과목별 생성 (교사 전용)
//
// 담당 학생인지 requireTeacherStudent로 먼저 확인한다(학생 → 학급 → 교사).
// 평가피드백 노출 플래그와 무관하게 모든 교사가 쓴다.

type Params = { params: { studentId: string } };

// 생성 1회는 고른 과목 수와 관계없이 2회 차감한다(기존 종합평가와 같은 비용).
const LEARNING_SUBJECT_REPORT_COST = 2;

// 자료 불러오기 — 교사 화면용이므로 학생 답변·자기평가까지 실명 화면 그대로 보여준다.
export async function GET(_: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;

  const [{ view }, saved, usage] = await Promise.all([
    gatherLearningSubjectRecords(owned.student.id, owned.student.class_id),
    getSavedLearningSubjectReports(owned.student.id),
    getAiUsage(auth.teacher),
  ]);

  return NextResponse.json({ subjects: view, saved, usage });
}

// 교과발달상황 생성 — 고른 과목만 새로 만들어 과목별로 덮어쓴다.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;
  const student = owned.student;

  const parsed = learningSubjectReportSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const usage = await getAiUsage(auth.teacher);
  if (usage.remaining !== null && usage.remaining < LEARNING_SUBJECT_REPORT_COST) {
    return NextResponse.json(
      {
        error: `교과발달상황 생성에는 ${LEARNING_SUBJECT_REPORT_COST}회가 필요합니다. 남은 사용 횟수가 ${usage.remaining}회로 부족해 생성을 시작할 수 없습니다. 다음 달 1일에 초기화됩니다.`,
        usage,
      },
      { status: 429 },
    );
  }

  try {
    const reports = await generateLearningSubjectReports({
      studentId: student.id,
      classId: student.class_id,
      studentNumber: student.student_number,
      teacherId: auth.teacher.id,
      subjects: parsed.data.subjects,
    });
    await Promise.all(
      Array.from({ length: LEARNING_SUBJECT_REPORT_COST }, () => logAiUsage(auth.teacher.id, 'subject_report', student.id)),
    );
    return NextResponse.json({ reports, usage: await getAiUsage(auth.teacher) });
  } catch (err) {
    if (err instanceof NoLearningRecordError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[ai/learning-subject-report] 생성 실패:', (err as Error).message);
    return NextResponse.json({ error: 'AI 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
