import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError, notFoundResponse, parseBody } from '@/lib/group-project/http';
import { memberGroupSchema } from '@/lib/group-project/schemas';

type Params = { params: { roomId: string; studentId: string } };

// 모둠 배치·이동·미배치(담임만). 이동하면 이전 모둠 담당·모둠장은 트리거가 해제한다.
export async function PUT(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;
  if (!ctx.scope.isTeacher) return forbiddenResponse();
  if (!ctx.members.some((m) => m.id === params.studentId)) return notFoundResponse();

  const body = await parseBody(req, memberGroupSchema);
  if ('error' in body) return body.error;
  const groupId = body.data.group_id;
  if (groupId && !ctx.groups.some((g) => g.id === groupId)) return jsonError('모둠을 확인하세요', 400);

  const current = ctx.groupOf[params.studentId] ?? null;
  if (current === groupId) return NextResponse.json({ ok: true });

  const members = supabaseAdmin.from('gp_group_members');
  const { error } = !groupId
    ? await members.delete().eq('project_id', params.roomId).eq('student_id', params.studentId)
    : current
      ? await members.update({ group_id: groupId }).eq('project_id', params.roomId).eq('student_id', params.studentId)
      : await members.insert({ group_id: groupId, project_id: params.roomId, student_id: params.studentId });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
