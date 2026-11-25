import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadProject } from '@/lib/starboard/access';
import { dbFail } from '@/lib/starboard/http';

type Params = { params: { projectId: string } };

/**
 * 변경 신호(원본 Realtime board_events 구독 대신 폴링).
 * 내용은 없고 작업장별 마지막 변경 시각만 준다. 원본도 같은 프로젝트를 볼 수 있으면 모든 신호를 받았다.
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadProject(auth.actor, params.projectId);
  if ('error' in ctx) return ctx.error;
  const { data, error } = await supabaseAdmin
    .from('sb_board_events')
    .select('board_id, content_at, structure_at')
    .eq('project_id', ctx.project.id);
  if (error) return dbFail(error);
  return NextResponse.json({ events: data ?? [] });
}
