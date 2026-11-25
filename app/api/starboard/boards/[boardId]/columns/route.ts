import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher } from '@/lib/starboard/access';
import { MAX_COLUMNS, canAddColumn } from '@/lib/starboard/columns';
import { cleanColumnName, isColor } from '@/lib/starboard/inputs';
import { dbFail, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { boardId: string } };

/** 교사: 섹션 추가(원본 addColumn). 맨 오른쪽에 붙는다. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const name = cleanColumnName(body.name);
  if (typeof name !== 'string') return jsonError(name.error, 400);
  if (!isColor(body.color)) return jsonError('색 형식이 올바르지 않습니다.', 400);
  const { data: cols } = await supabaseAdmin.from('sb_columns').select('position').eq('board_id', ctx.board.id);
  if (!canAddColumn(cols?.length ?? 0)) return jsonError(`열은 최대 ${MAX_COLUMNS}개까지 만들 수 있습니다.`, 400);
  const position = Math.max(0, ...(cols ?? []).map((c) => c.position as number)) + 1;
  const { error } = await supabaseAdmin.from('sb_columns').insert({ board_id: ctx.board.id, name, color: body.color, position });
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}
