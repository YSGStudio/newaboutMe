import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { denyEvalStudent } from '@/lib/eval-access';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';
import { checkAndAwardBadge, type AwardedBadge } from '@/lib/badges';
import { grantBadgeFuel, grantFuel } from '@/lib/voyage';

type Params = { params: { reportId: string } };

const schema = z.object({ content: z.string().min(1).max(500) });

export async function POST(req: Request, { params }: Params) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  // 평가피드백은 관리자 학급에만 열려 있다(lib/features.ts).
  const denied = await denyEvalStudent(auth.student.classes.teacher_id);
  if (denied) return denied;

  // 본인 보고서인지 확인
  const { data: report } = await supabaseAdmin
    .from('eval_reports')
    .select('id')
    .eq('id', params.reportId)
    .eq('student_id', auth.student.id)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });

  // 이미 작성했는지 확인
  const { data: existing } = await supabaseAdmin
    .from('eval_reflections')
    .select('id')
    .eq('report_id', params.reportId)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: '성찰일기는 한 번만 작성할 수 있습니다.' }, { status: 409 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('eval_reflections')
    .insert({ report_id: params.reportId, student_id: auth.student.id, content: parsed.data.content })
    .select('id,content,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let newBadges: AwardedBadge[] = [];
  try {
    newBadges = await checkAndAwardBadge(supabaseAdmin, auth.student.id, 'reflection_save');
  } catch (badgeError) {
    // 뱃지 확인이 실패해도 이미 저장된 기록과 연료 지급은 이어서 처리한다.
    console.error('[badges] 성찰 뱃지 확인 실패:', badgeError);
  }
  try {
    await grantFuel(supabaseAdmin, auth.student.id, 'reflection', data.id);
    await grantBadgeFuel(supabaseAdmin, auth.student.id, newBadges);
  } catch (fuelError) {
    console.error('[voyage] 성찰 연료 지급 실패:', fuelError);
  }
  return NextResponse.json({ reflection: data, newBadges }, { status: 201 });
}
