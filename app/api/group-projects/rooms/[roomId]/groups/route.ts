import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { groupCreateSchema } from '@/lib/group-project/schemas';

type Params = { params: { roomId: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  if (!room.ctx.scope.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, groupCreateSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin.from('gp_groups').insert({ project_id: params.roomId, name: body.data.name });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true }, { status: 201 });
}
