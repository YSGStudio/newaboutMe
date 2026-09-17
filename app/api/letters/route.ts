import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireStudentSession } from '@/lib/student-session';
import { checkAndAwardBadge, type AwardedBadge } from '@/lib/badges';
import { grantBadgeFuel, grantFuel } from '@/lib/voyage';

const letterCreateSchema = z.object({
  recipientId: z.string().uuid(),
  title: z.string().min(1).max(50),
  content: z.string().min(1).max(1000),
});

export async function POST(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const parsed = letterCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { recipientId, title, content } = parsed.data;

  if (recipientId === auth.student.id) {
    return NextResponse.json({ error: '자신에게는 편지를 보낼 수 없습니다.' }, { status: 400 });
  }

  const { data: recipient } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', recipientId)
    .eq('class_id', auth.student.class_id)
    .maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: '같은 학급 학생에게만 편지를 보낼 수 있습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('letters')
    .insert({
      class_id: auth.student.class_id,
      sender_id: auth.student.id,
      recipient_id: recipientId,
      title: title.trim(),
      content: content.trim(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let newBadges: AwardedBadge[] = [];
  try {
    newBadges = await checkAndAwardBadge(supabaseAdmin, auth.student.id, 'mail_send');
  } catch (badgeError) {
    // 뱃지 확인이 실패해도 이미 저장된 기록과 연료 지급은 이어서 처리한다.
    console.error('[badges] 편지 뱃지 확인 실패:', badgeError);
  }
  try {
    await grantFuel(supabaseAdmin, auth.student.id, 'letter', data.id);
    await grantBadgeFuel(supabaseAdmin, auth.student.id, newBadges);
  } catch (fuelError) {
    console.error('[voyage] 편지 연료 지급 실패:', fuelError);
  }
  return NextResponse.json({ letter: data, newBadges }, { status: 201 });
}
