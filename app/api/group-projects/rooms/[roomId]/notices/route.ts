import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { noticeCreateSchema } from '@/lib/group-project/schemas';
import { canEditScope } from '@/lib/group-project/scope';
import { loadNotices } from '@/lib/group-project/workspace';

type Params = { params: { roomId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const search = new URL(req.url).searchParams;
  const limit = Number(search.get('limit'));
  return NextResponse.json({ notices: await loadNotices(room.ctx, search.get('view'), limit > 0 ? limit : undefined) });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;

  const body = await parseBody(req, noticeCreateSchema);
  if ('error' in body) return body.error;
  const { group_id } = body.data;
  if (group_id && !ctx.groups.some((g) => g.id === group_id)) return jsonError('모둠을 확인하세요', 400);
  if (!canEditScope(ctx.scope, group_id)) return forbiddenResponse('공지를 쓸 권한이 없어요');

  const { error } = await supabaseAdmin
    .from('gp_notices')
    .insert({ ...body.data, project_id: params.roomId, ...actorColumns(auth.actor, 'author') });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true }, { status: 201 });
}
