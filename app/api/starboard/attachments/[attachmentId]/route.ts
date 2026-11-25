import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { requireCardWriter } from '@/lib/starboard/access';
import { removeStoragePaths } from '@/lib/starboard/storage';
import { dbFail, isUuid, notFoundResponse } from '@/lib/starboard/http';

type Params = { params: { attachmentId: string } };

/** 첨부 삭제(원본 deleteAttachment). 카드를 쓸 수 있는 사람만. 행과 Storage 파일을 함께 지운다. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  if (!isUuid(params.attachmentId)) return notFoundResponse();
  const { data: a } = await supabaseAdmin
    .from('sb_attachments')
    .select('id, card_id, storage_path, thumb_path')
    .eq('id', params.attachmentId)
    .maybeSingle();
  if (!a) return notFoundResponse();
  const ctx = await requireCardWriter(auth.actor, a.card_id as string);
  if ('error' in ctx) return ctx.error;
  const { error } = await supabaseAdmin.from('sb_attachments').delete().eq('id', a.id);
  if (error) return dbFail(error);
  await removeStoragePaths([a.storage_path, a.thumb_path].filter(Boolean) as string[]);
  return NextResponse.json({ ok: true });
}
