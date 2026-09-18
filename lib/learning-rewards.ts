import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkAndAwardBadge } from '@/lib/badges';
import { grantBadgeFuel, grantFuel } from '@/lib/voyage';

/**
 * 배움성찰 제출 보상 — 별빛 퀘스트(성찰 뱃지)와 별빛 여행(reflection 연료).
 *
 * 제출은 마지막으로 채운 것이 무엇이든 완료된다(답변 저장, 결과물 올리기, 링크 등록).
 * 그래서 제출 판정(recalcSubmissionStatus)을 하는 학생 라우트는 모두, 제출이 완료됐으면 이 함수를 부른다.
 * 여러 번 불려도 안전하다 — 연료는 source_id(제출물 id)의 unique 제약과 하루 상한이,
 * 뱃지는 이미 받은 뱃지를 다시 주지 않는 checkAndAwardBadge가 중복을 막는다.
 *
 * 보상 실패가 학생의 저장을 되돌리지 않도록 오류는 로그만 남긴다.
 */
export async function rewardLearningSubmission(studentId: string, submissionId: string) {
  let newBadges: Awaited<ReturnType<typeof checkAndAwardBadge>> = [];
  try {
    newBadges = await checkAndAwardBadge(supabaseAdmin, studentId, 'reflection_save');
  } catch (badgeError) {
    console.error('[badges] 배움성찰 뱃지 확인 실패:', badgeError);
  }
  try {
    await grantFuel(supabaseAdmin, studentId, 'reflection', submissionId);
    await grantBadgeFuel(supabaseAdmin, studentId, newBadges);
  } catch (fuelError) {
    console.error('[voyage] 배움성찰 연료 지급 실패:', fuelError);
  }
  return newBadges;
}
