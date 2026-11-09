import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { topicNoticeSchema } from '@/lib/group-project/schemas';
import { loadTopicNotices } from '@/lib/group-project/workspace';

type Params = { params: { topicId: string } };

// 전체공지 관리(담임 전용). 학생은 rooms/[roomId]/notices 응답으로 받는다.
export async function GET(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();
  return NextResponse.json({ notices: await loadTopicNotices(params.topicId) });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireTopic(auth.actor, params.topicId);
  if ('error' in access) return access.error;
  if (!access.isTeacher) return forbiddenResponse();

  const body = await parseBody(req, topicNoticeSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin.from('gp_topic_notices').insert({ ...body.data, topic_id: params.topicId, teacher_id: auth.actor.id });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true }, { status: 201 });
}
