import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 보드 전체 평가 공개/공개 취소(원본 setEvaluationPublished(board, null, …)). 작성된 평가 모두. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  if (typeof body.published !== 'boolean') return jsonError('요청이 올바르지 않습니다.', 400);
  const { error, count } = await supabaseAdmin
    .from('sb_evaluations')
    .update({ published: body.published }, { count: 'exact' })
    .eq('board_id', ctx.board.id);
  if (error) return dbFail(error);
  return NextResponse.json({ count: count ?? 0 });
}
