'use client';

/**
 * 카드 첨부 올리기(브라우저) — 카드 상세의 AttachmentUploader와 새 카드 쓰기(AddCard)가 함께 씁니다.
 * 썸네일을 브라우저에서 만든 뒤, 라우트가 발급한 한 번 쓰는 업로드 주소로 Storage에 직접 올리고 등록합니다.
 * 서버(Vercel) 본문 4.5MB 제한을 거치지 않으므로 한도(이미지 10MB·PDF 20MB·영상 50MB)를 그대로 지킵니다.
 */
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { checkFile, normalizeLink } from '@/lib/starboard/upload';
import { json } from '../context';
import { imageThumbnail, pdfThumbnail, videoThumbnail } from './thumbs';

const BUCKET = 'starboard-files';

type Api = <T>(url: string, init?: RequestInit) => Promise<T>;
type Prepared = { path: string; token: string; thumb: { path: string; token: string } | null };

export async function uploadCardFile(api: Api, cardId: string, file: File): Promise<void> {
  const check = checkFile(file);
  if ('error' in check) throw new Error(check.error);
  let thumb: Blob | null = null;
  let pages: number | null = null;
  try {
    if (check.kind === 'image') thumb = await imageThumbnail(file);
    else if (check.kind === 'video') thumb = await videoThumbnail(file);
    else {
      const r = await pdfThumbnail(file);
      thumb = r.thumb;
      pages = r.pages;
    }
  } catch {
    thumb = null; // 썸네일을 못 만들면 원본만
  }
  const prep = await api<Prepared>(
    `/cards/${cardId}/attachments`,
    json('POST', { action: 'prepare', name: file.name, size: file.size, type: file.type, thumb: Boolean(thumb) }),
  );
  const storage = createSupabaseBrowser().storage.from(BUCKET);
  const up = await storage.uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
  if (up.error) throw new Error('파일을 올리지 못했어요.');
  let thumbOk = false;
  if (thumb && prep.thumb) {
    const t = await storage.uploadToSignedUrl(prep.thumb.path, prep.thumb.token, thumb, { contentType: 'image/png' });
    thumbOk = !t.error;
  }
  await api(`/cards/${cardId}/attachments`, json('POST', { action: 'register', path: prep.path, name: file.name, pageCount: pages, thumb: thumbOk }));
}

export async function addCardLink(api: Api, cardId: string, raw: string): Promise<void> {
  const url = normalizeLink(raw);
  if (!url) throw new Error('링크 주소가 올바르지 않아요.');
  await api(`/cards/${cardId}/attachments`, json('POST', { action: 'link', url }));
}
