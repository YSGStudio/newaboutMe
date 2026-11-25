'use client';

/**
 * PdfViewer — 카드 상세의 PDF 뷰어(원본 attachments/PdfViewer.tsx). ◀ 쪽/전체 ▶로 넘겨 봅니다.
 */
import { useEffect, useRef, useState } from 'react';
import { loadPdfJs } from './pdf';

type Doc = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfJs>>['getDocument']>['promise']>;

export default function PdfViewer({ url, name }: { url: string; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    let d: Doc | null = null;
    let cancelled = false;
    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url }).promise)
      .then((loaded) => {
        d = loaded;
        if (cancelled) loaded.loadingTask.destroy();
        else setDoc(loaded);
      })
      .catch(() => setError('PDF를 열 수 없습니다.'));
    return () => {
      cancelled = true;
      d?.loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    doc.getPage(page).then((p) => {
      if (cancelled || !canvas.current) return;
      const width = box.current?.clientWidth ?? 600;
      const base = p.getViewport({ scale: 1 });
      const ratio = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: (width / base.width) * ratio });
      const c = canvas.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(vp.width / ratio)}px`;
      task = p.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp });
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page]);

  return (
    <div ref={box} className="sb-pdf-viewer" data-testid="pdf-viewer">
      <div className="sb-pdf-bar">
        <span className="sb-truncate sb-flex-1">{name}</span>
        <button type="button" className="sb-btn ghost is-small" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="이전 페이지">
          ◀
        </button>
        <span data-testid="pdf-page">
          {page} / {doc?.numPages ?? '?'}
        </span>
        <button type="button" className="sb-btn ghost is-small" disabled={!doc || page >= doc.numPages} onClick={() => setPage(page + 1)} aria-label="다음 페이지">
          ▶
        </button>
      </div>
      {error ? <p className="sb-error">{error}</p> : <canvas ref={canvas} />}
    </div>
  );
}
