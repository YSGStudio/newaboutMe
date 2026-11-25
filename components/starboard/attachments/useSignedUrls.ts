'use client';

/**
 * 비공개 버킷 파일의 서명 URL(600초). 원본은 브라우저가 Storage 정책 아래 직접 받았다.
 * 여기서는 라우트가 그 사람에게 보이는 작업장 뷰에 있는 경로만 서명해 준다(가리기 규칙 그대로).
 * 만료 1분 전이면 다시 받는다.
 */
import { useEffect, useState } from 'react';
import { json, useSb } from '../context';

const TTL_MS = 600_000;
const cache = new Map<string, { url: string; exp: number }>();

export function useSignedUrls(boardId: string, paths: string[]): Record<string, string> {
  const { api } = useSb();
  const key = [...new Set(paths)].sort().join('|');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const list = key ? key.split('|') : [];
    const now = Date.now();
    const missing = list.filter((p) => !cache.has(p) || cache.get(p)!.exp < now + 60_000);
    const fill = () => {
      const out: Record<string, string> = {};
      for (const p of list) {
        const c = cache.get(p);
        if (c) out[p] = c.url;
      }
      setUrls(out);
    };
    if (!missing.length) {
      fill();
      return;
    }
    let cancelled = false;
    api<{ urls: Record<string, string> }>(`/boards/${boardId}/signed-urls`, json('POST', { paths: missing }))
      .then(({ urls: got }) => {
        for (const [p, url] of Object.entries(got)) cache.set(p, { url, exp: Date.now() + TTL_MS });
        if (!cancelled) fill();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, boardId, key]);
  return urls;
}
