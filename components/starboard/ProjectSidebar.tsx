'use client';

/**
 * ProjectSidebar — 프로젝트 방 왼쪽 작업장 사이드바(원본 ProjectSidebar)
 * 프로젝트 제목(누르면 메인), "작업장 N", 교사에게 "＋ 작업장 추가"·"⚙ 작업장 설정", 작업장 트리.
 * 좁은 화면에서는 트리를 "작업장 목록 펼치기/접기"로 감쌉니다.
 * 맨 아래 .sb-sidebar-actions는 작업장 화면의 교사 버튼 자리입니다(작업장 화면 위 머리 줄을 없애서 옮겨 옴).
 */
import { useState } from 'react';
import type { TreeNode } from '@/lib/starboard/types';
import { json, useSb } from './context';
import BoardTree from './BoardTree';

type Props = {
  projectId: string;
  title: string;
  nodes: TreeNode[];
  counts: Record<string, number>;
  currentId?: string;
  onHome: boolean;
  onChanged: () => void;
  /** 작업장 화면의 교사 버튼이 들어올 자리(BoardScreen이 포털로 채운다) */
  actionsRef?: (el: HTMLDivElement | null) => void;
};

export default function ProjectSidebar({ projectId, title, nodes, counts, currentId, onHome, onChanged, actionsRef }: Props) {
  const { isTeacher, go } = useSb();
  const boardCount = nodes.filter((n) => n.accessible).length;
  const tree = <BoardTree projectId={projectId} nodes={nodes} currentId={currentId} counts={counts} onChanged={onChanged} />;
  return (
    <aside className="sb-sidebar" data-testid="project-sidebar">
      <button
        type="button"
        className={onHome ? 'sb-sidebar-home is-active' : 'sb-sidebar-home'}
        aria-current={onHome ? 'page' : undefined}
        onClick={() => go({ name: 'home', projectId })}
        title={title}
      >
        <span aria-hidden="true">🏠</span>
        <span className="sb-sidebar-title">{title}</span>
      </button>
      <div className="sb-sidebar-head">
        <h2>
          작업장 <span className="sb-gold">{boardCount}</span>
        </h2>
        {isTeacher && (
          <div className="sb-sidebar-actions">
            <AddRootBoard projectId={projectId} onAdded={onChanged} />
            <button
              type="button"
              className="sb-btn-dark"
              data-testid="workspace-settings-link"
              onClick={() => go({ name: 'settings', projectId, boardId: currentId ?? null })}
            >
              ⚙ 작업장 설정
            </button>
          </div>
        )}
      </div>
      <details className="sb-sidebar-mobile" open={!currentId}>
        <summary>
          <span className="sb-when-closed">▸ 작업장 목록 펼치기</span>
          <span className="sb-when-open">▾ 작업장 목록 접기</span>
        </summary>
        {tree}
      </details>
      <div className="sb-sidebar-desktop">{tree}</div>
      {actionsRef && <div ref={actionsRef} className="sb-sidebar-actions" />}
    </aside>
  );
}

/** 사이드바 머리의 "＋ 작업장 추가"(최상위 작업장) */
function AddRootBoard({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const { api } = useSb();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!open) {
    return (
      <button type="button" className="sb-btn-dark" onClick={() => setOpen(true)}>
        ＋ 작업장 추가
      </button>
    );
  }
  return (
    <form
      className="sb-inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api(`/projects/${projectId}/boards`, json('POST', { parentId: null, title }));
          setTitle('');
          setError('');
          setOpen(false);
          onAdded();
        } catch (err) {
          setError(err instanceof Error ? err.message : '만들지 못했습니다.');
        } finally {
          setPending(false);
        }
      }}
    >
      <input
        autoFocus
        aria-label="새 작업장 이름"
        placeholder="새 작업장 이름"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      <button className="sb-btn-gold" disabled={pending || !title.trim()}>
        추가
      </button>
      {error && <p className="sb-error-dark">{error}</p>}
    </form>
  );
}
