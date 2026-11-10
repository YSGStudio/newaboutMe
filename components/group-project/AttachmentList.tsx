'use client';

/**
 * AttachmentList — 할 일의 "올린 결과물" 목록
 * 종류, 이름, 올린 사람, 시각을 보여 주고 글 결과물은 맨 위에 복사 버튼과 함께 둡니다.
 */
import { useState } from 'react';
import { useAction } from './ui';
import { useGp } from './context';
import CopyButton from './CopyButton';
import Linkify from './Linkify';
import { formatDateTime } from '@/lib/group-project/format';
import type { GpAttachmentView } from '@/lib/group-project/types';

export const KIND_LABEL = { image: '이미지', pdf: 'PDF', link: '링크', text: '글' } as const;

type Props = { items: GpAttachmentView[]; onChanged: () => void };

export default function AttachmentList({ items, onChanged }: Props) {
  const { api, confirmDelete } = useGp();
  const { run, feedback, busy } = useAction();
  // 지우기를 누른 결과물은 서버 응답을 기다리지 않고 바로 감춘다. 실패하면 다시 보인다.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  async function remove(a: GpAttachmentView) {
    if (!(await confirmDelete(`"${a.file_name}"을(를) 지울까요?`))) return;
    setHiddenIds((prev) => new Set(prev).add(a.id));
    const ok = await run(async () => {
      await api(`/attachments/${a.id}`, { method: 'DELETE' });
    });
    if (ok) {
      onChanged();
    } else {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(a.id);
        return next;
      });
    }
  }

  const visible = items.filter((a) => !hiddenIds.has(a.id));
  if (visible.length === 0) return <p className="hint">아직 결과물이 없어요</p>;

  // 글을 먼저 읽도록 글 결과물을 위로 올린다(같은 종류 안에서는 원래 순서 유지)
  const sorted = [...visible].sort((a, b) => Number(b.kind === 'text') - Number(a.kind === 'text'));

  return (
    <>
      {feedback}
      <ul className="gp-attachments">
        {sorted.map((a) => (
          <li key={a.id}>
            <div className="gp-attachment-main">
              {a.kind === 'image' && a.href && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.href} alt="" className="gp-thumb-sm" />
              )}
              <div className="gp-min">
                {a.kind === 'text' ? (
                  <>
                    <p className="gp-strong">
                      <small className="gp-kind">[{KIND_LABEL[a.kind]}]</small> {a.file_name}
                    </p>
                    <p className="gp-text-result">
                      <Linkify text={a.body ?? ''} />
                    </p>
                  </>
                ) : (
                  <a href={a.href ?? '#'} target="_blank" rel="noopener noreferrer" className="gp-link gp-strong">
                    <small className="gp-kind">[{KIND_LABEL[a.kind]}]</small> {a.file_name}
                  </a>
                )}
                <p className="gp-meta">
                  {a.uploaderName} · {formatDateTime(a.created_at)}
                  {a.size_bytes ? ` · ${(a.size_bytes / 1024 / 1024).toFixed(1)}MB` : ''}
                </p>
              </div>
            </div>
            <div className="gp-actions">
              {a.kind === 'text' && a.body && <CopyButton text={a.body} />}
              {a.canDelete && (
                <button type="button" className="gp-btn gp-btn-sm gp-danger" disabled={busy} onClick={() => remove(a)}>
                  삭제
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
