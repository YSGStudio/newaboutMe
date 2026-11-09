import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireAttachment } from '@/lib/group-project/access';
import { dbError, forbiddenResponse } from '@/lib/group-project/http';
import { canDeleteAttachment } from '@/lib/group-project/roomView';
import { removeStoragePaths } from '@/lib/group-project/storage';

type Params = { params: { attachmentId: string } };

// 올린 사람(볼 수 있을 때)과 담임만 지운다. DB 행과 Storage 객체를 함께 지운다.
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const access = await requireAttachment(auth.actor, params.attachmentId);
  if ('error' in access) return access.error;
  if (!canDeleteAttachment(access.ctx.scope, auth.actor, access.attachment)) {
    return forbiddenResponse('올린 사람이나 선생님만 지울 수 있어요');
  }

  const { error } = await supabaseAdmin.from('gp_task_attachments').delete().eq('id', access.attachment.id);
  if (error) return dbError(error);
  if (access.attachment.storage_path) await removeStoragePaths([access.attachment.storage_path]);
  return NextResponse.json({ ok: true });
}
