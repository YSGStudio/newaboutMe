import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { validateRangeWithin } from '@/lib/group-project/dates';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { editableScopes, nameMap } from '@/lib/group-project/roomView';
import { roomUpdateSchema } from '@/lib/group-project/schemas';
import { projectFilePaths, removeStoragePaths } from '@/lib/group-project/storage';
import type { RoomBundle } from '@/lib/group-project/types';

type Params = { params: { roomId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;

  const bundle: RoomBundle = {
    me: { kind: ctx.actor.kind, id: ctx.actor.id, name: ctx.actor.name },
    project: ctx.project,
    topic: ctx.topic,
    groups: ctx.groups,
    members: ctx.members,
    groupOf: ctx.groupOf,
    scope: ctx.scope,
    kind: ctx.kind,
    myGroup: ctx.myGroup,
    leaderIds: ctx.leaderIds,
    leaderNames: ctx.leaderNames,
    names: nameMap(ctx),
    editableScopes: editableScopes(ctx),
  };

  if (ctx.scope.isTeacher) {
    const [{ data: students }, { data: roomRows }, { data: topicMembers }, { data: topicLeaders }] = await Promise.all([
      supabaseAdmin.from('students').select('id,name,student_number').eq('class_id', ctx.topic.class_id).order('student_number'),
      supabaseAdmin.from('gp_projects').select('id,name').eq('topic_id', ctx.topic.id).order('created_at'),
      supabaseAdmin.from('gp_project_members').select('student_id,project_id').eq('topic_id', ctx.topic.id),
      supabaseAdmin.from('gp_topic_leaders').select('student_id').eq('topic_id', ctx.topic.id),
    ]);
    const roomName = new Map((roomRows ?? []).map((r) => [r.id as string, r.name as string]));
    const otherRoom = new Map(
      (topicMembers ?? [])
        .filter((m) => m.project_id !== ctx.project.id)
        .map((m) => [m.student_id as string, roomName.get(m.project_id as string) ?? null]),
    );
    bundle.classStudents = (students ?? []).map((s) => ({ ...s, otherRoom: otherRoom.get(s.id) ?? null }));
    const nameOf = new Map((students ?? []).map((s) => [s.id as string, s.name as string]));
    bundle.leaderCandidates = (topicLeaders ?? []).map((l) => ({
      id: l.student_id as string,
      name: nameOf.get(l.student_id as string) ?? '(알 수 없음)',
      otherRoom: otherRoom.get(l.student_id as string) ?? null,
    }));
    bundle.siblingRooms = (roomRows ?? []).map((r) => ({ id: r.id as string, name: r.name as string }));
  }

  return NextResponse.json(bundle);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;
  if (!ctx.scope.isTeacher && !ctx.scope.isProjectLeader) return forbiddenResponse();

  const body = await parseBody(req, roomUpdateSchema);
  if ('error' in body) return body.error;
  const { start_date: start, end_date: end } = body.data;
  const range = validateRangeWithin(start, end, { start: ctx.topic.start_date, end: ctx.topic.end_date });
  if (range) return jsonError(range, 400);

  // 날짜는 스키마에서 YYYY-MM-DD로 검증되어 필터 문자열에 넣어도 안전하다.
  const { data: outside } = await supabaseAdmin
    .from('gp_tasks')
    .select('title')
    .eq('project_id', params.roomId)
    .or(`start_date.lt.${start},due_date.lt.${start},start_date.gt.${end},due_date.gt.${end}`);
  if (outside?.length) {
    return jsonError(`새 기간을 벗어나는 할 일이 있어요: ${outside.map((t) => t.title).join(', ')}. 할 일 날짜를 먼저 바꾸세요.`, 400);
  }

  const { error } = await supabaseAdmin.from('gp_projects').update(body.data).eq('id', params.roomId);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  if (!room.ctx.scope.isTeacher) return forbiddenResponse();

  const paths = await projectFilePaths(params.roomId);
  const { error } = await supabaseAdmin.from('gp_projects').delete().eq('id', params.roomId);
  if (error) return dbError(error);
  await removeStoragePaths(paths);
  return NextResponse.json({ ok: true });
}
