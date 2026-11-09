'use client';

/**
 * AttachmentGallery — 대시보드 자료 모음
 * 이미지는 썸네일, PDF·링크는 아이콘, 글은 본문 미리보기로 보여 주고 할 일별·종류별로 거릅니다.
 */
import { useState } from 'react';
import { formatDateTime } from '@/lib/group-project/format';
import type { GpAttachmentView, GpTask } from '@/lib/group-project/types';
import { KIND_LABEL } from './AttachmentList';
import CopyButton from './CopyButton';

type Props = { items: GpAttachmentView[]; tasks: GpTask[]; onOpenTask: (taskId: string) => void };

export default function AttachmentGallery({ items, tasks, onOpenTask }: Props) {
  const [task, setTask] = useState('');
  const [kind, setKind] = useState('');
  const shown = items.filter((i) => (!task || i.task_id === task) && (!kind || i.kind === kind));
  const withFiles = new Set(items.map((i) => i.task_id));

  return (
    <div className="gp-stack">
      <div className="gp-filters">
        <label>
          할 일
          <select value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="">전체</option>
            {tasks.filter((t) => withFiles.has(t.id)).map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          종류
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">전체</option>
            <option value="image">이미지</option>
            <option value="pdf">PDF</option>
            <option value="link">링크</option>
            <option value="text">글</option>
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="hint">올라온 자료가 없어요</p>
      ) : (
        <ul className="gp-gallery">
          {shown.map((a) => (
            <li key={a.id}>
              {a.kind === 'text' ? (
                <button type="button" className="gp-gallery-text" onClick={() => onOpenTask(a.task_id)}>
                  {a.body}
                </button>
              ) : (
                <a href={a.href ?? '#'} target="_blank" rel="noopener noreferrer" className="gp-gallery-media">
                  {a.kind === 'image' && a.href ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.href} alt={a.file_name} loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{a.kind === 'pdf' ? '📄' : '🔗'}</span>
                  )}
                </a>
              )}
              <div className="gp-gallery-info">
                <p className="gp-ellipsis gp-strong" title={a.file_name}>
                  <small className="gp-kind">[{KIND_LABEL[a.kind]}]</small> {a.file_name}
                </p>
                <button type="button" className="gp-text-button gp-ellipsis" onClick={() => onOpenTask(a.task_id)}>
                  {a.taskTitle}
                </button>
                <p className="gp-meta gp-ellipsis">
                  {a.uploaderName} · {formatDateTime(a.created_at)}
                </p>
                {a.kind === 'text' && a.body && <CopyButton text={a.body} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
