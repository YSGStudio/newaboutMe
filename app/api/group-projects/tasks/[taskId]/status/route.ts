import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireTask } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { statusPatchSchema } from '@/lib/group-project/schemas';
import { canChangeStatus } from '@/lib/group-project/scope';

type Params = { params: { taskId: string } };

// 상태 변경: 담당자, 작성 권한자, 담임. 이 라우트는 상태만 바꾼다.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTask(auth.actor, params.taskId);
  if ('error' in access) return access.error;
  if (!canChangeStatus(access.ctx.scope, access.task, auth.actor.id)) return forbiddenResponse('담당자만 상태를 바꿀 수 있어요');

  const body = await parseBody(req, statusPatchSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin
    .from('gp_tasks')
    .update({ status: body.data.status, ...actorColumns(auth.actor, 'updated_by') })
    .eq('id', access.task.id);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
