import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { who } from '@/lib/starboard/access';
import { dbFail, isUuid, notFoundResponse } from '@/lib/starboard/http';

type Params = { params: { boardId: string; studentId: string } };

/**
 * 평가 보기(원본 getReviewSummary): 교사 평가 + 동료평가 평균·인원.
 * 학생은 자기 것만(교사 평가는 공개된 것만), 평가자는 드러나지 않는다. 판정은 sb_get_review_summary가 한다.
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  if (!isUuid(params.boardId) || !isUuid(params.studentId)) return notFoundResponse();
  const { data, error } = await supabaseAdmin.rpc('sb_get_review_summary', {
    p_board: params.boardId,
    p_target: params.studentId,
    ...who(auth.actor),
  });
  if (error) return dbFail(error);
  return NextResponse.json({ summary: data ?? null });
}
