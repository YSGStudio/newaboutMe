'use client';

/**
 * BoardScreen — 작업장 화면(원본 boards/[boardId]/page.tsx + BoardClient)
 * 작업장 머리에 현재 위치와 운영 버튼을 모아 두고, 변경 신호를 받으면 보드를 다시 불러옵니다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Notice from '@/components/ui/Notice';
import { HIDE_MODE_LABEL } from '@/lib/starboard/hiding';
import { pathTo } from '@/lib/starboard/tree';
import type { BoardView, Project, TreeNode } from '@/lib/starboard/types';
import { json, useSb } from './context';
import type { RoomSignals } from './ProjectRoom';
import Kanban from './Kanban';
import { BoardSettingsDrawer } from './BoardSettings';

type Props = {
  project: Project;
  boardId: string;
  tree: TreeNode[];
  signals: RoomSignals;
  onTreeChanged: () => void;
};

export default function BoardScreen({ project, boardId, tree, signals, onTreeChanged }: Props) {
  const { api, go, isTeacher } = useSb();
  const [view, setView] = useState<BoardView | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<false | '일반' | '가리기'>(false);
  const [pending, setPending] = useState(false);

  const refetchView = useCallback(async () => {
    try {
      const r = await api<{ view: BoardView }>(`/boards/${boardId}?rubric=1`);
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
  const path = useMemo(() => pathTo(tree, boardId), [tree, boardId]);

  /** 교사 아이콘 설정(글쓰기·평가) — 서버도 담임 교사만 받는다(requireBoardTeacher). */
  const toggle = async (patch: Record<string, unknown>) => {
    if (!b) return;
    setPending(true);
    try {
      await api(`/boards/${b.id}`, json('PATCH', patch));
      setError('');
      await refetchView();
    } catch (e) {
      setError(e instanceof Error ? e.message : '바꾸지 못했습니다.');
    } finally {
      setPending(false);
    }
  };

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
          <Notice type="error" message={error} />
          <Kanban
            view={view}
            onChanged={refetchView}
            appearance="workspace"
            heading={
              <div className="sb-board-heading">
                <p>{[project.title, ...path.slice(0, -1).map((node) => node.title)].join(' / ')}</p>
                <div className="sb-board-title-row">
                  {isTeacher && (
                    <div className="sb-board-title-tools" role="group" aria-label="작업장 관리">
                      {b.kind === 'shared' && (
                        <button
                          type="button"
                          className={b.default_access === 'edit' ? 'sb-round-btn is-on' : 'sb-round-btn is-off'}
                          aria-pressed={b.default_access === 'edit'}
                          aria-label={b.default_access === 'edit' ? '학생 글쓰기 켜짐 — 눌러서 끄기' : '학생 글쓰기 꺼짐 — 눌러서 켜기'}
                          title={b.default_access === 'none' ? '학생에게 숨긴 작업장이에요. 설정 › 권한에서 바꿔요.' : b.default_access === 'edit' ? '학생 글쓰기 켜짐' : '학생 글쓰기 꺼짐'}
                          disabled={pending || b.default_access === 'none'}
                          data-testid="toggle-writing"
                          onClick={() => toggle({ default_access: b.default_access === 'edit' ? 'read' : 'edit' })}
                        >
                          <span aria-hidden="true">✏️</span>
                        </button>
                      )}
                      <button type="button" className="sb-round-btn" aria-label="작업장 설정" title="작업장 설정" onClick={() => setSettings('일반')}>
                        <span aria-hidden="true">⚙️</span>
                      </button>
                      {b.kind === 'shared' && (
                        <button type="button" className="sb-round-btn" aria-label="학생별 현황" title="학생별 현황" onClick={() => go({ name: 'students', projectId: project.id, boardId: b.id })}>
                          <span aria-hidden="true">👥</span>
                        </button>
                      )}
                    </div>
                  )}
                  <h1 data-testid="board-title">{b.title || path.at(-1)?.title}</h1>
                </div>
              </div>
            }
            actions={isTeacher && (
              <>
                {b.kind === 'shared' && (
                  <span className="sb-board-toggles" role="group" aria-label="학생 설정">
                    {/* 학생끼리 평가하기(동료평가) */}
                    <button
                      type="button"
                      className={b.peer_review ? 'sb-round-btn is-on' : 'sb-round-btn is-off'}
                      aria-pressed={Boolean(b.peer_review)}
                      aria-label={b.peer_review ? '학생끼리 평가 켜짐 — 눌러서 끄기' : '학생끼리 평가 꺼짐 — 눌러서 켜기'}
                      title={b.peer_review ? '학생끼리 평가 켜짐' : '학생끼리 평가 꺼짐'}
                      disabled={pending}
                      data-testid="toggle-peer-review"
                      onClick={() => toggle({ peer_review: !b.peer_review })}
                    >
                      <span aria-hidden="true">⭐</span>
                    </button>
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
              </>
            )}
            status={isTeacher && b.hide_mode !== 'off' && (
              <p className="sb-visibility-note">
                <strong>학생에게 보이는 범위</strong>
                {b.revealed ? ' · 현재 모두 공개 중' : ` · ${HIDE_MODE_LABEL[b.hide_mode]}`}
                <button type="button" className="sb-link" onClick={() => setSettings('가리기')}>공개 범위 확인</button>
              </p>
            )}
          />
        </>
      )}
      {settings && view && (
        <BoardSettingsDrawer
          view={view}
          initialTab={settings}
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
