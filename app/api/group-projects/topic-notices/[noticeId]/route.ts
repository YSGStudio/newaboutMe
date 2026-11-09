import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor, type Actor } from '@/lib/group-project/actor';
import { requireTopic } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, isUuid, notFoundResponse, parseBody } from '@/lib/group-project/http';
import { topicNoticeSchema } from '@/lib/group-project/schemas';

type Params = { params: { noticeId: string } };

/** 전체공지의 주제를 거슬러 담임인지 확인한다. 볼 수 없으면 404, 학생이면 403. */
async function requireOwner(actor: Actor, noticeId: string) {
  if (!isUuid(noticeId)) return { error: notFoundResponse() };
  const { data } = await supabaseAdmin.from('gp_topic_notices').select('id, topic_id').eq('id', noticeId).maybeSingle();
  if (!data) return { error: notFoundResponse() };
  const access = await requireTopic(actor, data.topic_id as string);
  if ('error' in access) return access;
  if (!access.isTeacher) return { error: forbiddenResponse() };
  return { ok: true as const };
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const owner = await requireOwner(auth.actor, params.noticeId);
  if ('error' in owner) return owner.error;

  const body = await parseBody(req, topicNoticeSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin
    .from('gp_topic_notices')
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq('id', params.noticeId);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const owner = await requireOwner(auth.actor, params.noticeId);
  if ('error' in owner) return owner.error;

  const { error } = await supabaseAdmin.from('gp_topic_notices').delete().eq('id', params.noticeId);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
