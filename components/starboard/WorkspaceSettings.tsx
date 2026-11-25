'use client';

/**
 * WorkspaceSettings — 프로젝트 작업장 설정하기(원본 settings/WorkspaceSettings.tsx, 교사 전용)
 * 왼쪽 작업장 리스트: ⠿ 손잡이로 끌어 다른 작업장의 위·아래(순서) 또는 가운데(하위)로 옮기고,
 * ⋮ 메뉴로 이름 바꾸기·복제·하위 추가·학생별 보드·평가 기준·위/아래·삭제를 합니다.
 * 학생 개인 보드는 부모마다 "학생별 보드 N개" 묶음으로 접혀 있습니다.
 * 오른쪽: 고른 작업장의 상세 설정(BoardSettingsPanel).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import type { BoardView, Project, TreeNode } from '@/lib/starboard/types';
import { childrenMap, computeDrop, roots, type DropPlace } from '@/lib/starboard/tree';
import { json, useSb } from './context';
import { BoardSettingsPanel, type Tab } from './BoardSettings';

type Row = { node: TreeNode; depth: number } | { group: string; depth: number; count: number };

const DROP_MSG: Record<string, string> = {
  cycle: '작업장을 자기 자신이나 하위 작업장 안으로 옮길 수 없어요.',
  personal: '학생 개인 보드는 다른 작업장으로 옮길 수 없어요. 순서만 바꿀 수 있어요.',
};

type Props = { project: Project; nodes: TreeNode[]; counts: Record<string, number>; initialSelected: string | null; onTreeChanged: () => void };

export default function WorkspaceSettings({ project, nodes: treeNodes, counts, initialSelected, onTreeChanged }: Props) {
  const { api, go } = useSb();
  const [nodes, setNodes] = useState(treeNodes);
  const [seen, setSeen] = useState(treeNodes);
  if (seen !== treeNodes) {
    setSeen(treeNodes);
    setNodes(treeNodes);
  }
  const [selected, setSelected] = useState<string | null>(
    initialSelected && treeNodes.some((n) => n.id === initialSelected) ? initialSelected : (roots(treeNodes)[0]?.id ?? null),
  );
  const [panelTab, setPanelTab] = useState<{ tab: Tab; nonce: number }>({ tab: '일반', nonce: 0 });
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  // 선택한 작업장이 지워지면 첫 작업장을 고른다
  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  if (selected && !selectedNode && nodes.length) setSelected(roots(nodes)[0]?.id ?? null);

  const select = (id: string, tab: Tab = '일반') => {
    setSelected(id);
    setMessage(null);
    setPanelTab((p) => ({ tab, nonce: p.nonce + 1 }));
  };
  const done = (text: string) => setMessage({ kind: 'info', text });
  const failed = (text: string) => setMessage({ kind: 'error', text });

  // ── 트리를 화면 행으로 펼친다. 학생 개인 보드는 부모마다 접힌 묶음으로 둔다.
  const rows = useMemo(() => {
    const kids = childrenMap(nodes);
    const out: Row[] = [];
    const walk = (list: TreeNode[], depth: number) => {
      for (const n of list) {
        out.push({ node: n, depth });
        const children = kids.get(n.id) ?? [];
        const shared = children.filter((c) => c.kind === 'shared');
        const personal = children.filter((c) => c.kind === 'personal');
        walk(shared, depth + 1);
        if (personal.length) {
          out.push({ group: n.id, depth: depth + 1, count: personal.length });
          if (openGroups.has(n.id)) walk(personal, depth + 2);
        }
      }
    };
    walk(roots(nodes), 0);
    return out;
  }, [nodes, openGroups]);

  // ── 드래그 앤 드롭
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [drop, setDrop] = useState<DropPlace | null>(null);
  const placeFrom = (e: DragMoveEvent | DragEndEvent): DropPlace | null => {
    if (!e.over || e.over.id === e.active.id) return null;
    const start = e.activatorEvent as PointerEvent | TouchEvent;
    const y0 = 'touches' in start ? start.touches[0].clientY : start.clientY;
    const y = y0 + e.delta.y;
    const { top, height } = e.over.rect;
    const where = y < top + height * 0.28 ? 'before' : y > top + height * 0.72 ? 'after' : 'inside';
    return { overId: String(e.over.id), where };
  };
  const onDragEnd = (e: DragEndEvent) => {
    const place = placeFrom(e);
    setDrop(null);
    if (!place) return;
    const movingId = String(e.active.id);
    const r = computeDrop(nodes, movingId, place);
    if (!r.ok) {
      if (DROP_MSG[r.reason]) failed(DROP_MSG[r.reason]);
      return;
    }
    const before = nodes;
    // 낙관적 반영: 새 부모와 순서를 바로 보여 준다
    setNodes(
      nodes.map((n) => {
        const i = r.order.indexOf(n.id);
        if (i < 0) return n;
        return { ...n, parent_id: n.id === movingId ? r.parentId : n.parent_id, position: i + 1 };
      }),
    );
    if (r.parentId) setOpenGroups((s) => (nodes.find((n) => n.id === movingId)?.kind === 'personal' ? new Set(s).add(r.parentId!) : s));
    api(`/boards/${movingId}/place`, json('POST', { mode: 'drop', ...place }))
      .then(() => done('작업장을 옮겼어요.'))
      .catch((err: Error) => {
        setNodes(before);
        failed(err.message);
      })
      .finally(onTreeChanged);
  };

  const run = async (fn: () => Promise<unknown>, success: string, after?: (r: unknown) => void) => {
    try {
      const r = await fn();
      done(success);
      after?.(r);
    } catch (e) {
      failed(e instanceof Error ? e.message : '실패했어요.');
    }
    onTreeChanged();
  };

  const sharedCount = nodes.filter((n) => n.kind === 'shared').length;

  return (
    <main className="sb-workspace">
      <header className="sb-workspace-head">
        <h2>
          <span aria-hidden="true">⚙</span> 프로젝트 작업장 <span className="sb-underline">설정하기</span>
        </h2>
        <p className="hint">작업장을 추가·수정·복제·삭제하거나 끌어서 순서와 위치를 바꾸고, 작업장마다 상세 설정을 할 수 있어요.</p>
        <button type="button" className="sb-btn ghost sb-push-right" onClick={() => go({ name: 'home', projectId: project.id })}>
          ← {project.title}
        </button>
      </header>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'notice error' : 'notice success'} data-testid="workspace-message">
          {message.text}
          <button type="button" className="sb-text-btn" onClick={() => setMessage(null)}>
            닫기
          </button>
        </p>
      )}

      <div className="sb-workspace-grid">
        <section className="card sb-workspace-list" aria-labelledby="ws-list-h">
          <div className="sb-workspace-list-head">
            <h3 id="ws-list-h">
              <span aria-hidden="true">📦</span> 작업장 리스트 <span className="sb-meta">{sharedCount}</span>
            </h3>
            <AddWorkspace
              onAdd={(title) =>
                run(
                  () => api<{ id: string }>(`/projects/${project.id}/boards`, json('POST', { parentId: null, title })),
                  `'${title}' 작업장을 만들었어요.`,
                  (r) => select((r as { id: string }).id),
                )
              }
            />
          </div>
          <p className="hint">⠿ 손잡이를 끌어 작업장의 위·아래에 놓으면 순서가, 가운데에 놓으면 그 안(하위)으로 들어가요.</p>
          <DndContext id="workspace-tree" sensors={sensors} onDragMove={(e) => setDrop(placeFrom(e))} onDragCancel={() => setDrop(null)} onDragEnd={onDragEnd}>
            <ul className="sb-workspace-rows" data-testid="workspace-list">
              {rows.map((row) =>
                'group' in row ? (
                  <li key={`g:${row.group}`} style={{ paddingLeft: row.depth * 22 }}>
                    <button
                      type="button"
                      className="sb-group-toggle"
                      aria-expanded={openGroups.has(row.group)}
                      onClick={() =>
                        setOpenGroups((s) => {
                          const n = new Set(s);
                          if (n.has(row.group)) n.delete(row.group);
                          else n.add(row.group);
                          return n;
                        })
                      }
                    >
                      ↳ <span aria-hidden="true">👤</span> 학생별 보드 {row.count}개 {openGroups.has(row.group) ? '▾' : '▸'}
                    </button>
                  </li>
                ) : (
                  <WorkspaceRow
                    key={row.node.id}
                    node={row.node}
                    depth={row.depth}
                    count={counts[row.node.id] ?? 0}
                    selected={row.node.id === selected}
                    drop={drop?.overId === row.node.id ? drop.where : null}
                    onSelect={() => select(row.node.id)}
                    onRename={(title) => run(() => api(`/boards/${row.node.id}`, json('PATCH', { title })), '이름을 바꿨어요.')}
                    onDuplicate={() =>
                      run(
                        () => api<{ id: string; warning?: string }>(`/boards/${row.node.id}/duplicate`, json('POST')),
                        `'${row.node.title}' 작업장을 복제했어요. (카드는 복사하지 않아요)`,
                        (r) => {
                          const res = r as { id: string; warning?: string };
                          select(res.id);
                          if (res.warning) failed(res.warning);
                        },
                      )
                    }
                    onAddChild={(title) =>
                      run(() => api(`/projects/${project.id}/boards`, json('POST', { parentId: row.node.id, title })), `'${row.node.title}' 아래에 '${title}' 작업장을 만들었어요.`)
                    }
                    onPersonal={() => select(row.node.id, '개인 보드')}
                    onCriteria={() => select(row.node.id, '평가 기준')}
                    onMove={(dir) => run(() => api(`/boards/${row.node.id}/place`, json('POST', { mode: 'reorder', direction: dir })), '순서를 바꿨어요.')}
                    onDelete={() => run(() => api(`/boards/${row.node.id}`, json('DELETE')), `'${row.node.title}' 작업장을 지웠어요.`, () => setSelected(null))}
                  />
                ),
              )}
              {nodes.length === 0 && <li className="sb-empty-row">아직 작업장이 없어요. ＋ 작업장 추가로 시작해 보세요.</li>}
            </ul>
          </DndContext>
        </section>

        <section className="card sb-workspace-detail" aria-labelledby="ws-detail-h">
          {selectedNode ? (
            <DetailPanel
              key={`${selectedNode.id}:${panelTab.nonce}`}
              project={project}
              node={selectedNode}
              nodes={nodes}
              initialTab={panelTab.tab}
              onChanged={onTreeChanged}
              onDeleted={() => {
                setSelected(null);
                onTreeChanged();
              }}
            />
          ) : (
            <p id="ws-detail-h" className="sb-empty-row">
              왼쪽에서 작업장을 고르면 상세 설정이 나와요.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function AddWorkspace({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  if (!open)
    return (
      <button type="button" className="sb-btn sb-push-right" onClick={() => setOpen(true)}>
        ＋ 작업장 추가
      </button>
    );
  return (
    <form
      className="sb-inline-form sb-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim());
        setTitle('');
        setOpen(false);
      }}
    >
      <input autoFocus aria-label="새 작업장 이름" placeholder="새 작업장 이름" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
      <button className="sb-btn" disabled={!title.trim()}>
        추가
      </button>
      <button type="button" className="sb-btn ghost" onClick={() => setOpen(false)}>
        취소
      </button>
    </form>
  );
}

type RowProps = {
  node: TreeNode;
  depth: number;
  count: number;
  selected: boolean;
  drop: DropPlace['where'] | null;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onAddChild: (title: string) => void;
  onPersonal: () => void;
  onCriteria: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onDelete: () => void;
};

function WorkspaceRow({ node, depth, count, selected, drop, onSelect, onRename, onDuplicate, onAddChild, onPersonal, onCriteria, onMove, onDelete }: RowProps) {
  const shared = node.kind === 'shared';
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: dropRef } = useDroppable({ id: node.id });
  const [mode, setMode] = useState<'view' | 'rename' | 'child'>('view');
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setConfirmDelete(false);
      }
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  const pick = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };
  const cls = ['sb-ws-row', selected && 'is-selected', isDragging && 'is-dragging', drop === 'inside' && 'is-drop-inside'].filter(Boolean).join(' ');

  return (
    <li style={{ paddingLeft: depth * 22 }} data-testid="workspace-row" data-title={node.title}>
      <div
        ref={(el) => {
          dragRef(el);
          dropRef(el);
        }}
        className={cls}
      >
        {drop === 'before' && <span className="sb-drop-line is-before" aria-hidden="true" />}
        {drop === 'after' && <span className="sb-drop-line is-after" aria-hidden="true" />}
        <button type="button" className="sb-drag-handle" aria-label={`${node.title} 끌어서 옮기기`} title="끌어서 옮기기" {...listeners} {...attributes}>
          ⠿
        </button>
        {depth > 0 && (
          <span className="sb-meta" aria-hidden="true">
            ↳
          </span>
        )}
        {mode === 'view' ? (
          <button type="button" className="sb-ws-title" onClick={onSelect} aria-current={selected ? 'true' : undefined}>
            <span className="sb-truncate">
              {!shared && <span aria-hidden="true">👤 </span>}
              {node.title}
            </span>
          </button>
        ) : (
          <form
            className="sb-inline-form sb-flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              if (mode === 'rename') onRename(text.trim());
              else onAddChild(text.trim());
              setMode('view');
            }}
          >
            <input
              autoFocus
              aria-label={mode === 'rename' ? '작업장 새 이름' : '하위 작업장 이름'}
              placeholder={mode === 'rename' ? '새 이름' : '하위 작업장 이름'}
              maxLength={100}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setMode('view')}
            />
            <button className="sb-btn is-small" disabled={!text.trim()}>
              저장
            </button>
          </form>
        )}
        <span className="sb-ws-count" title="카드 수" data-testid="workspace-count">
          {count}
        </span>
        <div className="sb-menu-wrap" ref={menuRef}>
          <button type="button" className="sb-icon-btn" aria-label={`${node.title} 메뉴`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            ⋮
          </button>
          {menu && (
            <div role="menu" className="sb-menu">
              <button type="button" role="menuitem" onClick={pick(() => { setText(node.title); setMode('rename'); })}>
                <span aria-hidden="true">✏️</span> 이름 바꾸기
              </button>
              {shared && (
                <>
                  <button type="button" role="menuitem" onClick={pick(onDuplicate)}>
                    <span aria-hidden="true">📄</span> 복제하기
                  </button>
                  <button type="button" role="menuitem" onClick={pick(() => { setText(''); setMode('child'); })}>
                    ＋ 하위 작업장 추가
                  </button>
                  <button type="button" role="menuitem" onClick={pick(onPersonal)}>
                    <span aria-hidden="true">👤</span> 학생별 보드 추가
                  </button>
                  <button type="button" role="menuitem" onClick={pick(onCriteria)}>
                    <span aria-hidden="true">⭐</span> 평가 기준 설정
                  </button>
                </>
              )}
              <button type="button" role="menuitem" onClick={pick(() => onMove('up'))}>
                ▲ 위로
              </button>
              <button type="button" role="menuitem" onClick={pick(() => onMove('down'))}>
                ▼ 아래로
              </button>
              <hr />
              {confirmDelete ? (
                <button type="button" role="menuitem" className="is-danger is-strong" onClick={pick(onDelete)}>
                  정말 삭제 (하위·카드 모두)
                </button>
              ) : (
                <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirmDelete(true)}>
                  <span aria-hidden="true">🗑</span> 삭제
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** 오른쪽: 선택한 작업장의 상세 설정 */
function DetailPanel({
  project,
  node,
  nodes,
  initialTab,
  onChanged,
  onDeleted,
}: {
  project: Project;
  node: TreeNode;
  nodes: TreeNode[];
  initialTab: Tab;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { api, go } = useSb();
  const [view, setView] = useState<BoardView | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await api<{ view: BoardView }>(`/boards/${node.id}`);
      setView(r.view);
    } catch {
      setView(null);
    }
  }, [api, node.id]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="sb-stack">
      <div className="sb-row-wrap">
        <h3 id="ws-detail-h" className="sb-detail-title">
          <span aria-hidden="true">📦</span> <span className="sb-primary-text">[{node.title}]</span> 상세설정
        </h3>
        <span className="badge">{node.kind === 'personal' ? '학생 개인 보드' : '작업장'}</span>
        <button type="button" className="sb-btn ghost sb-push-right" onClick={() => go({ name: 'board', projectId: project.id, boardId: node.id })}>
          보드 열기 →
        </button>
      </div>
      {view ? (
        <BoardSettingsPanel
          view={view}
          projectId={project.id}
          tree={nodes}
          initialTab={initialTab}
          onChanged={() => {
            load();
            onChanged();
          }}
          onDeleted={onDeleted}
        />
      ) : (
        <p className="sb-empty-row">불러오는 중…</p>
      )}
    </div>
  );
}
