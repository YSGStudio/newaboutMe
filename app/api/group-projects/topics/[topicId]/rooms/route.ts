import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { validateRangeWithin } from '@/lib/group-project/dates';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { projectStats } from '@/lib/group-project/progress';
import { roomCreateSchema } from '@/lib/group-project/schemas';

type Params = { params: { topicId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;

  const [{ data: rooms, error }, { data: leaderRows }, { data: memberRows }] = await Promise.all([
    supabaseAdmin.from('gp_projects').select('id,name,start_date,end_date').eq('topic_id', params.topicId).order('created_at'),
    supabaseAdmin.from('gp_project_leaders').select('project_id, students(name)').eq('topic_id', params.topicId),
    supabaseAdmin.from('gp_project_members').select('project_id, student_id, students(name)').eq('topic_id', params.topicId),
  ]);
  if (error) return dbError(error);

  const leaderNames = new Map<string, string[]>();
  for (const r of leaderRows ?? []) {
    const name = (r.students as unknown as { name: string } | null)?.name;
    if (name) leaderNames.set(r.project_id as string, [...(leaderNames.get(r.project_id as string) ?? []), name]);
  }
  const namesOf = (id: string) => (leaderNames.get(id) ?? []).sort((a, b) => a.localeCompare(b, 'ko')).join(', ');

  // 같은 학급 학생에게는 방 이름·팀장 이름·내 방 여부만 내려 준다.
  if (!access.isTeacher) {
    const mine = (memberRows ?? []).find((m) => m.student_id === auth.actor.id)?.project_id;
    return NextResponse.json({
      isTeacher: false,
      rooms: (rooms ?? []).map((r) => ({ id: r.id, name: r.name, leader_names: namesOf(r.id), is_mine: r.id === mine })),
    });
  }

  const stats = await projectStats((rooms ?? []).map((r) => r.id));
  const { data: topicLeaders } = await supabaseAdmin
    .from('gp_topic_leaders')
    .select('student_id, students(id, name)')
    .eq('topic_id', params.topicId);
  const roomName = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  const roomOf = new Map((memberRows ?? []).map((m) => [m.student_id as string, roomName.get(m.project_id as string) ?? null]));

  return NextResponse.json({
    isTeacher: true,
    rooms: (rooms ?? []).map((r) => ({ ...r, leader_names: namesOf(r.id), stats: stats[r.id] })),
    leaderCandidates: (topicLeaders ?? []).map((l) => {
      const s = l.students as unknown as { id: string; name: string };
      return { id: s.id, name: s.name, otherRoom: roomOf.get(s.id) ?? null };
    }),
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const { actor } = auth;
  const access = await requireTopic(actor, params.topicId);
  if ('error' in access) return access.error;
  const { topic, isTeacher } = access;

  const body = await parseBody(req, roomCreateSchema);
  if ('error' in body) return body.error;
  const start = body.data.start_date ?? topic.start_date;
  const end = body.data.end_date ?? topic.end_date;
  const range = validateRangeWithin(start, end, { start: topic.start_date, end: topic.end_date });
  if (range) return jsonError(range, 400);

  let leaderIds: string[];
  if (isTeacher) {
    leaderIds = body.data.leader_ids;
  } else {
    // 학생: 그 주제의 팀장이면서 아직 어느 방에도 없어야 한다. 만든 학생이 자동으로 팀장이 된다.
    const [{ data: lead }, { data: membership }] = await Promise.all([
      supabaseAdmin.from('gp_topic_leaders').select('student_id').eq('topic_id', params.topicId).eq('student_id', actor.id).maybeSingle(),
      supabaseAdmin.from('gp_project_members').select('project_id').eq('topic_id', params.topicId).eq('student_id', actor.id).maybeSingle(),
    ]);
    if (!lead) return forbiddenResponse('이 주제의 팀장만 방을 만들 수 있어요');
    if (membership) return jsonError('이미 이 주제의 방에 속해 있어요', 409);
    leaderIds = [actor.id];
  }

  const id = randomUUID();
  const { error } = await supabaseAdmin.from('gp_projects').insert({
    id,
    topic_id: params.topicId,
    name: body.data.name,
    description: body.data.description,
    start_date: start,
    end_date: end,
    ...actorColumns(actor, 'created_by'),
  });
  if (error) return dbError(error);

  if (leaderIds.length) {
    const { error: leaderError } = await supabaseAdmin
      .from('gp_project_leaders')
      .insert(leaderIds.map((student_id) => ({ project_id: id, topic_id: params.topicId, student_id })));
    if (leaderError) {
      // 팀장 없는 학생 방이 남지 않게 되돌린다.
      await supabaseAdmin.from('gp_projects').delete().eq('id', id);
      return dbError(leaderError, { duplicate: '이미 다른 방을 이끄는 팀장이 있어요' });
    }
  }
  return NextResponse.json({ id }, { status: 201 });
}
