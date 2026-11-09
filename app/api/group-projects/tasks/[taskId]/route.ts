import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireTask } from '@/lib/group-project/access';
import { syncAssignees } from '@/lib/group-project/assignees';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { scopeLabel } from '@/lib/group-project/roomView';
import { taskSchema } from '@/lib/group-project/schemas';
import { canChangeStatus, canEditScope } from '@/lib/group-project/scope';
import { removeStoragePaths, taskFilePaths } from '@/lib/group-project/storage';
import { checkTaskInput } from '@/lib/group-project/taskRules';
import type { GpAttachment } from '@/lib/group-project/types';
import { toAttachmentViews } from '@/lib/group-project/workspace';

type Params = { params: { taskId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTask(auth.actor, params.taskId);
  if ('error' in access) return access.error;
  const { ctx, task } = access;

  const { data } = await supabaseAdmin
    .from('gp_task_attachments')
    .select('*')
    .eq('task_id', task.id)
    .order('created_at', { ascending: false });

  const canEdit = canEditScope(ctx.scope, task.group_id);
  return NextResponse.json({
    task,
    scopeLabel: scopeLabel(ctx, task.group_id),
    canEdit,
    canChangeStatus: canChangeStatus(ctx.scope, task, auth.actor.id),
    canContribute: canEdit || task.assignee_ids.includes(auth.actor.id),
    attachments: await toAttachmentViews(ctx, (data ?? []) as GpAttachment[], { [task.id]: task.title }),
  });
}

// 작성 권한자만 고친다. 담당자는 /status만 쓴다.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTask(auth.actor, params.taskId);
  if ('error' in access) return access.error;
  const { ctx, task } = access;
  if (!canEditScope(ctx.scope, task.group_id)) return forbiddenResponse('이 할 일을 고칠 권한이 없어요');

  const body = await parseBody(req, taskSchema);
  if ('error' in body) return body.error;
  const { assignee_ids, ...fields } = body.data;

  const invalid = checkTaskInput(ctx, body.data);
  if (invalid) return jsonError(invalid.error, invalid.status);

  const { error } = await supabaseAdmin
    .from('gp_tasks')
    .update({ ...fields, ...actorColumns(auth.actor, 'updated_by') })
    .eq('id', task.id);
  if (error) return dbError(error);

  // 소속이 바뀌면 트리거가 새 작업 공간 밖 담당자를 뺀다. 남은 목록 기준으로 맞춘다.
  const { data: now } = await supabaseAdmin.from('gp_task_assignees').select('student_id').eq('task_id', task.id);
  const assignError = await syncAssignees(task.id, task.project_id, assignee_ids, (now ?? []).map((r) => r.student_id as string));
  if (assignError) return dbError(assignError);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTask(auth.actor, params.taskId);
  if ('error' in access) return access.error;
  if (!canEditScope(access.ctx.scope, access.task.group_id)) return forbiddenResponse('이 할 일을 지울 권한이 없어요');

  const paths = await taskFilePaths(access.task.id);
  const { error } = await supabaseAdmin.from('gp_tasks').delete().eq('id', access.task.id);
  if (error) return dbError(error);
  await removeStoragePaths(paths);
  return NextResponse.json({ ok: true });
}
