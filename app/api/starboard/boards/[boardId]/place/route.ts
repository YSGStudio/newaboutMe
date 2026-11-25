import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireBoardTeacher, who } from '@/lib/starboard/access';
import { computeDrop } from '@/lib/starboard/tree';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';
import type { TreeNode } from '@/lib/starboard/types';

type Params = { params: { boardId: string } };

const DROP_ERROR = {
  same: '같은 자리입니다.',
  cycle: '작업장을 자기 자신이나 하위 작업장 안으로 옮길 수 없습니다.',
  personal: '학생 개인 보드는 다른 작업장으로 옮길 수 없습니다. 순서만 바꿀 수 있어요.',
  missing: '작업장을 찾을 수 없습니다.',
} as const;

async function renumber(ids: string[]) {
  for (const [i, id] of ids.entries()) {
    const { error } = await supabaseAdmin.from('sb_boards').update({ position: i + 1 }).eq('id', id);
    if (error) return error;
  }
  return null;
}

/**
 * 교사: 작업장 옮기기. 원본 세 액션을 하나로 받는다.
 *   { mode: 'drop', overId, where }  — placeBoard(드래그 앤 드롭)
 *   { mode: 'parent', parentId }     — moveBoard(다른 보드 아래로)
 *   { mode: 'reorder', direction }   — reorderBoard(같은 부모 안 위/아래 한 칸)
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireBoardTeacher(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const { board, project } = ctx;
  const body = await readJson(req);

  if (body.mode === 'reorder') {
    const direction = body.direction === 'up' ? 'up' : 'down';
    let q = supabaseAdmin.from('sb_boards').select('id, position').eq('project_id', project.id);
    q = board.parent_id ? q.eq('parent_id', board.parent_id) : q.is('parent_id', null);
    const { data: sibs } = await q.order('position').order('id');
    const order = (sibs ?? []).map((s) => s.id as string);
    const i = order.indexOf(board.id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= order.length) return NextResponse.json({ ok: true });
    [order[i], order[j]] = [order[j], order[i]];
    const err = await renumber(order);
    if (err) return dbFail(err);
    return NextResponse.json({ ok: true });
  }

  if (body.mode === 'parent') {
    const parentId = typeof body.parentId === 'string' && isUuid(body.parentId) ? body.parentId : null;
    let q = supabaseAdmin.from('sb_boards').select('position').eq('project_id', project.id);
    q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null);
    const { data: siblings } = await q.order('position', { ascending: false }).limit(1);
    const { error } = await supabaseAdmin
      .from('sb_boards')
      .update({ parent_id: parentId, position: ((siblings?.[0]?.position as number | undefined) ?? 0) + 1 })
      .eq('id', board.id);
    if (error) return dbFail(error);
    return NextResponse.json({ ok: true });
  }

  if (body.mode === 'drop') {
    const where = body.where;
    if (typeof body.overId !== 'string' || (where !== 'before' && where !== 'after' && where !== 'inside')) {
      return jsonError('옮길 자리가 올바르지 않습니다.', 400);
    }
    const { data: tree, error: treeError } = await supabaseAdmin.rpc('sb_get_board_tree', {
      p_project: project.id,
      ...who(auth.actor),
    });
    if (treeError) return dbFail(treeError);
    const drop = computeDrop((tree ?? []) as TreeNode[], board.id, { overId: body.overId, where });
    if (!drop.ok) return drop.reason === 'same' ? NextResponse.json({ ok: true }) : jsonError(DROP_ERROR[drop.reason], 400);
    if (drop.parentId !== board.parent_id) {
      const { error } = await supabaseAdmin
        .from('sb_boards')
        .update({ parent_id: drop.parentId, position: drop.order.indexOf(board.id) + 1 })
        .eq('id', board.id);
      if (error) return dbFail(error);
    }
    const err = await renumber(drop.order);
    if (err) return dbFail(err);
    return NextResponse.json({ ok: true });
  }

  return jsonError('옮기는 방식이 올바르지 않습니다.', 400);
}
