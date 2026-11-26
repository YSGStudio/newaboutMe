import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadBoard, requireBoardTeacher, who } from '@/lib/starboard/access';
import { cleanTemplate } from '@/lib/starboard/card-fields';
import type { BoardView } from '@/lib/starboard/types';
import type { Criterion } from '@/lib/starboard/criteria';
import { cleanBoardTitle } from '@/lib/starboard/inputs';
import { dbFail, jsonError, notFoundResponse, readJson } from '@/lib/starboard/http';
import { boardFilePaths, descendantBoardIds, removeStoragePaths } from '@/lib/starboard/storage';

type Params = { params: { boardId: string } };

/** 작업장 화면 데이터(원본 get_board_view). 가리기로 숨긴 데이터는 응답에 없다. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadBoard(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const { data, error } = await supabaseAdmin.rpc('sb_get_board_view', { p_board: ctx.board.id, ...who(auth.actor) });
  if (error) return dbFail(error);
  if (!data) return notFoundResponse();
  const view = data as BoardView;
  if (!ctx.isTeacher && !view.criteria.length && new URL(req.url).searchParams.get('rubric') === '1') {
    // 작업장에서 학생은 등록된 기준을 볼 수 있다. 점수와 피드백은 기존 공개 규칙을 따른다.
    const { data: rows, error: criteriaError } = await supabaseAdmin
      .from('sb_board_criteria')
      .select('criterion:sb_criteria(id, name, description, levels)')
      .eq('board_id', view.board.evaluation_board_id)
      .order('position');
    if (criteriaError) return dbFail(criteriaError);
    view.criteria = (rows ?? []).map((row) => row.criterion as unknown as Criterion);
  }
  return NextResponse.json({ view });
}

const HIDE = ['off', 'hidden', 'count', 'anonymous'];
const ACCESS = ['none', 'read', 'edit'];

/** 교사: 작업장 설정(원본 updateBoardSettings). 모두 공개/다시 가리기는 revealed만 바꾼다. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = cleanBoardTitle(body.title);
    if (typeof t !== 'string') return jsonError(t.error, 400);
    patch.title = t;
  }
  if (body.hide_mode !== undefined) {
    if (!HIDE.includes(body.hide_mode as string)) return jsonError('가리기 방식이 올바르지 않습니다.', 400);
    patch.hide_mode = body.hide_mode;
  }
  if (body.default_access !== undefined) {
    if (!ACCESS.includes(body.default_access as string)) return jsonError('권한 값이 올바르지 않습니다.', 400);
    patch.default_access = body.default_access;
  }
  for (const k of ['show_criteria', 'revealed', 'peer_review'] as const) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'boolean') return jsonError('설정 값이 올바르지 않습니다.', 400);
      patch[k] = body[k];
    }
  }
  if (body.card_fields !== undefined) {
    const t = cleanTemplate(body.card_fields);
    if (typeof t === 'string') return jsonError(t, 400);
    patch.card_fields = t;
  }
  if (!Object.keys(patch).length) return jsonError('바꿀 내용이 없습니다.', 400);
  const { error } = await supabaseAdmin.from('sb_boards').update(patch).eq('id', ctx.board.id);
  if (error) return dbFail(error);
  return NextResponse.json({ ok: true });
}

/** 교사: 작업장 삭제(원본 deleteBoard). 하위 작업장·카드·첨부 파일까지 지운다. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const ids = await descendantBoardIds(ctx.project.id, ctx.board.id);
  const paths = await boardFilePaths(ids);
  const { error } = await supabaseAdmin.from('sb_boards').delete().eq('id', ctx.board.id);
  if (error) return dbFail(error);
  await removeStoragePaths(paths);
  return NextResponse.json({ parentId: ctx.board.parent_id });
}
