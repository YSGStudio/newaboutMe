import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireCardWriter } from '@/lib/starboard/access';
import { contentChanged, logActivities } from '@/lib/starboard/activity';
import { cleanCard } from '@/lib/starboard/inputs';
import { dbFail, jsonError, readJson } from '@/lib/starboard/http';
import { cardFilePaths, removeStoragePaths } from '@/lib/starboard/storage';

type Params = { params: { cardId: string } };

/** 카드 수정(원본 updateCard). 자기 카드만, 교사는 모두. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireCardWriter(auth.actor, params.cardId, '권한이 없습니다. 자기 카드만 수정할 수 있습니다.');
  if ('error' in ctx) return ctx.error;
  const v = cleanCard(await readJson(req));
  if (typeof v === 'string') return jsonError(v, 400);
  const { error } = await supabaseAdmin.from('sb_cards').update(v).eq('id', ctx.card.id);
  if (error) return dbFail(error);
  if (contentChanged(ctx.card, v)) {
    await logActivities(auth.actor, [
      { board_id: ctx.board.id, card_id: ctx.card.id, card_title: v.title, action: 'update', from_column: ctx.card.column_id, to_column: ctx.card.column_id },
    ]);
  }
  return NextResponse.json({ ok: true });
}

/** 카드 삭제(원본 deleteCard). 첨부 파일까지 지운다. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireCardWriter(auth.actor, params.cardId, '권한이 없습니다. 자기 카드만 삭제할 수 있습니다.');
  if ('error' in ctx) return ctx.error;
  const paths = await cardFilePaths([ctx.card.id]);
  const { error } = await supabaseAdmin.from('sb_cards').delete().eq('id', ctx.card.id);
  if (error) return dbFail(error);
  await logActivities(auth.actor, [
    { board_id: ctx.board.id, card_id: ctx.card.id, card_title: ctx.card.title, action: 'delete', from_column: ctx.card.column_id },
  ]);
  await removeStoragePaths(paths);
  return NextResponse.json({ ok: true });
}
