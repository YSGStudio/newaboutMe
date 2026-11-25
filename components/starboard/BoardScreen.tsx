'use client';

/**
 * BoardScreen — 작업장 화면(원본 boards/[boardId]/page.tsx + BoardClient)
 * 경로(프로젝트 › … › 현재), 제목·배지, 교사 버튼(모두 공개/다시 가리기, 학생별 보기, 설정),
 * 내 평가, 평가 기준, 칸반을 차례로 그립니다. 다른 사람이 바꾸면 ProjectRoom 신호로 다시 불러옵니다.
 */
import { useCallback, useEffect, useState } from 'react';
import Notice from '@/components/ui/Notice';
import { HIDE_MODE_LABEL } from '@/lib/starboard/hiding';
import { pathTo } from '@/lib/starboard/tree';
import type { BoardView, Project, TreeNode } from '@/lib/starboard/types';
import { json, useSb } from './context';
import type { RoomSignals } from './ProjectRoom';
import Kanban from './Kanban';
import { CriteriaPanel, MyEvaluationPanel } from './CriteriaPanel';
import { BoardSettingsDrawer } from './BoardSettings';

type Props = { project: Project; boardId: string; tree: TreeNode[]; signals: RoomSignals; onTreeChanged: () => void };

export default function BoardScreen({ project, boardId, tree, signals, onTreeChanged }: Props) {
  const { api, go, isTeacher } = useSb();
  const [view, setView] = useState<BoardView | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState(false);

  const refetchView = useCallback(async () => {
    try {
      const r = await api<{ view: BoardView }>(`/boards/${boardId}`);
      setView(r.view);
      setError('');
    } catch (e) {
      setView((v) => (v === undefined ? null : v));
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, [api, boardId]);

  const mine = signals.content[boardId] ?? 0;
  useEffect(() => {
    refetchView();
  }, [refetchView, signals.structure, mine]);

  const path = pathTo(tree, boardId);
  const b = view?.board;

  return (
    <div className="sb-board-screen">
      <nav aria-label="경로" className="sb-breadcrumb" data-testid="breadcrumb">
        <ol>
          <li>
            <button type="button" className="sb-link" onClick={() => go({ name: 'home', projectId: project.id })}>
              {project.title}
            </button>
          </li>
          {path.map((n) => (
            <li key={n.id} data-testid="crumb">
              <span aria-hidden="true">›</span>
              {n.id === boardId ? (
                <b>{n.title}</b>
              ) : n.accessible ? (
                <button type="button" className="sb-link" onClick={() => go({ name: 'board', projectId: project.id, boardId: n.id })}>
                  {n.title}
                </button>
              ) : (
                <span className="sb-dim">{n.title}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {view === undefined ? (
        <p className="hint">불러오는 중...</p>
      ) : !view || !b ? (
        <div className="card sb-no-access" data-testid="no-access">
          {error && error !== '찾을 수 없어요' ? error : '이 보드를 볼 권한이 없습니다.'}
        </div>
      ) : (
        <>
          <div className="sb-board-head">
            <h1 data-testid="board-title">{b.title}</h1>
            {b.kind === 'personal' && <span className="badge">개인 보드{b.owner_name ? ` · ${b.owner_name}` : ''}</span>}
            {b.access === 'read' && <span className="badge sb-badge-muted">읽기 전용</span>}
            {isTeacher && b.hide_mode !== 'off' && (
              <span className="badge sb-badge-hide">
                가리기 {HIDE_MODE_LABEL[b.hide_mode]}
                {b.revealed ? ' · 공개 중' : ''}
              </span>
            )}
            {isTeacher && (
              <div className="sb-board-actions">
                {b.hide_mode !== 'off' && b.kind === 'shared' && (
                  <button
                    type="button"
                    className={b.revealed ? 'sb-btn ghost' : 'sb-btn-gold'}
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await api(`/boards/${b.id}`, json('PATCH', { revealed: !b.revealed }));
                        await refetchView();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : '바꾸지 못했습니다.');
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {b.revealed ? '다시 가리기' : '모두 공개'}
                  </button>
                )}
                {b.kind === 'shared' && (
                  <button type="button" className="sb-btn ghost" onClick={() => go({ name: 'students', projectId: project.id, boardId: b.id })}>
                    학생별 보기
                  </button>
                )}
                <button type="button" className="sb-btn ghost" onClick={() => setSettings(true)}>
                  설정
                </button>
              </div>
            )}
          </div>
          <Notice type="error" message={error} />
          <MyEvaluationPanel view={view} />
          <CriteriaPanel view={view} />
          <Kanban view={view} onChanged={refetchView} />
        </>
      )}
      {settings && view && (
        <BoardSettingsDrawer
          view={view}
          projectId={project.id}
          tree={tree}
          onChanged={() => {
            refetchView();
            onTreeChanged();
          }}
          onDeleted={(parentId) => {
            onTreeChanged();
            go(parentId ? { name: 'board', projectId: project.id, boardId: parentId } : { name: 'home', projectId: project.id });
          }}
          onClose={() => {
            setSettings(false);
            refetchView();
          }}
        />
      )}
    </div>
  );
}
