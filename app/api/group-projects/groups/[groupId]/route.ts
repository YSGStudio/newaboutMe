import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireGroup } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { groupPatchSchema } from '@/lib/group-project/schemas';

type Params = { params: { groupId: string } };

// 모둠 이름 변경·모둠장 지정(담임만)
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireGroup(auth.actor, params.groupId);
  if ('error' in access) return access.error;
  if (!access.ctx.scope.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, groupPatchSchema);
  if ('error' in body) return body.error;

  const updates: { name?: string; leader_student_id?: string | null } = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.leader_student_id !== undefined) updates.leader_student_id = body.data.leader_student_id || null;

  const { error } = await supabaseAdmin.from('gp_groups').update(updates).eq('id', params.groupId);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}

// 모둠을 지우면 그 모둠의 할 일·공지는 방 공통 항목이 된다(group_id → null)
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireGroup(auth.actor, params.groupId);
  if ('error' in access) return access.error;
  if (!access.ctx.scope.isTeacher) return forbiddenResponse();

  const { error } = await supabaseAdmin.from('gp_groups').delete().eq('id', params.groupId);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
