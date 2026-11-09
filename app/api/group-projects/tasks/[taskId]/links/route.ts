import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireTask } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { linksSchema } from '@/lib/group-project/schemas';
import { canEditScope } from '@/lib/group-project/scope';
import { validateLinks } from '@/lib/group-project/upload';

type Params = { params: { taskId: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTask(auth.actor, params.taskId);
  if ('error' in access) return access.error;
  const { ctx, task } = access;
  if (!task.assignee_ids.includes(auth.actor.id) && !canEditScope(ctx.scope, task.group_id)) {
    return forbiddenResponse('담당자만 결과물을 올릴 수 있어요');
  }

  const body = await parseBody(req, linksSchema);
  if ('error' in body) return body.error;
  const check = validateLinks(body.data.links);
  if (!check.ok) return jsonError(check.error, 400);

  const { error } = await supabaseAdmin.from('gp_task_attachments').insert(
    check.links.map((l) => ({
      task_id: task.id,
      kind: 'link',
      url: l.url,
      file_name: l.title,
      ...actorColumns(auth.actor, 'uploaded_by'),
    })),
  );
  if (error) return dbError(error);
  return NextResponse.json({ saved: check.links.length }, { status: 201 });
}
