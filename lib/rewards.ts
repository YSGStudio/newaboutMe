import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkAndAwardBadge, type AwardedBadge, type BadgeTrigger } from '@/lib/badges';
import { grantBadgeFuel, grantFuel, type FuelSource } from '@/lib/voyage';

/**
 * 학생 활동 보상 — 별빛 퀘스트(뱃지)와 별빛 여행(연료)을 한 번에 처리한다.
 *
 * 뱃지 확인과 활동 연료 지급은 서로의 결과를 쓰지 않아서 함께 돌린다.
 * 새 뱃지에 붙는 연료(grantBadgeFuel)는 같은 항해 상태를 고치는 grantFuel과
 * 겹치면 안 되므로 활동 연료가 끝난 뒤에 지급한다.
 *
 * 보상 실패가 학생의 저장을 되돌리지 않도록 오류는 로그만 남긴다.
 *
 * @param label 로그에 남길 활동 이름(예: '감정 기록')
 */
export async function rewardStudentAction(
  studentId: string,
  trigger: BadgeTrigger,
  fuelSource: FuelSource,
  sourceId: string,
  label: string,
): Promise<AwardedBadge[]> {
  const [badgeResult, fuelResult] = await Promise.allSettled([
    checkAndAwardBadge(supabaseAdmin, studentId, trigger),
    grantFuel(supabaseAdmin, studentId, fuelSource, sourceId),
  ]);

  let newBadges: AwardedBadge[] = [];
  if (badgeResult.status === 'fulfilled') {
    newBadges = badgeResult.value;
  } else {
    console.error(`[badges] ${label} 뱃지 확인 실패:`, badgeResult.reason);
  }
  if (fuelResult.status === 'rejected') {
    console.error(`[voyage] ${label} 연료 지급 실패:`, fuelResult.reason);
  }

  try {
    await grantBadgeFuel(supabaseAdmin, studentId, newBadges);
  } catch (fuelError) {
    console.error(`[voyage] ${label} 뱃지 연료 지급 실패:`, fuelError);
  }
  return newBadges;
}
