import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireColumnTeacher } from '@/lib/starboard/access';
import { dbFail, readJson } from '@/lib/starboard/http';

type Params = { params: { columnId: string } };

/** 교사: 섹션 왼쪽/오른쪽 한 칸(원본 reorderColumn). 순서를 1..n으로 다시 매긴다. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireColumnTeacher(auth.actor, params.columnId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const direction = body.direction === 'left' ? 'left' : 'right';
  const { data: cols } = await supabaseAdmin.from('sb_columns').select('id').eq('board_id', ctx.board.id).order('position').order('id');
  const order = (cols ?? []).map((c) => c.id as string);
  const i = order.indexOf(ctx.columnId);
  const j = direction === 'left' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return NextResponse.json({ ok: true });
  [order[i], order[j]] = [order[j], order[i]];
  for (const [k, id] of order.entries()) {
    const { error } = await supabaseAdmin.from('sb_columns').update({ position: k + 1 }).eq('id', id);
    if (error) return dbFail(error);
  }
  return NextResponse.json({ ok: true });
}
