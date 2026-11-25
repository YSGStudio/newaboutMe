'use client';

/**
 * BoardTree — 사이드바의 작업장(보드) 트리(원본 components/BoardTree.tsx). 딥스페이스 배경 위에 그립니다.
 * 접고 펼치기, 현재 작업장까지 자동 펼침, 개인 보드 👤, 학생의 읽기 전용 "(읽기)", 작업장별 보이는 카드 수.
 * 접근할 수 없는 상위 작업장은 이름만 흐리게 보입니다. 교사는 줄에 올리면 나오는 ＋로 하위 작업장을 더합니다.
 */
import { useState } from 'react';
import { childrenMap, pathTo, roots } from '@/lib/starboard/tree';
import type { TreeNode } from '@/lib/starboard/types';
import { json, useSb } from './context';

type Props = { projectId: string; nodes: TreeNode[]; currentId?: string; counts?: Record<string, number>; onChanged: () => void };

export default function BoardTree({ projectId, nodes, currentId, counts = {}, onChanged }: Props) {
  const { isTeacher, go } = useSb();
  const kids = childrenMap(nodes);
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.map((n) => n.id)));
  const [seenCurrent, setSeenCurrent] = useState(currentId);
  if (seenCurrent !== currentId) {
    // 다른 작업장으로 이동하면 그 작업장까지의 경로를 펼친다
    setSeenCurrent(currentId);
    if (currentId) setOpen((s) => new Set([...s, ...pathTo(nodes, currentId).map((n) => n.id)]));
  }
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const render = (n: TreeNode, depth: number) => {
    const c = kids.get(n.id) ?? [];
    const isOpen = open.has(n.id);
    const current = n.id === currentId;
    return (
      <li key={n.id}>
        <div className={current ? 'sb-tree-row is-current' : 'sb-tree-row'} style={{ paddingLeft: 4 + Math.min(depth, 8) * 16 }}>
          {c.length > 0 ? (
            <button
              type="button"
              className="sb-tree-toggle"
              aria-label={isOpen ? `${n.title} 접기` : `${n.title} 펼치기`}
              aria-expanded={isOpen}
              onClick={() => toggle(n.id)}
            >
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="sb-tree-dot" aria-hidden="true">
              {depth > 0 ? '↳' : '·'}
            </span>
          )}
          {n.accessible ? (
            <button
              type="button"
              className="sb-tree-link"
              data-testid="tree-board"
              aria-current={current ? 'page' : undefined}
              title={n.title}
              onClick={() => go({ name: 'board', projectId, boardId: n.id })}
            >
              <span className="sb-truncate">
                {n.kind === 'personal' && <span aria-hidden="true">👤 </span>}
                {n.title}
              </span>
              {!isTeacher && n.access === 'read' && <span className="sb-tree-note">(읽기)</span>}
            </button>
          ) : (
            <span className="sb-tree-dim sb-truncate" data-testid="tree-board-dim" title="접근 권한 없음">
              {n.title}
            </span>
          )}
          {isTeacher && <AddChild projectId={projectId} parentId={n.id} onAdded={() => { setOpen((s) => new Set(s).add(n.id)); onChanged(); }} />}
          {n.accessible && (
            <span className="sb-tree-count" data-testid="tree-count">
              {counts[n.id] ?? 0}
            </span>
          )}
        </div>
        {c.length > 0 && isOpen && <ul>{c.map((x) => render(x, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <nav aria-label="작업장 목록" className="sb-tree">
      <ul>{roots(nodes).map((n) => render(n, 0))}</ul>
      {nodes.length === 0 && <p className="sb-tree-empty">{isTeacher ? '작업장을 만들어 보세요' : '아직 열린 작업장이 없어요'}</p>}
    </nav>
  );
}

function AddChild({ projectId, parentId, onAdded }: { projectId: string; parentId: string; onAdded: () => void }) {
  const { api } = useSb();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  if (!editing) {
    return (
      <button type="button" className="sb-tree-add" aria-label="하위 작업장 추가" title="하위 작업장 추가" onClick={() => setEditing(true)}>
        ＋
      </button>
    );
  }
  return (
    <form
      className="sb-tree-add-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api(`/projects/${projectId}/boards`, json('POST', { parentId, title }));
          setTitle('');
          setEditing(false);
          onAdded();
        } finally {
          setPending(false);
        }
      }}
    >
      <input autoFocus aria-label="하위 작업장 이름" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => !title && setEditing(false)} />
      <button className="sb-btn-gold" disabled={pending || !title.trim()}>
        추가
      </button>
    </form>
  );
}
