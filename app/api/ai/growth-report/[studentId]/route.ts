import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, requireTeacherStudent } from '@/lib/auth';
import { getAiUsage, logAiUsage, quotaExceededResponse } from '@/lib/ai/usage';
import { isPeriod, type Period } from '@/lib/stats';
import { getOrGenerateGrowthReport, getSavedGrowthReport, InsufficientDataError } from '@/lib/ai/growthReport';

type Params = { params: { studentId: string } };

const bodySchema = z.object({
  period: z.string().refine(isPeriod, { message: 'period는 week/month/semester 중 하나여야 합니다.' }),
  forceRefresh: z.boolean().optional(),
});

// 학생 선택 시 저장된 성장 리포트를 자동으로 불러온다 (없으면 report: null)
export async function GET(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;

  const url = new URL(req.url);
  const periodParam = url.searchParams.get('period');
  const period: Period = isPeriod(periodParam) ? periodParam : 'month';

  const report = await getSavedGrowthReport(params.studentId, period);
  return NextResponse.json({ report });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const owned = await requireTeacherStudent(auth.teacher.id, params.studentId);
  if ('error' in owned) return owned.error;
  const student = owned.student;

  const usage = await getAiUsage(auth.teacher);
  if (usage.remaining !== null && usage.remaining <= 0) {
    return quotaExceededResponse(usage);
  }

  try {
    const result = await getOrGenerateGrowthReport(
      student.id,
      auth.teacher.id,
      student.student_number,
      student.name,
      parsed.data.period,
      parsed.data.forceRefresh ?? false,
    );
    // 캐시 반환은 OpenAI를 호출하지 않으므로 사용량에서 제외
    if (!result.cached) {
      await logAiUsage(auth.teacher.id, 'growth_report', student.id);
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InsufficientDataError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[ai/growth-report] 생성 실패:', (err as Error).message);
    return NextResponse.json({ error: 'AI 분석 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
