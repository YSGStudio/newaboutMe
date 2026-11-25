'use client';

/**
 * AttachmentThumbs / AttachmentDetail — 첨부 보기(원본 attachments/AttachmentList.tsx)
 * 카드 위에는 작은 썸네일과 링크 카드를, 카드 상세에서는 이미지 크게 보기·PDF 뷰어·영상 재생·링크 카드를 보여 줍니다.
 * 영상 썸네일에는 ▶ 표시를 얹습니다.
 */
import { useState } from 'react';
import type { AttachmentView } from '@/lib/starboard/types';
import LinkCard from './LinkCard';
import PdfViewer from './PdfViewer';
import { useSignedUrls } from './useSignedUrls';

/** 카드 위 썸네일(작게) */
export function AttachmentThumbs({ boardId, items }: { boardId: string; items: AttachmentView[] }) {
  const urls = useSignedUrls(boardId, items.map((a) => a.thumb_path).filter(Boolean) as string[]);
  if (!items.length) return null;
  return (
    <div className="sb-thumbs">
      <div className="sb-row-wrap">
        {items
          .filter((a) => a.type !== 'link')
          .map((a) =>
            a.thumb_path && urls[a.thumb_path] ? (
              <span key={a.id} className={a.type === 'video' ? 'sb-thumb-wrap is-video' : 'sb-thumb-wrap'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[a.thumb_path]} alt={a.name} className="sb-thumb" data-testid={`${a.type}-thumb`} />
              </span>
            ) : (
              <span key={a.id} className="sb-file-chip">
                <span aria-hidden="true">{a.type === 'pdf' ? '📄' : a.type === 'video' ? '🎬' : '🖼'}</span> {a.name}
              </span>
            ),
          )}
      </div>
      {items
        .filter((a) => a.type === 'link')
        .map((a) => (
          <LinkCard key={a.id} a={a} compact />
        ))}
    </div>
  );
}

/** 카드 상세의 첨부 목록: 이미지 크게 보기, PDF 뷰어, 링크 카드 */
export function AttachmentDetail({ boardId, items, canEdit, onDelete }: { boardId: string; items: AttachmentView[]; canEdit: boolean; onDelete: (id: string) => void }) {
  const paths = items.flatMap((a) => [a.thumb_path, a.storage_path]).filter(Boolean) as string[];
  const urls = useSignedUrls(boardId, paths);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pdf, setPdf] = useState<AttachmentView | null>(null);
  return (
    <div className="sb-stack">
      {items.map((a) => (
        <div key={a.id} className="sb-attachment-row">
          <div className="sb-flex-1">
            {a.type === 'image' && (
              <button
                type="button"
                className="sb-plain-btn"
                onClick={() => setZoom(a.storage_path && urls[a.storage_path] ? urls[a.storage_path] : null)}
                aria-label={`${a.name} 크게 보기`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(a.thumb_path && urls[a.thumb_path]) || (a.storage_path && urls[a.storage_path]) || ''} alt={a.name} className="sb-attachment-image" />
              </button>
            )}
            {a.type === 'pdf' && (
              <button type="button" className="sb-plain-btn sb-row-wrap" onClick={() => setPdf(a)} aria-label={`${a.name} 보기`}>
                {a.thumb_path && urls[a.thumb_path] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[a.thumb_path]} alt="" className="sb-attachment-pdf" data-testid="pdf-thumb" />
                )}
                <span>
                  <span aria-hidden="true">📄</span> {a.name}
                  {a.page_count ? ` · ${a.page_count}쪽` : ''}
                </span>
              </button>
            )}
            {a.type === 'video' && (
              <div className="sb-stack is-tight">
                {a.storage_path && urls[a.storage_path] ? (
                  <video
                    className="sb-attachment-video"
                    src={urls[a.storage_path]}
                    poster={(a.thumb_path && urls[a.thumb_path]) || undefined}
                    controls
                    playsInline
                    preload="metadata"
                    data-testid="video-player"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <p className="sb-meta">영상을 불러오는 중…</p>
                )}
                <span className="sb-meta">
                  <span aria-hidden="true">🎬</span> {a.name}
                </span>
              </div>
            )}
            {a.type === 'link' && <LinkCard a={a} />}
          </div>
          {canEdit && (
            <button type="button" className="sb-text-btn is-danger" onClick={() => onDelete(a.id)}>
              삭제
            </button>
          )}
        </div>
      ))}
      {pdf && pdf.storage_path && urls[pdf.storage_path] && (
        <div className="sb-pdf-box">
          <div className="sb-right">
            <button type="button" className="sb-text-btn" onClick={() => setPdf(null)}>
              닫기
            </button>
          </div>
          <PdfViewer url={urls[pdf.storage_path]} name={pdf.name} />
        </div>
      )}
      {zoom && (
        <div role="dialog" aria-label="이미지 크게 보기" className="sb-zoom" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" data-testid="image-full" />
        </div>
      )}
    </div>
  );
}
