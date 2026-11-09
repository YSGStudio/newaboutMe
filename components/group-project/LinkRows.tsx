'use client';

/**
 * LinkRows — 링크 결과물 입력. 칸을 여러 줄로 늘려 한 번에 10개까지 올립니다.
 */
import { FormEvent, useRef, useState } from 'react';
import { MAX_LINKS, validateLinks } from '@/lib/group-project/upload';
import { useGp } from './context';
import { useAction } from './ui';

export default function LinkRows({ taskId, onSaved }: { taskId: string; onSaved: () => void }) {
  const { api } = useGp();
  const [rows, setRows] = useState([0]);
  const next = useRef(1);
  const { busy, run, feedback, setError } = useAction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const titles = fd.getAll('title').map(String);
    const links = fd.getAll('url').map((url, i) => ({ url: String(url), title: titles[i] ?? '' }));
    const check = validateLinks(links);
    if (!check.ok) return setError(check.error);

    const ok = await run(async () => {
      await api(`/tasks/${taskId}/links`, { method: 'POST', body: JSON.stringify({ links }) });
      onSaved();
      return check.links.length > 1 ? `링크 ${check.links.length}개를 올렸어요` : '링크를 올렸어요';
    });
    if (ok) {
      form.reset();
      setRows([next.current++]);
    }
  }

  return (
    <form onSubmit={submit} className="gp-form gp-subpanel" noValidate>
      <p className="gp-strong">링크 첨부</p>
      {rows.map((id, i) => (
        <div key={id} className="gp-link-row">
          <div className="gp-inline">
            <input name="url" type="url" required placeholder="https://" aria-label={`링크 주소 ${i + 1}`} />
            {rows.length > 1 && (
              <button type="button" className="ghost gp-btn gp-btn-sm" aria-label={`링크 ${i + 1} 빼기`} onClick={() => setRows((r) => r.filter((x) => x !== id))}>
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
          <input name="title" maxLength={200} placeholder="링크 이름 (선택)" aria-label={`링크 이름 ${i + 1}`} />
        </div>
      ))}
      {rows.length < MAX_LINKS && (
        <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => setRows((r) => [...r, next.current++])}>
          + 링크 칸 추가
        </button>
      )}
      {feedback}
      <button type="submit" className="ghost" disabled={busy}>
        링크 올리기
      </button>
    </form>
  );
}
