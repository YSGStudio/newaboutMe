import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { authorColumns, loadBoard } from '@/lib/starboard/access';
import { logActivities } from '@/lib/starboard/activity';
import { cleanCard } from '@/lib/starboard/inputs';
import { dbFail, forbiddenResponse, isUuid, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 카드 쓰기(원본 createCard). 교사, 또는 수정 권한이 있는 학생만. 작성자는 세션으로 정한다. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadBoard(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  if (!ctx.canWrite) return forbiddenResponse('이 작업장에는 카드를 쓸 수 없어요.');
  const body = await readJson(req);
  if (typeof body.columnId !== 'string' || !isUuid(body.columnId)) return jsonError('섹션을 찾을 수 없습니다.', 400);
  const v = cleanCard(body);
  if (typeof v === 'string') return jsonError(v, 400);
  const position = typeof body.position === 'number' && Number.isFinite(body.position) ? body.position : 1;
  const { data, error } = await supabaseAdmin
    .from('sb_cards')
    .insert({ ...v, board_id: ctx.board.id, column_id: body.columnId, position, ...authorColumns(auth.actor, 'author') })
    .select('id')
    .single();
  if (error) return dbFail(error);
  await logActivities(auth.actor, [
    { board_id: ctx.board.id, card_id: data.id as string, card_title: v.title, action: 'create', to_column: body.columnId },
  ]);
  return NextResponse.json({ id: data.id });
}
