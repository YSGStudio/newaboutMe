import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

async function target(req: Request, params: Params['params']) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx;
  const body = await readJson(req);
  if (typeof body.criterionId !== 'string' || !isUuid(body.criterionId)) return { error: jsonError('기준을 고르세요.', 400) };
  return { ctx, body, criterionId: body.criterionId };
}

/** 교사: 기준 붙이기(원본 attachCriterion). 내 기준·공용 작업장인지는 DB 트리거가 확인한다. */
export async function POST(req: Request, { params }: Params) {
  const t = await target(req, params);
  if ('error' in t) return t.error;
  const { data: existing } = await supabaseAdmin
    .from('sb_board_criteria')
    .select('position')
    .eq('board_id', t.ctx.board.id)
    .order('position', { ascending: false })
    .limit(1);
  const { error } = await supabaseAdmin
    .from('sb_board_criteria')
    .insert({ board_id: t.ctx.board.id, criterion_id: t.criterionId, position: ((existing?.[0]?.position as number | undefined) ?? 0) + 1 });
  if (error) {
    if (error.message.includes('must be shared')) return jsonError('공용 작업장에 내 기준만 붙일 수 있습니다.', 400);
    return dbFail(error);
  }
  return NextResponse.json({ ok: true });
}

/** 교사: 기준 떼기(원본 detachCriterion) */
export async function DELETE(req: Request, { params }: Params) {
  const t = await target(req, params);
  if ('error' in t) return t.error;
  const { error } = await supabaseAdmin.from('sb_board_criteria').delete().eq('board_id', t.ctx.board.id).eq('criterion_id', t.criterionId);
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}

/** 교사: 기준 순서 위/아래(원본 reorderBoardCriterion) */
export async function PATCH(req: Request, { params }: Params) {
  const t = await target(req, params);
  if ('error' in t) return t.error;
  const direction = t.body.direction === 'up' ? 'up' : 'down';
  const { data } = await supabaseAdmin.from('sb_board_criteria').select('criterion_id').eq('board_id', t.ctx.board.id).order('position');
  const order = (data ?? []).map((r) => r.criterion_id as string);
  const i = order.indexOf(t.criterionId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return NextResponse.json({ ok: true });
  [order[i], order[j]] = [order[j], order[i]];
  for (const [k, id] of order.entries()) {
    const { error } = await supabaseAdmin
      .from('sb_board_criteria')
      .update({ position: k + 1 })
      .eq('board_id', t.ctx.board.id)
      .eq('criterion_id', id);
    if (error) return dbFail(error);
  }
  return NextResponse.json({ ok: true });
}
