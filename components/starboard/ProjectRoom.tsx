'use client';

/**
 * ProjectRoom — 프로젝트 = 하나의 방(원본 projects/[id]/layout.tsx + ProjectSidebar)
 * 왼쪽 작업장 사이드바는 방 안 모든 화면에서 유지되고(작업장 설정 화면에서만 숨김), 오른쪽에 현재 화면을 그립니다.
 *
 * 실시간 반영: 원본은 Supabase Realtime(board_events)을 구독했다. 별빛로그 학생은 Auth 사용자가 아니라
 * 같은 방식을 쓸 수 없어, 3초마다 변경 시각(versions)만 가볍게 읽고 바뀐 것만 다시 부른다.
 *   - structure 변경(작업장·권한) → 트리·카드 수를 다시 부르고 열린 화면도 새로 고친다
 *   - 작업장 content 변경 → 카드 수를 다시 세고, 그 작업장을 보고 있으면 화면을 새로 고친다
 * 탭이 뒤에 있으면 usePoll이 멈춘다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Notice from '@/components/ui/Notice';
import usePoll from '@/lib/use-poll';
import type { Project, TreeNode } from '@/lib/starboard/types';
import { useSb, type Screen } from './context';
import ProjectSidebar from './ProjectSidebar';
import ProjectHome from './ProjectHome';
import BoardScreen from './BoardScreen';
import WorkspaceSettings from './WorkspaceSettings';
import StudentSummary from './StudentSummary';
import EvaluationScreen from './EvaluationScreen';

type RoomScreen = Exclude<Screen, { name: 'projects' } | { name: 'criteria' }>;
type Tree = { project: Project; isTeacher: boolean; nodes: TreeNode[]; counts: Record<string, number> };
type Ev = { board_id: string; content_at: string; structure_at: string };

export type RoomSignals = {
  /** 구조가 바뀔 때마다 오른다 */
  structure: number;
  /** 작업장별 내용 변경 횟수 */
  content: Record<string, number>;
};

export default function ProjectRoom({ screen }: { screen: RoomScreen }) {
  const { api, go } = useSb();
  const projectId = screen.projectId;
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState('');
  const [signals, setSignals] = useState<RoomSignals>({ structure: 0, content: {} });
  // 사이드바 아래 교사 버튼 자리 — 작업장 화면(BoardScreen)이 포털로 채운다.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const last = useRef<Map<string, Ev> | null>(null);

  const loadTree = useCallback(async () => {
    const t = await api<Tree>(`/projects/${projectId}/tree`);
    setTree(t);
    setError('');
    return t;
  }, [api, projectId]);

  useEffect(() => {
    loadTree().catch((e: Error) => setError(e.message));
  }, [loadTree]);

  const poll = useCallback(async () => {
    const { events } = await api<{ events: Ev[] }>(`/projects/${projectId}/versions`);
    const next = new Map(events.map((e) => [e.board_id, e]));
    const prev = last.current;
    last.current = next;
    if (!prev) return;
    let structure = prev.size !== next.size;
    const changed: string[] = [];
    for (const [id, e] of next) {
      const p = prev.get(id);
      if (!p) {
        structure = true;
        continue;
      }
      if (p.structure_at !== e.structure_at) structure = true;
      if (p.content_at !== e.content_at) changed.push(id);
    }
    if (!structure && !changed.length) return;
    setSignals((s) => {
      const content = { ...s.content };
      for (const id of changed) content[id] = (content[id] ?? 0) + 1;
      return { structure: s.structure + (structure ? 1 : 0), content };
    });
    await loadTree();
  }, [api, projectId, loadTree]);

  usePoll(poll, { enabled: Boolean(tree), intervalMs: 3000 });

  if (error && !tree) {
    return (
      <div className="sb-room">
        <Notice type="error" message={error} />
        <button type="button" className="sb-btn ghost" onClick={() => go({ name: 'projects' })}>
          ← 프로젝트 목록
        </button>
      </div>
    );
  }
  if (!tree) return <p className="hint">불러오는 중...</p>;

  const refresh = () => {
    loadTree().catch(() => {});
  };
  const currentBoardId = 'boardId' in screen && screen.name !== 'settings' ? screen.boardId : undefined;
  const onSettings = screen.name === 'settings';

  return (
    <div className={onSettings ? 'sb-room is-wide' : 'sb-room'}>
      {!onSettings && (
        <ProjectSidebar
          projectId={projectId}
          title={tree.project.title}
          nodes={tree.nodes}
          counts={tree.counts}
          currentId={screen.name === 'board' ? screen.boardId : undefined}
          onHome={screen.name === 'home'}
          onChanged={refresh}
          actionsRef={setActionsSlot}
        />
      )}
      <div className="sb-room-main">
        {screen.name === 'home' && <ProjectHome projectId={projectId} signals={signals} />}
        {screen.name === 'board' && (
          <BoardScreen
            key={screen.boardId}
            project={tree.project}
            boardId={screen.boardId}
            tree={tree.nodes}
            signals={signals}
            onTreeChanged={refresh}
            actionsSlot={actionsSlot}
          />
        )}
        {screen.name === 'settings' && (
          <WorkspaceSettings project={tree.project} nodes={tree.nodes} counts={tree.counts} initialSelected={screen.boardId ?? null} onTreeChanged={refresh} />
        )}
        {screen.name === 'students' && <StudentSummary projectId={projectId} boardId={screen.boardId} />}
        {screen.name === 'evaluate' && (
          <EvaluationScreen key={screen.studentId} projectId={projectId} boardId={screen.boardId} studentId={screen.studentId} />
        )}
        {currentBoardId === undefined && null}
      </div>
    </div>
  );
}
