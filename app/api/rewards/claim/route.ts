import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rewardStudentAction } from '@/lib/rewards';

const claimSchema = z.object({
  kind: z.enum(['emotion', 'letter', 'learning']),
  sourceId: z.string().uuid(),
});

/**
 * 저장과 보상을 분리한다. sourceId의 소유권과 완료 상태를 서버에서 다시 확인하므로
 * 다른 학생의 활동을 넣어 보상을 받을 수 없다. 지급 함수는 중복 호출에도 안전하다.
 */
export async function POST(req: Request) {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const parsed = claimSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '잘못된 보상 요청이에요.' }, { status: 400 });

  const { kind, sourceId } = parsed.data;
  let exists = false;
  if (kind === 'emotion') {
    const { data } = await supabaseAdmin.from('emotion_feeds').select('id').eq('id', sourceId).eq('student_id', auth.student.id).maybeSingle();
    exists = Boolean(data);
  } else if (kind === 'letter') {
    const { data } = await supabaseAdmin.from('letters').select('id').eq('id', sourceId).eq('sender_id', auth.student.id).maybeSingle();
    exists = Boolean(data);
  } else {
    const { data } = await supabaseAdmin.from('learning_submissions').select('id').eq('id', sourceId).eq('student_id', auth.student.id).eq('status', 'submitted').maybeSingle();
    exists = Boolean(data);
  }

  if (!exists) return NextResponse.json({ error: '보상 대상을 찾을 수 없어요.' }, { status: 404 });

  const newBadges = kind === 'emotion'
    ? await rewardStudentAction(auth.student.id, 'emotion_save', 'emotion_feed', sourceId, '감정 기록')
    : kind === 'letter'
      ? await rewardStudentAction(auth.student.id, 'mail_send', 'letter', sourceId, '편지')
      : await rewardStudentAction(auth.student.id, 'reflection_save', 'reflection', sourceId, '배움성찰');

  return NextResponse.json({ newBadges });
}
