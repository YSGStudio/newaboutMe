import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadProject, who } from '@/lib/starboard/access';
import { dbFail } from '@/lib/starboard/http';

type Params = { params: { projectId: string } };

/** 작업장 트리(원본 get_board_tree) + 작업장별 보이는 카드 수(원본 loadCardCounts) */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadProject(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const args = { p_project: ctx.project.id, ...who(auth.actor) };
  const [tree, counts] = await Promise.all([
    supabaseAdmin.rpc('sb_get_board_tree', args),
    new URL(req.url).searchParams.get('counts') === 'skip' ? { data: [], error: null } : supabaseAdmin.rpc('sb_visible_card_counts', args),
  ]);
  if (tree.error || counts.error) return dbFail((tree.error ?? counts.error)!);
  const countMap: Record<string, number> = {};
  for (const r of (counts.data ?? []) as { board_id: string; count: number }[]) countMap[r.board_id] = Number(r.count);
  return NextResponse.json({ project: ctx.project, isTeacher: ctx.isTeacher, nodes: tree.data ?? [], counts: countMap });
}
