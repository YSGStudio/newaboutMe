import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireComment } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { canDeleteComment, isCommentAuthor } from '@/lib/group-project/roomView';
import { commentSchema } from '@/lib/group-project/schemas';

type Params = { params: { commentId: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireComment(auth.actor, params.commentId);
  if ('error' in access) return access.error;
  if (!isCommentAuthor(auth.actor, access.comment)) return forbiddenResponse('자기 댓글만 고칠 수 있어요');

  const body = await parseBody(req, commentSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin.from('gp_notice_comments').update({ body: body.data.body }).eq('id', access.comment.id);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireComment(auth.actor, params.commentId);
  if ('error' in access) return access.error;
  if (!canDeleteComment(access.ctx.scope, auth.actor, access.comment)) return forbiddenResponse('남의 댓글은 지울 수 없어요');

  const { error } = await supabaseAdmin.from('gp_notice_comments').delete().eq('id', access.comment.id);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
