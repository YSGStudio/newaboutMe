import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadBoard } from '@/lib/starboard/access';
import { dbFail, forbiddenResponse, isUuid, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';
import { friendlyDbError } from '@/lib/starboard/errors';

type Params = { params: { boardId: string; targetId: string } };

/** 학생: 내가 그 친구에게 준 별점(원본 getMyPeerReview). 다시 열 때 채워 둔다. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  if (auth.actor.kind !== 'student') return NextResponse.json({ stars: {} });
  const ctx = await loadBoard(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  if (!isUuid(params.targetId)) return notFoundResponse();
  const { data } = await supabaseAdmin
    .from('sb_peer_reviews')
    .select('stars')
    .eq('board_id', ctx.board.id)
    .eq('reviewer_student_id', auth.actor.id)
    .eq('target_student_id', params.targetId)
    .maybeSingle();
  return NextResponse.json({ stars: data?.stars ?? {} });
}

/** 학생: 동료평가 저장(원본 savePeerReview → save_peer_review). 빈 별점이면 지운다. 검증은 DB 함수가 원본과 같게 한다. */
export async function PUT(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  if (auth.actor.kind !== 'student') return forbiddenResponse('학생만 동료평가를 할 수 있습니다.');
  if (!isUuid(params.boardId) || !isUuid(params.targetId)) return notFoundResponse();
  const body = await readJson(req);
  const clean: Record<string, number> = {};
  const raw = body.stars && typeof body.stars === 'object' && !Array.isArray(body.stars) ? (body.stars as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) clean[k] = v;
  const { data, error } = await supabaseAdmin.rpc('sb_save_peer_review', {
    p_board: params.boardId,
    p_reviewer: auth.actor.id,
    p_target: params.targetId,
    p_stars: clean,
  });
  if (error) {
    if (/PEER_[A-Z]+:/.test(error.message)) return jsonError(friendlyDbError(error.message), 403);
    return dbFail(error);
  }
  return NextResponse.json({ stars: data ?? {} });
}
