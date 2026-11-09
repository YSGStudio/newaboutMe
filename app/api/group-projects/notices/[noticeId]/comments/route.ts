import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { actorColumns, requireActor } from '@/lib/group-project/actor';
import { requireNotice } from '@/lib/group-project/access';
import { dbError, parseBody } from '@/lib/group-project/http';
import { commentSchema } from '@/lib/group-project/schemas';

type Params = { params: { noticeId: string } };

// 공지를 볼 수 있으면 댓글을 달 수 있다(requireNotice가 공개 범위를 확인한다).
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireNotice(auth.actor, params.noticeId);
  if ('error' in access) return access.error;

  const body = await parseBody(req, commentSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin
    .from('gp_notice_comments')
    .insert({ notice_id: access.notice.id, body: body.data.body, ...actorColumns(auth.actor, 'author') });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true }, { status: 201 });
}
