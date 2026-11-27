import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { loadBoard, who } from '@/lib/starboard/access';
import { signPaths } from '@/lib/starboard/storage';
import { dbFail, readJson } from '@/lib/starboard/http';

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
  const body = await readJson(req);
  const paths = Array.isArray(body.paths) ? [...new Set(body.paths.filter((p): p is string => typeof p === 'string'))] : [];
  const urls: Record<string, string> = {};
  // 한 번에 반환할 행 수가 PostgREST의 제한을 넘지 않게 한다.
  const batchSize = 500;
  for (let i = 0; i < paths.length; i += batchSize) {
    const { data, error } = await supabaseAdmin.rpc('sb_readable_attachment_paths', {
      p_board: ctx.board.id, ...who(auth.actor), p_paths: paths.slice(i, i + batchSize),
    });
    if (error) return dbFail(error);
    const allowed = (data ?? []).map((row: { path: string }) => row.path);
    Object.assign(urls, await signPaths(allowed));
  }
  return NextResponse.json({ urls });
}
