import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { topicSchema } from '@/lib/group-project/schemas';
import { removeStoragePaths, topicFilePaths } from '@/lib/group-project/storage';

type Params = { params: { topicId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;

  const { data: leaderRows } = await supabaseAdmin
    .from('gp_topic_leaders')
    .select('student_id, students(id, name)')
    .eq('topic_id', params.topicId);

  // 주제 팀장 명단은 담임과 본인만 읽는다. 학생에게는 본인 여부만 알려 준다.
  if (!access.isTeacher) {
    return NextResponse.json({
      topic: access.topic,
      isTeacher: false,
      isLeader: (leaderRows ?? []).some((r) => r.student_id === auth.actor.id),
    });
  }

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id,name,student_number')
    .eq('class_id', access.topic.class_id)
    .order('student_number');

  return NextResponse.json({
    topic: access.topic,
    isTeacher: true,
    leaders: (leaderRows ?? []).map((r) => r.students),
    students: students ?? [],
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, topicSchema);
  if ('error' in body) return body.error;
  const { leader_ids, ...fields } = body.data;

  const { data: classmates } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('class_id', access.topic.class_id)
    .in('id', leader_ids);
  if ((classmates ?? []).length !== leader_ids.length) return jsonError('팀장은 이 학급 학생만 지정 가능', 400);

  // 날짜는 스키마에서 YYYY-MM-DD로 검증되어 필터 문자열에 넣어도 안전하다.
  const { data: outside } = await supabaseAdmin
    .from('gp_projects')
    .select('name')
    .eq('topic_id', params.topicId)
    .or(`start_date.lt.${fields.start_date},end_date.gt.${fields.end_date}`);
  if (outside?.length) {
    return jsonError(`새 기간을 벗어나는 방 있음: ${outside.map((p) => p.name).join(', ')}. 방 기간 먼저 변경 필요.`, 400);
  }

  const { error } = await supabaseAdmin.from('gp_topics').update(fields).eq('id', params.topicId);
  if (error) return dbError(error);

  const { data: current } = await supabaseAdmin.from('gp_topic_leaders').select('student_id').eq('topic_id', params.topicId);
  const before = new Set((current ?? []).map((r) => r.student_id as string));
  const removed = [...before].filter((id) => !leader_ids.includes(id));
  const added = leader_ids.filter((id) => !before.has(id));
  if (removed.length) {
    // 빠진 팀장은 트리거가 맡던 방의 팀장에서도 뺀다.
    const { error: e } = await supabaseAdmin.from('gp_topic_leaders').delete().eq('topic_id', params.topicId).in('student_id', removed);
    if (e) return dbError(e);
  }
  if (added.length) {
    const { error: e } = await supabaseAdmin.from('gp_topic_leaders').insert(added.map((student_id) => ({ topic_id: params.topicId, student_id })));
    if (e) return dbError(e);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();

  const paths = await topicFilePaths([params.topicId]);
  const { error } = await supabaseAdmin.from('gp_topics').delete().eq('id', params.topicId);
  if (error) return dbError(error);
  await removeStoragePaths(paths);
  return NextResponse.json({ ok: true });
}
