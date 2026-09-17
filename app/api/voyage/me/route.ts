import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDate } from '@/lib/date';
import { getStars } from '@/lib/voyage';

export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  await supabaseAdmin.from('voyage_state').upsert(
    { student_id: auth.student.id },
    { onConflict: 'student_id', ignoreDuplicates: true },
  );

  const today = todayDate();
  const [
    stateRes,
    stars,
    ledgerRes,
    todayLedgerRes,
    arrivalsRes,
  ] = await Promise.all([
    supabaseAdmin.from('voyage_state').select('*').eq('student_id', auth.student.id).single(),
    getStars(supabaseAdmin),
    supabaseAdmin.from('fuel_ledger').select('*').eq('student_id', auth.student.id).order('created_at', { ascending: false }).limit(8),
    // 오늘 연료와 미션 완료는 오늘 원장 전체로 판단한다.
    // 최근 기록(8건)만 보면 뱃지 연료가 겹치는 날 합계가 빠지고,
    // 활동 테이블을 보면 연료를 못 받은 기록도 "완료"로 표시된다.
    supabaseAdmin.from('fuel_ledger').select('source_type,amount').eq('student_id', auth.student.id).eq('earned_on', today),
    supabaseAdmin.from('star_arrivals').select('star_level,arrived_at').eq('student_id', auth.student.id),
  ]);

  if (stateRes.error || ledgerRes.error || todayLedgerRes.error) {
    return NextResponse.json(
      { error: stateRes.error?.message ?? ledgerRes.error?.message ?? todayLedgerRes.error?.message },
      { status: 500 },
    );
  }

  const todayLedger = todayLedgerRes.data ?? [];
  const todayFuel = todayLedger
    .filter((entry) => entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const countSource = (source: string) => todayLedger.filter((entry) => entry.source_type === source).length;

  return NextResponse.json({
    student: { id: auth.student.id, name: auth.student.name },
    state: stateRes.data,
    stars,
    arrivals: arrivalsRes.data ?? [],
    recentLog: ledgerRes.data ?? [],
    todayFuel,
    missions: {
      plan: countSource('plan_check') > 0,
      emotion: countSource('emotion_feed') > 0,
      reflection: countSource('reflection') > 0,
      letterCount: countSource('letter'),
    },
  });
}
