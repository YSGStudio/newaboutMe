import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadBoard, who } from '@/lib/starboard/access';
import { signPaths } from '@/lib/starboard/storage';
import { dbFail, readJson } from '@/lib/starboard/http';
import type { BoardView } from '@/lib/starboard/types';

type Params = { params: { boardId: string } };

/**
 * 첨부 파일 서명 URL(600초). 원본은 Storage 정책이 can_read_card로 걸렀다.
 * 여기서는 그 사람에게 보이는 작업장 뷰(가리기 적용)에 들어 있는 경로만 서명하므로 같은 규칙이 된다.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await loadBoard(auth.actor, params.boardId);
  if ('error' in ctx) return ctx.error;
  const { data, error } = await supabaseAdmin.rpc('sb_get_board_view', { p_board: ctx.board.id, ...who(auth.actor) });
  if (error) return dbFail(error);
  const view = data as BoardView | null;
  const allowed = new Set(
    (view?.cards ?? []).flatMap((c) => c.attachments.flatMap((a) => [a.storage_path, a.thumb_path])).filter(Boolean) as string[],
  );
  const body = await readJson(req);
  const wanted = (Array.isArray(body.paths) ? body.paths : []).filter((p): p is string => typeof p === 'string' && allowed.has(p));
  return NextResponse.json({ urls: await signPaths(wanted) });
}
