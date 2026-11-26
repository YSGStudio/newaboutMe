import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireColumnTeacher } from '@/lib/starboard/access';
import { dbFail, readJson } from '@/lib/starboard/http';
import { isNoticeColumn, orderColumns } from '@/lib/starboard/columns';

type Params = { params: { columnId: string } };

/**
 * 교사: 섹션 왼쪽/오른쪽 한 칸(원본 reorderColumn). 순서를 1..n으로 다시 매긴다.
 * 화면과 같은 순서(공지사항 섹션이 맨 앞)에서 옮기고, 공지사항과 다른 섹션이 서로 자리를 넘지 않게 한다.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireColumnTeacher(auth.actor, params.columnId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const direction = body.direction === 'left' ? 'left' : 'right';
  const { data: cols } = await supabaseAdmin.from('sb_columns').select('id, name, position').eq('board_id', ctx.board.id).order('position').order('id');
  const ordered = orderColumns((cols ?? []) as { id: string; name: string; position: number }[]);
  const order = ordered.map((c) => c.id);
  const i = order.indexOf(ctx.columnId);
  const j = direction === 'left' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return NextResponse.json({ ok: true });
  if (isNoticeColumn(ordered[i].name) !== isNoticeColumn(ordered[j].name)) return NextResponse.json({ ok: true });
  [order[i], order[j]] = [order[j], order[i]];
  for (const [k, id] of order.entries()) {
    const { error } = await supabaseAdmin.from('sb_columns').update({ position: k + 1 }).eq('id', id);
    if (error) return dbFail(error);
  }
  return NextResponse.json({ ok: true });
}
