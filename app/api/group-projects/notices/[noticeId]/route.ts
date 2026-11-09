import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireNotice } from '@/lib/group-project/access';
import { dbError, forbiddenResponse, parseBody } from '@/lib/group-project/http';
import { noticeUpdateSchema } from '@/lib/group-project/schemas';
import { canEditScope } from '@/lib/group-project/scope';

type Params = { params: { noticeId: string } };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireNotice(auth.actor, params.noticeId);
  if ('error' in access) return access.error;
  if (!canEditScope(access.ctx.scope, access.notice.group_id)) return forbiddenResponse();

  const body = await parseBody(req, noticeUpdateSchema);
  if ('error' in body) return body.error;

  const { error } = await supabaseAdmin.from('gp_notices').update(body.data).eq('id', access.notice.id);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireNotice(auth.actor, params.noticeId);
  if ('error' in access) return access.error;
  if (!canEditScope(access.ctx.scope, access.notice.group_id)) return forbiddenResponse();

  const { error } = await supabaseAdmin.from('gp_notices').delete().eq('id', access.notice.id);
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
