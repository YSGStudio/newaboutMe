import { NextResponse } from 'next/server';
import { requireStudentSession } from '@/lib/student-session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStars } from '@/lib/voyage';

// 로그인 배너용 초경량 요약 — 대시보드 전체(/voyage/me)를 긁지 않고
// 연료량과 다음 기항지만 계산한다. (voyage_state 1쿼리 + 캐시된 stars)
export async function GET() {
  const auth = await requireStudentSession();
  if ('error' in auth) return auth.error;

  const [{ data: state }, stars] = await Promise.all([
    supabaseAdmin.from('voyage_state').select('total_fuel').eq('student_id', auth.student.id).maybeSingle(),
    getStars(supabaseAdmin),
  ]);

  const totalFuel = state?.total_fuel ?? 0;
  const nextStar = stars.find((star) => star.fuel_threshold > totalFuel) ?? null;

  return NextResponse.json({
    totalFuel,
    destination: nextStar
      ? { name: nextStar.name, emoji: nextStar.emoji, remainingFuel: nextStar.fuel_threshold - totalFuel }
      : null,
  });
}
