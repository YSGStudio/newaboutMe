import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { validateTaskDates } from '@/lib/group-project/dates';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { aiSaveSchema } from '@/lib/group-project/schemas';
import { canEditScope } from '@/lib/group-project/scope';

type Params = { params: { roomId: string } };

// AI 초안 중 고른 것만 저장(ai_generated = true)
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;

  const body = await parseBody(req, aiSaveSchema);
  if ('error' in body) return body.error;
  const { group_id: groupId, drafts } = body.data;
  if (groupId && !ctx.groups.some((g) => g.id === groupId)) return jsonError('모둠을 확인하세요', 400);
  if (!canEditScope(ctx.scope, groupId)) return forbiddenResponse('이 작업 공간에 할 일을 쓸 권한이 없어요');

  for (const d of drafts) {
    const err = validateTaskDates(d.start_date, d.due_date, { start: ctx.project.start_date, end: ctx.project.end_date });
    if (err) return jsonError(`"${d.title}": ${err}`, 400);
  }

  const { count } = await supabaseAdmin.from('gp_tasks').select('id', { count: 'exact', head: true }).eq('project_id', params.roomId);
  const { error } = await supabaseAdmin.from('gp_tasks').insert(
    drafts.map((d, i) => ({
      project_id: params.roomId,
      group_id: groupId,
      title: d.title,
      description: d.description || null,
      start_date: d.start_date,
      due_date: d.due_date,
      ai_generated: true,
      sort_order: (count ?? 0) + i,
      ...actorColumns(auth.actor, 'created_by'),
      ...actorColumns(auth.actor, 'updated_by'),
    })),
  );
  if (error) return dbError(error);
  return NextResponse.json({ saved: drafts.length }, { status: 201 });
}
