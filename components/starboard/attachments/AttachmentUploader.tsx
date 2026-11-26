'use client';

/**
 * AttachmentUploader — 카드 상세의 파일(이미지·PDF·영상) 첨부(원본 attachments/AttachmentUploader.tsx)
 * 올리는 방식은 upload-client.ts에 있습니다(새 카드 쓰기와 같은 길).
 * 링크는 버튼 없이 저장할 때 붙도록 CardModal의 LinkDraftInput이 맡습니다.
 */
import { useState } from 'react';
import { ACCEPT_FILES } from '@/lib/starboard/upload';
import { useSb } from '../context';
import { uploadCardFile } from './upload-client';

export default function AttachmentUploader({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const { api } = useSb();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      {error && <p className="sb-error">{error}</p>}
    </div>
  );
}
