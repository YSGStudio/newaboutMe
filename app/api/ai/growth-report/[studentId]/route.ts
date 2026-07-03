import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, requireAiAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isPeriod } from '@/lib/stats';
import { getOrGenerateGrowthReport, InsufficientDataError } from '@/lib/ai/growthReport';

type Params = { params: { studentId: string } };

const bodySchema = z.object({
  period: z.string().refine(isPeriod, { message: 'period는 week/month/semester 중 하나여야 합니다.' }),
  forceRefresh: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;
  const aiBlock = requireAiAccess(auth.teacher);
  if (aiBlock) return aiBlock;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name, student_number, classes!inner(teacher_id)')
    .eq('id', params.studentId)
    .maybeSingle();

  if (!student || (student.classes as unknown as { teacher_id: string }).teacher_id !== auth.teacher.id) {
    return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
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
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InsufficientDataError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[ai/growth-report] 생성 실패:', (err as Error).message);
    return NextResponse.json({ error: 'AI 분석 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
