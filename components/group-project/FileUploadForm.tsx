'use client';

/**
 * FileUploadForm — 파일 여러 개를 한 개씩 차례로 올립니다.
 * Vercel 본문 한도(4.5MB)를 넘지 않게 파일마다 요청을 나누고, 진행 상황과 파일별 실패를 보여 줍니다.
 */
import { FormEvent, useRef, useState } from 'react';
import Notice from '@/components/ui/Notice';
import { MAX_FILES, validateUpload } from '@/lib/group-project/upload';
import { useGp } from './context';
import { Field } from './ui';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif';

export default function FileUploadForm({ taskId, onUploaded }: { taskId: string; onUploaded: () => void }) {
  const { api } = useGp();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const files = Array.from(ref.current?.files ?? []);
    setMessage('');
    if (files.length === 0) return setErrors(['올릴 파일을 고르세요']);
    if (files.length > MAX_FILES) return setErrors([`파일은 한 번에 ${MAX_FILES}개까지 올릴 수 있어요`]);

    setBusy(true);
    setErrors([]);
    const failed: string[] = [];
    let done = 0;
    for (const [i, file] of files.entries()) {
      setProgress(`${i + 1}/${files.length} 올리는 중...`);
      // 413으로 끊기기 전에 브라우저에서 먼저 거른다.
      const check = validateUpload({ name: file.name, size: file.size, type: file.type });
      if (!check.ok) {
        failed.push(`${file.name}: ${check.error}`);
        continue;
      }
      const fd = new FormData();
      fd.append('file', file);
      try {
        await api(`/tasks/${taskId}/files`, { method: 'POST', body: fd });
        done++;
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : '올리지 못했어요'}`);
      }
    }
    setBusy(false);
    setProgress('');
    setErrors(failed);
    if (done > 0) {
      setMessage(files.length > 1 ? `파일 ${done}개를 올렸어요` : '파일을 올렸어요');
      onUploaded();
    }
    if (failed.length === 0 && ref.current) ref.current.value = '';
  }

  return (
    <form onSubmit={submit} className="gp-form gp-subpanel" aria-busy={busy}>
      <Field label="파일 첨부" hint={`PDF, 이미지(PNG·JPG·WEBP·GIF), 한 개에 4MB 이하, 한 번에 ${MAX_FILES}개까지. 더 큰 파일은 링크로 올려 주세요. 개인정보가 담긴 사진은 올리지 마세요.`}>
        <input ref={ref} type="file" multiple required accept={ACCEPT} disabled={busy} />
      </Field>
      <button type="submit" className="ghost" disabled={busy}>
        {progress || '파일 올리기'}
      </button>
      {errors.length > 0 && (
        <ul role="alert" className="gp-error-list">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      <Notice type="success" message={message} />
    </form>
  );
}
