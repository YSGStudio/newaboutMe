'use client';

/**
 * LinkDraftInput — 카드에 붙일 링크 칸(넣기 버튼 없음)
 * 주소를 붙여 넣기만 하면 되고, 여러 개면 줄을 바꿉니다. 카드를 올리거나 저장할 때 parseLinks 결과가 그대로 첨부됩니다.
 * 붙여 넣은 주소마다 미리보기(제목·설명·대표 이미지)를 바로 보여 줍니다 — 서버 /link-preview가 가져오고 캐시합니다.
 */
import { useEffect, useRef, useState } from 'react';
import { MAX_DRAFT_LINKS, parseLinks } from '@/lib/starboard/upload';
import type { AttachmentView } from '@/lib/starboard/types';
import { json, useSb } from '../context';
import LinkCard from './LinkCard';

type Preview = AttachmentView['preview'];

export default function LinkDraftInput({ value, onChange, disabled, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; id: string }) {
  const { api } = useSb();
  const { urls, invalid } = parseLinks(value);
  const [previews, setPreviews] = useState<Record<string, Preview | 'loading'>>({});
  const asked = useRef(new Set<string>());

  // 입력이 멈추고 0.5초 뒤에 새 주소만 미리보기를 묻는다.
  const key = urls.join('\n');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const url of key ? key.split('\n') : []) {
        if (asked.current.has(url)) continue;
        asked.current.add(url);
        setPreviews((p) => ({ ...p, [url]: 'loading' }));
        api<Preview>('/link-preview', json('POST', { url }))
          .then((preview) => setPreviews((p) => ({ ...p, [url]: preview })))
          .catch(() => setPreviews((p) => ({ ...p, [url]: null })));
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [api, key]);

  return (
    <div className="sb-link-draft">
      <label htmlFor={id}>🔗 링크</label>
      <textarea
        id={id}
        rows={2}
        value={value}
        disabled={disabled}
        placeholder="링크 주소를 붙여 넣어요. 여러 개면 줄을 바꿔요."
        onChange={(e) => onChange(e.target.value)}
        data-testid="link-draft"
      />
      {invalid.length > 0 && <p className="sb-error">주소가 아닌 것 같아요: {invalid.slice(0, 3).join(', ')}</p>}
      {urls.length >= MAX_DRAFT_LINKS && <p className="sb-meta">링크는 한 번에 {MAX_DRAFT_LINKS}개까지 붙일 수 있어요.</p>}
      {urls.length > 0 && (
        <ul className="sb-link-draft-previews" aria-label="링크 미리보기" data-testid="link-draft-previews">
          {urls.map((url) => {
            const p = previews[url];
            return (
              <li key={url}>
                {p === 'loading' || p === undefined ? (
                  <span className="sb-meta">미리보기를 불러오는 중… {url}</span>
                ) : (
                  <LinkCard a={{ id: url, type: 'link', name: url, url, storage_path: null, thumb_path: null, size: null, page_count: null, preview: p } as AttachmentView} compact />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
