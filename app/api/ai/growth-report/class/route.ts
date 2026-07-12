import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, requireAiAccess, requireTeacherClass } from '@/lib/auth';
import { getAiUsage, logAiUsage, quotaExceededResponse } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isPeriod } from '@/lib/stats';
import { getOrGenerateGrowthReport, InsufficientDataError } from '@/lib/ai/growthReport';

const bodySchema = z.object({
  classId: z.string().uuid(),
  period: z.string().refine(isPeriod, { message: 'period는 week/month/semester 중 하나여야 합니다.' }),
  forceRefresh: z.boolean().optional(),
});

// OpenAI rate limit을 고려해 한 번에 이 개수만큼만 동시 호출
const CONCURRENCY = 5;

type StudentResult = { studentId: string; status: 'success' | 'error'; cached?: boolean; message?: string };

async function processInChunks(
  students: { id: string; name: string; student_number: number }[],
  worker: (s: { id: string; name: string; student_number: number }) => Promise<StudentResult>,
): Promise<StudentResult[]> {
  const results: StudentResult[] = [];
  for (let i = 0; i < students.length; i += CONCURRENCY) {
    const chunk = students.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.allSettled(chunk.map(worker));
    chunkResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ studentId: chunk[idx].id, status: 'error', message: (r.reason as Error)?.message ?? '알 수 없는 오류' });
      }
    });
  }
  return results;
}

export async function POST(req: Request) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const aiBlock = requireAiAccess(auth.teacher);
  if (aiBlock) return aiBlock;

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

  const usage = await getAiUsage(auth.teacher);
  if (usage.remaining !== null && usage.remaining <= 0) {
    return quotaExceededResponse(usage);
  }

  // 배치 도중 한도 소진 시 이후 학생은 건너뛴다. 캐시 반환은 사용량에서 제외.
  // (동시 실행 CHUNK 단위로 검사하므로 최대 CHUNK-1회 초과될 수 있음 — 허용 오차)
  let generatedCount = 0;

  const results = await processInChunks(students, async (s): Promise<StudentResult> => {
    if (usage.remaining !== null && generatedCount >= usage.remaining) {
      return { studentId: s.id, status: 'error', message: '이번 달 AI 분석 사용 한도를 모두 사용해 건너뛰었습니다.' };
    }
    try {
      const result = await getOrGenerateGrowthReport(
        s.id,
        auth.teacher.id,
        s.student_number,
        s.name,
        parsed.data.period,
        parsed.data.forceRefresh ?? false,
      );
      if (!result.cached) {
        generatedCount += 1;
        await logAiUsage(auth.teacher.id, 'growth_report', s.id);
      }
      return { studentId: s.id, status: 'success', cached: result.cached };
    } catch (err) {
      const message = err instanceof InsufficientDataError ? err.message : (err as Error).message;
      return { studentId: s.id, status: 'error', message };
    }
  });

  const succeeded = results.filter((r) => r.status === 'success').length;

  return NextResponse.json({
    results,
    total: students.length,
    succeeded,
    failed: students.length - succeeded,
  });
}
