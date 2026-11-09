import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireClass } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, jsonError, parseBody } from '@/lib/group-project/http';
import { topicSchema } from '@/lib/group-project/schemas';

type Params = { params: { classId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireClass(auth.actor, params.classId);
  if ('error' in access) return access.error;

  const [{ data: topics, error }, students] = await Promise.all([
    supabaseAdmin.from('gp_topics').select('*').eq('class_id', params.classId).order('start_date', { ascending: false }),
    access.isTeacher
      ? supabaseAdmin.from('students').select('id,name,student_number').eq('class_id', params.classId).order('student_number')
      : Promise.resolve({ data: undefined }),
  ]);
  if (error) return dbError(error);
  return NextResponse.json({ topics: topics ?? [], students: students.data, isTeacher: access.isTeacher });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireClass(auth.actor, params.classId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, topicSchema);
  if ('error' in body) return body.error;
  const { leader_ids, ...fields } = body.data;

  // 다른 학급 학생은 주제를 만들기 전에 거른다(DB 트리거가 한 번 더 막는다).
  const { data: classmates } = await supabaseAdmin.from('students').select('id').eq('class_id', params.classId).in('id', leader_ids);
  if ((classmates ?? []).length !== leader_ids.length) return jsonError('팀장은 이 학급 학생만 지정 가능', 400);

  const { data: topic, error } = await supabaseAdmin
    .from('gp_topics')
    .insert({ ...fields, class_id: params.classId, teacher_id: auth.actor.id })
    .select('*')
    .single();
  if (error || !topic) return dbError(error ?? { message: 'insert returned no row' });

  const { error: leaderError } = await supabaseAdmin
    .from('gp_topic_leaders')
    .insert(leader_ids.map((student_id) => ({ topic_id: topic.id, student_id })));
  if (leaderError) {
    await supabaseAdmin.from('gp_topics').delete().eq('id', topic.id);
    return dbError(leaderError);
  }
  return NextResponse.json({ topic }, { status: 201 });
}
