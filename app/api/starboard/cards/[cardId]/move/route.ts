import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireCardWriter } from '@/lib/starboard/access';
import { logActivities } from '@/lib/starboard/activity';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { cardId: string } };

/** 카드 옮기기(원본 moveCard). 같은 작업장 안 섹션 사이·섹션 안. 자기 카드만, 교사는 모두. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireCardWriter(auth.actor, params.cardId, '권한이 없습니다. 자기 카드만 옮길 수 있습니다.');
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  if (typeof body.columnId !== 'string' || !isUuid(body.columnId)) return jsonError('섹션을 찾을 수 없습니다.', 400);
  if (typeof body.position !== 'number' || !Number.isFinite(body.position)) return jsonError('위치가 올바르지 않습니다.', 400);
  const { error } = await supabaseAdmin
    .from('sb_cards')
    .update({ column_id: body.columnId, position: body.position })
    .eq('id', ctx.card.id);
  if (error) return dbFail(error);
  if (body.columnId !== ctx.card.column_id) {
    await logActivities(auth.actor, [
      { board_id: ctx.board.id, card_id: ctx.card.id, card_title: ctx.card.title, action: 'move', from_column: ctx.card.column_id, to_column: body.columnId },
    ]);
  }
  return NextResponse.json({ ok: true });
}
