import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadProject, who } from '@/lib/starboard/access';
import { dbFail, isUuid, jsonError, readJson } from '@/lib/starboard/http';

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadProject(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const { boardIds } = await readJson(req);
  if (!Array.isArray(boardIds) || !boardIds.every(id => typeof id === 'string' && isUuid(id))) {
    return jsonError('작업장 목록을 확인해 주세요.', 400);
  }
  const ids = [...new Set(boardIds)];
  const counts: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
  const batchSize = 500;
  for (let i = 0; i < ids.length; i += batchSize) {
    const { data, error } = await supabaseAdmin.rpc('sb_visible_counts_for_boards', {
      p_project: ctx.project.id, ...who(auth.actor), p_boards: ids.slice(i, i + batchSize),
    });
    if (error) return dbFail(error);
    for (const row of data ?? []) counts[row.board_id] = Number(row.count);
  }
  return NextResponse.json({ counts });
}
