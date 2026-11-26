import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireColumnTeacher } from '@/lib/starboard/access';
import { logActivities } from '@/lib/starboard/activity';
import { cleanColumnName, isColor } from '@/lib/starboard/inputs';
import { isNoticeColumn, noticePosition } from '@/lib/starboard/columns';
import { dbFail, jsonError, readJson } from '@/lib/starboard/http';
import { cardFilePaths, removeStoragePaths } from '@/lib/starboard/storage';

type Params = { params: { columnId: string } };

/** 교사: 섹션 이름·색·가리기 적용(원본 updateColumn). 이름을 공지사항으로 바꾸면 맨 앞으로 옮긴다. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireColumnTeacher(auth.actor, params.columnId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = cleanColumnName(body.name);
    if (typeof name !== 'string') return jsonError(name.error, 400);
    patch.name = name;
    // 이름을 공지사항으로 바꾸면 맨 앞으로 옮긴다.
    if (isNoticeColumn(name)) {
      const { data: cols } = await supabaseAdmin.from('sb_columns').select('id, position').eq('board_id', ctx.board.id);
      const others = (cols ?? []).filter((c) => c.id !== ctx.columnId).map((c) => c.position as number);
      patch.position = noticePosition(others);
    }
  }
  if (body.color !== undefined) {
    if (!isColor(body.color)) return jsonError('색 형식이 올바르지 않습니다.', 400);
    patch.color = body.color;
  }
  if (body.hide_applies !== undefined) {
    if (typeof body.hide_applies !== 'boolean') return jsonError('설정 값이 올바르지 않습니다.', 400);
    patch.hide_applies = body.hide_applies;
  }
  if (!Object.keys(patch).length) return jsonError('바꿀 내용이 없습니다.', 400);
  const { error } = await supabaseAdmin.from('sb_columns').update(patch).eq('id', ctx.columnId);
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}

/** 교사: 섹션 삭제(원본 deleteColumn). 그 섹션의 카드와 첨부 파일까지 지운다. 원본 트리거처럼 카드마다 삭제 기록을 남긴다. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireColumnTeacher(auth.actor, params.columnId);
  if ('error' in ctx) return ctx.error;
  const { data: cards } = await supabaseAdmin.from('sb_cards').select('id, title').eq('column_id', ctx.columnId);
  const paths = await cardFilePaths((cards ?? []).map((c) => c.id as string));
  const { error } = await supabaseAdmin.from('sb_columns').delete().eq('id', ctx.columnId);
  if (error) return dbFail(error);
  await logActivities(
    auth.actor,
    (cards ?? []).map((c) => ({
      board_id: ctx.board.id,
      card_id: c.id as string,
      card_title: c.title as string,
      action: 'delete' as const,
      from_column: ctx.columnId,
    })),
  );
  await removeStoragePaths(paths);
  return NextResponse.json({ ok: true });
}
