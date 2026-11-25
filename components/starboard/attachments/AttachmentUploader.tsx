'use client';

/**
 * AttachmentUploader — 카드 상세의 파일(이미지·PDF·영상)·링크 첨부(원본 attachments/AttachmentUploader.tsx)
 * 올리는 방식은 upload-client.ts에 있습니다(새 카드 쓰기와 같은 길).
 */
import { useState } from 'react';
import { ACCEPT_FILES } from '@/lib/starboard/upload';
import { useSb } from '../context';
import { addCardLink, uploadCardFile } from './upload-client';

export default function AttachmentUploader({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const { api } = useSb();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  const run = async (work: () => Promise<void>, fail: string) => {
    setError('');
    setBusy(true);
    try {
      await work();
      onDone();
    } catch (e) {
      setError(`${fail}: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sb-uploader">
      <label className="sb-file-label">
        {busy ? '올리는 중…' : '파일 첨부 (이미지·PDF·영상)'}
        <input
          type="file"
          className="sb-sr-only"
          accept={ACCEPT_FILES}
          disabled={busy}
          data-testid="file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) run(() => uploadCardFile(api, cardId, f), '첨부하지 못했어요');
          }}
        />
      </label>
      <form
        className="sb-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) run(async () => {
            await addCardLink(api, cardId, link);
            setLink('');
          }, '링크를 추가하지 못했어요');
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
