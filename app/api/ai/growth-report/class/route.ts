import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, requireTeacherClass, hasActivePaidPlan } from '@/lib/auth';
import { getAiUsage, logAiUsage } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isPeriod } from '@/lib/stats';
import { getOrGenerateGrowthReport, InsufficientDataError, type GrowthReportApiResult } from '@/lib/ai/growthReport';

const bodySchema = z.object({
  classId: z.string().uuid(),
  period: z.string().refine(isPeriod, { message: 'period는 week/month/semester 중 하나여야 합니다.' }),
  forceRefresh: z.boolean().optional(),
});

// OpenAI rate limit을 고려해 한 번에 이 개수만큼만 동시 호출(=5명씩 배치 처리)
const CONCURRENCY = 5;
// 성장·성향 분석이 한 번의 호출로 통합되어(2026-08-28) 학생 1명당 1회만 차감한다.
// (이미 오늘 분석된 학생은 캐시를 재사용하며 차감하지 않는다)
const MAX_COST_PER_STUDENT = 1;

// 성향(홀란드)까지 포함한 통합 리포트 본문. cached/dataSummary는 프론트에서 쓰지 않아 뺀다.
type GrowthReportContent = Omit<GrowthReportApiResult, 'cached' | 'dataSummary'>;

type StudentResult = {
  studentId: string;
  status: 'success' | 'error';
  message?: string; // 분석 실패 사유
  // 성공 시 생성된(또는 캐시된) 분석 결과를 그대로 담아 반환한다.
  // 프론트가 DB를 다시 읽지 않고 이 값을 바로 PDF에 사용하도록 하기 위함.
  report?: GrowthReportContent;
};

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 학급 전체 일괄 분석은 유료회원(또는 관리자) 전용 기능
  if (!hasActivePaidPlan(auth.teacher)) {
    return NextResponse.json(
      { error: '전체 분석하기는 유료회원만 사용할 수 있습니다. 학생을 개별 선택해 분석해주세요.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const forbidden = await requireTeacherClass(auth.teacher.id, parsed.data.classId);
  if (forbidden) return forbidden;

  const { data: students, error: studentsError } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', parsed.data.classId)
    .order('student_number', { ascending: true });

  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 });
  if (!students || students.length === 0) {
    return NextResponse.json({ results: [], total: 0, succeeded: 0, failed: 0 });
  }

  // 학생당 1회. 시작 전 최악의 경우(전원 신규 생성)를 미리 확보한다.
  const usage = await getAiUsage(auth.teacher);
  const required = students.length * MAX_COST_PER_STUDENT;
  if (usage.remaining !== null && usage.remaining < required) {
    return NextResponse.json(
      {
        error: `전체 분석에는 최대 ${required}회가 필요합니다(학생 ${students.length}명 × 1회). 남은 사용 횟수가 ${usage.remaining}회로 부족해 분석을 시작할 수 없습니다.`,
        usage,
      },
      { status: 429 }
    );
  }

  // 5명 단위(청크)로 동시 분석하고, 한 청크가 끝날 때마다 그 청크에서 새로 생성된
  // (캐시 재사용이 아닌) 건수만큼 차감한다. 위에서 최대 필요량을 확인했으므로 중간 초과는 없다.
  const results: StudentResult[] = [];

  for (let i = 0; i < students.length; i += CONCURRENCY) {
    const chunk = students.slice(i, i + CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (s): Promise<StudentResult & { generated: boolean }> => {
        // 성장·성향이 한 번에 나오므로 호출도 한 번이다. 오늘자 캐시가 있으면 재사용(차감 없음).
        try {
          // dataSummary는 프론트가 쓰지 않으므로 응답에서 뺀다.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { cached, dataSummary, ...report } = await getOrGenerateGrowthReport(
            s.id,
            auth.teacher.id,
            s.student_number,
            s.name,
            parsed.data.period,
            parsed.data.forceRefresh ?? false,
          );
          return { studentId: s.id, status: 'success', report, generated: !cached };
        } catch (err) {
          const message = err instanceof InsufficientDataError ? err.message : (err as Error).message;
          if (!(err instanceof InsufficientDataError)) {
            console.error(`[ai/growth-report/class] 학생 ${s.id} 분석 실패:`, message);
          }
          return { studentId: s.id, status: 'error', message, generated: false };
        }
      })
    );

    // 이 청크에서 새로 생성된 건수만큼 차감(로그)한다.
    const logs: Promise<void>[] = [];
    chunkResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        const { generated, ...studentResult } = r.value;
        results.push(studentResult);
        if (generated) logs.push(logAiUsage(auth.teacher.id, 'growth_report', studentResult.studentId));
      } else {
        results.push({ studentId: chunk[idx].id, status: 'error', message: (r.reason as Error)?.message ?? '알 수 없는 오류' });
      }
    });

    if (logs.length > 0) await Promise.all(logs);
  }

  const succeeded = results.filter((r) => r.status === 'success').length;

  return NextResponse.json({
    results,
    total: students.length,
    succeeded,
    failed: students.length - succeeded,
  });
}
