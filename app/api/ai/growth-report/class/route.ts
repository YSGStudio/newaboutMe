import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher } from '@/lib/auth';
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

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', parsed.data.classId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!cls) return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 });

  const { data: students, error: studentsError } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number')
    .eq('class_id', parsed.data.classId)
    .order('student_number', { ascending: true });

  if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 500 });
  if (!students || students.length === 0) {
    return NextResponse.json({ results: [], total: 0, succeeded: 0, failed: 0 });
  }

  const results = await processInChunks(students, async (s): Promise<StudentResult> => {
    try {
      const result = await getOrGenerateGrowthReport(
        s.id,
        auth.teacher.id,
        s.student_number,
        s.name,
        parsed.data.period,
        parsed.data.forceRefresh ?? false,
      );
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
