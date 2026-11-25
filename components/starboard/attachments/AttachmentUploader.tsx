'use client';

/**
 * AttachmentUploader — 파일(이미지·PDF)·링크 첨부(원본 attachments/AttachmentUploader.tsx)
 * 썸네일을 브라우저에서 만든 뒤, 라우트가 발급한 한 번 쓰는 업로드 주소로 Storage에 직접 올리고 등록합니다.
 * 서버(Vercel) 본문 4.5MB 제한을 거치지 않으므로 원본 한도(이미지 10MB·PDF 20MB)를 그대로 지킵니다.
 */
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { checkFile, normalizeLink } from '@/lib/starboard/upload';
import { json, useSb } from '../context';
import { imageThumbnail, pdfThumbnail } from './thumbs';

const BUCKET = 'starboard-files';

type Prepared = { path: string; token: string; thumb: { path: string; token: string } | null };

export default function AttachmentUploader({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const { api } = useSb();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  async function uploadFile(file: File) {
    setError('');
    const check = checkFile(file);
    if ('error' in check) return setError(check.error);
    setBusy(true);
    try {
      let thumb: Blob | null = null;
      let pages: number | null = null;
      try {
        if (check.kind === 'image') thumb = await imageThumbnail(file);
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
      if (up.error) throw new Error('파일을 올리지 못했습니다.');
      let thumbOk = false;
      if (thumb && prep.thumb) {
        const t = await storage.uploadToSignedUrl(prep.thumb.path, prep.thumb.token, thumb, { contentType: 'image/png' });
        thumbOk = !t.error;
      }
      await api(`/cards/${cardId}/attachments`, json('POST', { action: 'register', path: prep.path, name: file.name, pageCount: pages, thumb: thumbOk }));
      onDone();
    } catch (e) {
      setError(`첨부하지 못했습니다: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    setError('');
    const url = normalizeLink(link);
    if (!url) return setError('링크 주소가 올바르지 않습니다.');
    setBusy(true);
    try {
      await api(`/cards/${cardId}/attachments`, json('POST', { action: 'link', url }));
      setLink('');
      onDone();
    } catch (e) {
      setError(`링크를 추가하지 못했습니다: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-uploader">
      <label className="sb-file-label">
        {busy ? '올리는 중…' : '파일 첨부 (이미지·PDF)'}
        <input
          type="file"
          className="sb-sr-only"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          disabled={busy}
          data-testid="file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) uploadFile(f);
          }}
        />
      </label>
      <form
        className="sb-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) addLink();
        }}
      >
        <input placeholder="링크 주소" aria-label="링크 주소" value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="sb-btn ghost" disabled={busy || !link.trim()}>
          링크 추가
        </button>
      </form>
      {error && <p className="sb-error">{error}</p>}
    </div>
  );
}
