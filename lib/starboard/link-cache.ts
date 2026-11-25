/**
 * 링크 미리보기 캐시(원본 app/api/link-preview/route.ts). 7일 동안 sb_link_previews에 둔다.
 * 내부망으로 가는 주소는 가져오지 않고 blocked로 돌려준다(화면은 URL만 보여 준다).
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BlockedUrlError, fetchLinkPreview, parseFetchableUrl } from './link-preview';

const CACHE_DAYS = 7;

export function urlHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

export async function getLinkPreview(url: string): Promise<Record<string, unknown>> {
  try {
    parseFetchableUrl(url);
  } catch {
    return { url, ok: false, blocked: true };
  }
  const url_hash = urlHash(url);
  const { data: cached } = await supabaseAdmin.from('sb_link_previews').select('*').eq('url_hash', url_hash).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_DAYS * 86400_000) return cached;

  let preview;
  try {
    preview = await fetchLinkPreview(url);
  } catch (e) {
    const blocked = e instanceof BlockedUrlError || (e as { cause?: { code?: string } })?.cause?.code === 'EBLOCKED';
    preview = { url, title: null, description: null, image_url: null, site_name: null, ok: false };
    if (blocked) return { ...preview, blocked: true };
  }
  const row = { url_hash, ...preview, fetched_at: new Date().toISOString() };
  await supabaseAdmin.from('sb_link_previews').upsert(row);
  return row;
}
