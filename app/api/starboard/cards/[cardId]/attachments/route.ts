import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireActor } from '@/lib/group-project/actor';
import { authorColumns, requireCardWriter } from '@/lib/starboard/access';
import { getLinkPreview } from '@/lib/starboard/link-cache';
import { BUCKET, removeStoragePaths } from '@/lib/starboard/storage';
import { checkFile, fileExt, isCardFilePath, normalizeLink, thumbPathOf } from '@/lib/starboard/upload';
import { dbFail, jsonError, readJson } from '@/lib/starboard/http';

type Params = { params: { cardId: string } };

/**
 * 첨부 추가. 카드를 쓸 수 있는 사람(교사, 또는 수정 권한이 있는 작성자)만.
 *   { action: 'prepare', name, size, type, thumb }  → 한 번 쓰는 업로드 URL 발급(원본·썸네일)
 *   { action: 'register', path, name, pageCount, thumb } → 업로드한 파일을 Storage에서 확인하고 행을 만든다
 *   { action: 'link', url }                          → 미리보기를 가져와 캐시하고 링크 행을 만든다
 * 원본은 브라우저가 Storage 정책 아래 직접 올렸다. 여기서는 정책이 없으므로 라우트가 경로를 정해 서명해 준다.
 * Vercel 본문 4.5MB 제한을 피하려고 파일은 라우트를 거치지 않는다(원본 한도 10MB·20MB 유지).
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireActor(req);
  if ('error' in auth) return auth.error;
  const ctx = await requireCardWriter(auth.actor, params.cardId);
  if ('error' in ctx) return ctx.error;
  const body = await readJson(req);
  const base = `${ctx.board.id}/${ctx.card.id}`;

  if (body.action === 'prepare') {
    const check = checkFile({ type: String(body.type ?? ''), size: Number(body.size ?? 0) });
    if ('error' in check) return jsonError(check.error, 400);
    const path = `${base}/${randomUUID()}.${fileExt(String(body.name ?? ''), String(body.type))}`;
    const storage = supabaseAdmin.storage.from(BUCKET);
    const main = await storage.createSignedUploadUrl(path);
    if (main.error) return dbFail(main.error);
    let thumb: { path: string; token: string } | null = null;
    if (body.thumb === true) {
      const t = await storage.createSignedUploadUrl(thumbPathOf(path));
      if (!t.error) thumb = { path: t.data.path, token: t.data.token };
    }
    return NextResponse.json({ path: main.data.path, token: main.data.token, thumb });
  }

  if (body.action === 'register') {
    const path = String(body.path ?? '');
    if (!isCardFilePath(path, ctx.board.id, ctx.card.id)) return jsonError('첨부 경로가 올바르지 않습니다.', 400);
    const storage = supabaseAdmin.storage.from(BUCKET);
    const info = await storage.info(path);
    if (info.error || !info.data) return jsonError('파일이 올라가지 않았습니다. 다시 시도해 주세요.', 400);
    // 실제 저장된 크기·형식으로 다시 검사한다(브라우저가 알린 값은 믿지 않는다)
    const meta = (info.data.metadata ?? {}) as { size?: number; mimetype?: string };
    const size = Number(info.data.size ?? meta.size ?? 0);
    const type = String(info.data.contentType ?? meta.mimetype ?? '');
    const check = checkFile({ type, size });
    const thumbPath = thumbPathOf(path);
    const hasThumb = body.thumb === true && (await storage.exists(thumbPath)).data === true;
    if ('error' in check) {
      await removeStoragePaths([path, ...(hasThumb ? [thumbPath] : [])]);
      return jsonError(check.error, 400);
    }
    const pageCount = check.kind === 'pdf' && Number.isInteger(body.pageCount) && (body.pageCount as number) > 0 ? body.pageCount : null;
    const { error } = await supabaseAdmin.from('sb_attachments').insert({
      card_id: ctx.card.id,
      type: check.kind,
      name: String(body.name ?? '').slice(0, 255),
      storage_path: path,
      thumb_path: hasThumb ? thumbPath : null,
      size,
      page_count: pageCount,
      ...authorColumns(auth.actor, 'created_by'),
    });
    if (error) {
      await removeStoragePaths([path, ...(hasThumb ? [thumbPath] : [])]);
      return dbFail(error);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'link') {
    const url = normalizeLink(String(body.url ?? ''));
    if (!url) return jsonError('링크 주소가 올바르지 않습니다.', 400);
    // 미리보기는 서버가 가져와 캐시한다(실패하거나 내부망이면 URL만 표시)
    await getLinkPreview(url).catch(() => null);
    const { error } = await supabaseAdmin.from('sb_attachments').insert({
      card_id: ctx.card.id,
      type: 'link',
      url,
      name: url.slice(0, 255),
      ...authorColumns(auth.actor, 'created_by'),
    });
    if (error) return dbFail(error);
    return NextResponse.json({ ok: true });
  }

  return jsonError('요청이 올바르지 않습니다.', 400);
}
