import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { syncAssignees } from '@/lib/group-project/assignees';
import { dbError, jsonError, parseBody } from '@/lib/group-project/http';
import { taskSchema } from '@/lib/group-project/schemas';
import { checkTaskInput } from '@/lib/group-project/taskRules';
import { loadWorkspace } from '@/lib/group-project/workspace';

type Params = { params: { roomId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  return NextResponse.json(await loadWorkspace(room.ctx, new URL(req.url).searchParams.get('view')));
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;

  const body = await parseBody(req, taskSchema);
  if ('error' in body) return body.error;
  const { assignee_ids, ...fields } = body.data;

  const invalid = checkTaskInput(room.ctx, body.data);
  if (invalid) return jsonError(invalid.error, invalid.status);

  const { data: created, error } = await supabaseAdmin
    .from('gp_tasks')
    .insert({
      ...fields,
      project_id: params.roomId,
      ...actorColumns(auth.actor, 'created_by'),
      ...actorColumns(auth.actor, 'updated_by'),
    })
    .select('id')
    .single();
  if (error || !created) return dbError(error ?? { message: 'insert returned no row' });

  const assignError = await syncAssignees(created.id, params.roomId, assignee_ids, []);
  if (assignError) return dbError(assignError);
  return NextResponse.json({ id: created.id }, { status: 201 });
}
