'use client';

/**
 * BoardScreen — 작업장 화면(원본 boards/[boardId]/page.tsx + BoardClient)
 * 칸반을 맨 위에 그려 왼쪽 작업장 사이드바와 시작선을 맞춥니다(경로·제목 줄은 그리지 않음 — 현재 작업장은 사이드바 트리가 보여 줌).
 * 교사 버튼(모두 공개/다시 가리기, 학생별 보기, 설정)과 가리기 상태는 사이드바 아래 자리에 포털로 그립니다.
 * 내 평가·평가 기준은 칸반 아래에 둡니다. 다른 사람이 바꾸면 ProjectRoom 신호로 다시 불러옵니다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Notice from '@/components/ui/Notice';
import { HIDE_MODE_LABEL } from '@/lib/starboard/hiding';
import { pathTo } from '@/lib/starboard/tree';
import type { BoardView, Project, TreeNode } from '@/lib/starboard/types';
import { json, useSb } from './context';
import type { RoomSignals } from './ProjectRoom';
import Kanban from './Kanban';
import { CriteriaPanel, MyEvaluationPanel } from './CriteriaPanel';
import { BoardSettingsDrawer } from './BoardSettings';

type Props = {
  project: Project;
  boardId: string;
  tree: TreeNode[];
  signals: RoomSignals;
  onTreeChanged: () => void;
  /** 사이드바 아래 교사 버튼 자리(ProjectSidebar의 .sb-sidebar-actions) */
  actionsSlot: HTMLDivElement | null;
};

export default function BoardScreen({ project, boardId, tree, signals, onTreeChanged, actionsSlot }: Props) {
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

  const b = view?.board;
  // 경로 줄을 없앴으므로 현재 작업장 이름은 화면 읽기 프로그램용 제목으로만 남긴다.
  const title = useMemo(() => pathTo(tree, boardId).at(-1)?.title ?? '', [tree, boardId]);

  return (
    <div className="sb-board-screen">

      {view === undefined ? (
        <p className="hint">불러오는 중...</p>
      ) : !view || !b ? (
        <div className="card sb-no-access" data-testid="no-access">
          {error && error !== '찾을 수 없어요' ? error : '이 보드를 볼 권한이 없습니다.'}
        </div>
      ) : (
        <>
          <h1 className="sb-sr-only" data-testid="board-title">{b.title || title}</h1>
          {isTeacher && actionsSlot && createPortal(
              <div className="sb-board-actions">
                {b.hide_mode !== 'off' && (
                  <span className="badge sb-badge-hide">
                    가리기 {HIDE_MODE_LABEL[b.hide_mode]}
                    {b.revealed ? ' · 공개 중' : ''}
                  </span>
                )}
                {b.hide_mode !== 'off' && b.kind === 'shared' && (
                  <button
                    type="button"
                    className={b.revealed ? 'sb-btn-dark' : 'sb-btn-gold'}
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
                  <button type="button" className="sb-btn-dark" onClick={() => go({ name: 'students', projectId: project.id, boardId: b.id })}>
                    학생별 보기
                  </button>
                )}
                <button type="button" className="sb-btn-dark" onClick={() => setSettings(true)}>
                  설정
                </button>
              </div>,
            actionsSlot,
          )}
          <Notice type="error" message={error} />
          <Kanban view={view} onChanged={refetchView} />
          <MyEvaluationPanel view={view} />
          <CriteriaPanel view={view} />
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
