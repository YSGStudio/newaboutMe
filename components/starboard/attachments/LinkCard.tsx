/**
 * LinkCard — 링크 첨부 카드(원본 attachments/LinkCard.tsx)
 * 서버가 가져온 미리보기(제목·설명·대표 이미지·사이트)가 있으면 카드로, 없으면 URL만 보여 줍니다.
 */
import type { AttachmentView } from '@/lib/starboard/types';

export default function LinkCard({ a, compact }: { a: AttachmentView; compact?: boolean }) {
  const url = a.url ?? '';
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {}
  const p = a.preview;
  if (!p?.ok) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="sb-link-url" data-testid="link-url-only">
        {url}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={compact ? 'sb-link-card is-compact' : 'sb-link-card'} data-testid="link-card">
      {p.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt="" referrerPolicy="no-referrer" loading="lazy" />
      )}
      <span className="sb-link-card-text">
        <span className="sb-link-card-title">{p.title ?? url}</span>
        {!compact && p.description && <span className="sb-link-card-desc">{p.description}</span>}
        <span className="sb-meta sb-truncate">{p.site_name ?? domain}</span>
      </span>
    </a>
  );
}
