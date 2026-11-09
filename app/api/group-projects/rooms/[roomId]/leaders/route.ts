import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireRoom } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { roomLeadersSchema } from '@/lib/group-project/schemas';

type Params = { params: { roomId: string } };

// 공동 팀장 정하기(담임): 고른 팀장만 남긴다
export async function PUT(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const room = await requireRoom(auth.actor, params.roomId);
  if ('error' in room) return room.error;
  const { ctx } = room;
  if (!ctx.scope.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, roomLeadersSchema);
  if ('error' in body) return body.error;
  const wanted = body.data.leader_ids;
  const added = wanted.filter((id) => !ctx.leaderIds.includes(id));
  const removed = ctx.leaderIds.filter((id) => !wanted.includes(id));

  // 빼기 전에 추가할 팀장을 먼저 검사해 절반만 바뀌는 일을 막는다.
  if (added.length) {
    const [{ data: topicLeaders }, { data: elsewhere }] = await Promise.all([
      supabaseAdmin.from('gp_topic_leaders').select('student_id').eq('topic_id', ctx.topic.id).in('student_id', added),
      supabaseAdmin.from('gp_project_members').select('student_id').eq('topic_id', ctx.topic.id).neq('project_id', ctx.project.id).in('student_id', added),
    ]);
    if ((topicLeaders ?? []).length !== added.length) return jsonError('방 팀장은 이 주제의 팀장 중에서만 지정 가능', 400);
    if ((elsewhere ?? []).length) return jsonError('다른 방 소속 학생은 팀장 지정 불가', 409);
  }

  if (removed.length) {
    const { error } = await supabaseAdmin.from('gp_project_leaders').delete().eq('project_id', params.roomId).in('student_id', removed);
    if (error) return dbError(error);
  }
  if (added.length) {
    const { error } = await supabaseAdmin
      .from('gp_project_leaders')
      .insert(added.map((student_id) => ({ project_id: params.roomId, topic_id: ctx.topic.id, student_id })));
    if (error) return dbError(error, { duplicate: '다른 방을 이끄는 팀장 포함' });
  }
  return NextResponse.json({ ok: true });
}
