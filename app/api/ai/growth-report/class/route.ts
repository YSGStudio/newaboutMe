import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, requireTeacherClass, hasActivePaidPlan } from '@/lib/auth';
import { getAiUsage, logAiUsage } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isPeriod } from '@/lib/stats';
import { getOrGenerateGrowthReport, InsufficientDataError } from '@/lib/ai/growthReport';
import {
  getSavedHollandReport,
  generateAndSaveHollandReport,
  InsufficientHollandDataError,
  type HollandReportApiResult,
} from '@/lib/ai/hollandReport';

const bodySchema = z.object({
  classId: z.string().uuid(),
  period: z.string().refine(isPeriod, { message: 'period는 week/month/semester 중 하나여야 합니다.' }),
  forceRefresh: z.boolean().optional(),
});

// OpenAI rate limit을 고려해 한 번에 이 개수만큼만 동시 호출(=5명씩 배치 처리)
const CONCURRENCY = 5;
// 전체분석은 개별분석과 동일하게 성장 1회 + 홀란드 1회 = 학생 1명당 최대 2회 차감한다.
// (이미 분석된 항목은 재사용하며 차감하지 않는다)
const GROWTH_COST = 1;
const HOLLAND_COST = 1;
const MAX_COST_PER_STUDENT = GROWTH_COST + HOLLAND_COST;

type GrowthReportContent = {
  planAnalysis: string;
  emotionInsight: string;
  growthSuggestion: string;
  generatedAt: string;
};

type StudentResult = {
  studentId: string;
  status: 'success' | 'error';
  message?: string; // 성장분석 실패 사유 (성장분석 기준으로 성공/실패를 판단)
  // 성공 시 생성된(또는 캐시된) 분석 결과를 그대로 담아 반환한다.
  // 프론트가 DB를 다시 읽지 않고 이 값을 바로 PDF에 사용하도록 하기 위함.
  report?: GrowthReportContent;
  holland?: HollandReportApiResult | null; // 홀란드 결과 (없거나 실패 시 null)
  hollandMessage?: string;                  // 홀란드 실패 사유
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

  // 성장 1 + 홀란드 1 = 학생당 최대 2회. 시작 전 최악의 경우(전원 신규 생성)를 미리 확보한다.
  const usage = await getAiUsage(auth.teacher);
  const required = students.length * MAX_COST_PER_STUDENT;
  if (usage.remaining !== null && usage.remaining < required) {
    return NextResponse.json(
      {
        error: `전체 분석에는 최대 ${required}회가 필요합니다(학생 ${students.length}명 × 2: 성장 1 + 홀란드 1). 남은 사용 횟수가 ${usage.remaining}회로 부족해 분석을 시작할 수 없습니다.`,
        usage,
      },
      { status: 429 }
    );
  }

  // 5명 단위(청크)로 동시 분석하고, 한 청크가 끝날 때마다 그 청크에서 새로 생성된(캐시/재사용 아닌)
  // 성장·홀란드 각각의 건수만큼 차감한다. 위에서 최대 필요량을 미리 확인했으므로 중간 초과는 없다.
  const results: StudentResult[] = [];

  for (let i = 0; i < students.length; i += CONCURRENCY) {
    const chunk = students.slice(i, i + CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (s): Promise<StudentResult & { growthGenerated: boolean; hollandGenerated: boolean }> => {
        // --- 성장분석: 오늘자 캐시가 있으면 재사용(차감 없음) ---
        let report: GrowthReportContent | undefined;
        let growthGenerated = false;
        let status: 'success' | 'error' = 'success';
        let message: string | undefined;
        try {
          const g = await getOrGenerateGrowthReport(
            s.id,
            auth.teacher.id,
            s.student_number,
            s.name,
            parsed.data.period,
            parsed.data.forceRefresh ?? false,
          );
          report = {
            planAnalysis: g.planAnalysis,
            emotionInsight: g.emotionInsight,
            growthSuggestion: g.growthSuggestion,
            generatedAt: g.generatedAt,
          };
          growthGenerated = !g.cached;
        } catch (err) {
          status = 'error';
          message = err instanceof InsufficientDataError ? err.message : (err as Error).message;
          if (!(err instanceof InsufficientDataError)) {
            console.error(`[ai/growth-report/class] 학생 ${s.id} 성장분석 실패:`, message);
          }
        }

        // --- 홀란드분석: 이미 저장된 결과가 있으면 재사용(차감 없음), 없으면 새로 생성 ---
        let holland: HollandReportApiResult | null = null;
        let hollandGenerated = false;
        let hollandMessage: string | undefined;
        try {
          const saved = await getSavedHollandReport(s.id);
          if (saved) {
            holland = saved;
          } else {
            holland = await generateAndSaveHollandReport(s.id, auth.teacher.id, s.student_number, s.name);
            hollandGenerated = true;
          }
        } catch (err) {
          hollandMessage = err instanceof InsufficientHollandDataError ? err.message : (err as Error).message;
          if (!(err instanceof InsufficientHollandDataError)) {
            console.error(`[ai/growth-report/class] 학생 ${s.id} 홀란드분석 실패:`, hollandMessage);
          }
        }

        return { studentId: s.id, status, message, report, holland, hollandMessage, growthGenerated, hollandGenerated };
      })
    );

    // 이 청크에서 새로 생성된 성장·홀란드 건수만큼 각각 차감(로그)한다.
    const logs: Promise<void>[] = [];
    chunkResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        const { growthGenerated, hollandGenerated, ...studentResult } = r.value;
        results.push(studentResult);
        if (growthGenerated) {
          for (let n = 0; n < GROWTH_COST; n += 1) logs.push(logAiUsage(auth.teacher.id, 'growth_report', studentResult.studentId));
        }
        if (hollandGenerated) {
          for (let n = 0; n < HOLLAND_COST; n += 1) logs.push(logAiUsage(auth.teacher.id, 'holland_report', studentResult.studentId));
        }
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
