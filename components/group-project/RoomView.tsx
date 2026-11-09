'use client';

/**
 * RoomView — 프로젝트 방 화면 셸
 * 머리(주제·방 이름·기간·팀장·내 모둠·역할)와 메뉴(대시보드/할 일/내 할 일/공지/구성원)를 그리고,
 * 할 일 상세까지 탭 안의 내부 상태로 전환합니다.
 */
import { ReactNode, useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { todayDate } from '@/lib/date';
import { isOverdue, sortByDueDate } from '@/lib/group-project/dates';
import { assigneeLabel, formatRange } from '@/lib/group-project/format';
import { scopeLabel } from '@/lib/group-project/roomView';
import type { RoomBundle, WorkspaceBundle } from '@/lib/group-project/types';
import AiTaskGenerator from './AiTaskGenerator';
import { useGp } from './context';
import Dashboard, { UNASSIGNED_MESSAGE } from './Dashboard';
import Members from './Members';
import Notices from './Notices';
import StatusToggle from './StatusToggle';
import TaskDetail from './TaskDetail';
import TaskForm from './TaskForm';
import TaskList from './TaskList';
import { BackButton, LoadGate, OverdueBadge, SectionTitle, useLoad } from './ui';

export type RoomMenu = 'dashboard' | 'tasks' | 'me' | 'notices' | 'members';

type Props = {
  roomId: string;
  initialMenu?: RoomMenu;
  initialTaskId?: string | null;
  backLabel?: string;
  onBack?: () => void;
  /** 방을 고르는 드롭다운. 고르는 목록은 패널이 갖고 있다. */
  rooms?: { id: string; label: string }[];
  onSwitchRoom?: (roomId: string) => void;
  onOpenTopic?: () => void;
  onOpenStudent?: (studentId: string) => void;
  onDeleted?: () => void;
  aside?: ReactNode;
};

function TasksScreen({ room, view, onOpen }: { room: RoomBundle; view: string; onOpen: (id: string) => void }) {
  const { api, kind } = useGp();
  const roomId = room.project.id;
  const { data: ws, error, loading, reload } = useLoad(
    () => api<WorkspaceBundle>(`/rooms/${roomId}/tasks${view ? `?view=${view}` : ''}`),
    [api, roomId, view],
  );
  const scopes = room.editableScopes;
  const range = { start: room.project.start_date, end: room.project.end_date };

  return (
    <LoadGate loading={loading} error={error} hasData={Boolean(ws)}>
      {ws && (
        <div className="gp-panel">
          {ws.unassignedInGroupRoom && <Notice type="info" message={UNASSIGNED_MESSAGE} />}
          <div className={scopes.length ? 'gp-split' : 'gp-panel'}>
            <div className="gp-panel">
              {ws.sections.map((s) => (
                <section key={s.key} className="card">
                  <SectionTitle>
                    {s.title} <small className="gp-meta">{s.tasks.length}개</small>
                  </SectionTitle>
                  <TaskList tasks={s.tasks} names={ws.names} today={ws.today} onOpen={onOpen} grid={kind === 'student'} />
                </section>
              ))}
            </div>
            {scopes.length > 0 && (
              <div className="gp-panel">
                <section className="card">
                  <SectionTitle>할 일 추가</SectionTitle>
                  <TaskForm
                    scopes={scopes}
                    range={range}
                    submitLabel="추가"
                    successMessage="할 일을 추가했어요"
                    onSubmit={async (body) => {
                      await api(`/rooms/${roomId}/tasks`, { method: 'POST', body: JSON.stringify(body) });
                      await reload();
                    }}
                  />
                </section>
                <section className="card">
                  <SectionTitle>AI로 할 일 만들기</SectionTitle>
                  <AiTaskGenerator roomId={roomId} scopes={scopes} range={range} onSaved={reload} />
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </LoadGate>
  );
}

function MyTasks({ room, onOpen }: { room: RoomBundle; onOpen: (id: string) => void }) {
  const { api } = useGp();
  const roomId = room.project.id;
  const { data: ws, error, loading } = useLoad(() => api<WorkspaceBundle>(`/rooms/${roomId}/tasks`), [api, roomId]);
  const tasks = sortByDueDate((ws?.tasks ?? []).filter((t) => t.assignee_ids.includes(room.me.id)));

  return (
    <LoadGate loading={loading} error={error} hasData={Boolean(ws)}>
      <section className="card">
        <SectionTitle>내 할 일 {tasks.length}개</SectionTitle>
        {tasks.length === 0 ? (
          <EmptyState title="나에게 배정된 할 일이 없어요" description="할 일을 맡으면 여기에 마감일 순으로 보여요." />
        ) : (
          <ul className="gp-task-grid">
            {tasks.map((t) => (
              <li key={t.id} className="gp-task-item">
                <div className="gp-min">
                  <button type="button" className="gp-text-button" onClick={() => onOpen(t.id)}>
                    {t.title}
                  </button>
                  <p className="gp-meta">
                    마감 {formatRange(t.due_date, t.due_date)} · {scopeLabel(room, t.group_id)}
                    {t.assignee_ids.length > 1 && ` · 함께: ${assigneeLabel(t.assignee_ids, room.names)}`}{' '}
                    {ws && isOverdue(t, ws.today) && <OverdueBadge />}
                  </p>
                </div>
                <StatusToggle taskId={t.id} status={t.status} canChange />
              </li>
            ))}
          </ul>
        )}
      </section>
    </LoadGate>
  );
}

export default function RoomView({ roomId, initialMenu = 'dashboard', initialTaskId = null, backLabel, onBack, rooms, onSwitchRoom, onOpenTopic, onOpenStudent, onDeleted }: Props) {
  const { api } = useGp();
  const { data: room, error, loading, reload } = useLoad(() => api<RoomBundle>(`/rooms/${roomId}`), [api, roomId]);
  const [menu, setMenu] = useState<RoomMenu>(initialMenu);
  const [taskId, setTaskId] = useState<string | null>(initialTaskId);
  const [view, setView] = useState('');

  const open = (id: string) => setTaskId(id);
  const go = (next: RoomMenu) => {
    setTaskId(null);
    setMenu(next);
  };

  const scope = room?.scope;
  const roleBadge = scope?.isTeacher ? '선생님' : scope?.isProjectLeader ? '팀장' : scope?.isMyGroupLeader ? '모둠장' : null;
  const showGroupTabs = room?.kind === 'grouped' && (scope?.isTeacher || scope?.isProjectLeader) && !taskId && menu !== 'me' && menu !== 'members';

  const items = room
    ? [
        { key: 'dashboard', label: '대시보드' },
        { key: 'tasks', label: '할 일' },
        ...(room.scope.isMember ? [{ key: 'me', label: '내 할 일' }] : []),
        { key: 'notices', label: '공지' },
        { key: 'members', label: room.scope.isTeacher ? '구성원·모둠' : '구성원' },
      ]
    : [];

  return (
    <div className="gp-panel">
      {onBack && (
        <div>
          <BackButton label={backLabel ?? '뒤로'} onClick={onBack} />
        </div>
      )}
      <LoadGate loading={loading} error={error} hasData={Boolean(room)}>
        {room && (
          <>
            <header className="card gp-room-head">
              <div className="gp-min">
                {onOpenTopic ? (
                  <button type="button" className="gp-text-button" onClick={onOpenTopic}>{room.topic.title}</button>
                ) : (
                  <p className="gp-strong">{room.topic.title}</p>
                )}
                <h2 className="gp-title">
                  {room.project.name}
                  {room.myGroup && <span className="badge">{room.myGroup.name}</span>}
                  {roleBadge && <span className="badge">{roleBadge}</span>}
                </h2>
                <p className="gp-meta">
                  {formatRange(room.project.start_date, room.project.end_date)} · 팀장 {room.leaderNames.join(', ') || '없음'}
                </p>
              </div>
              {rooms && rooms.length > 1 && onSwitchRoom && (
                <label className="gp-room-switch">
                  다른 방 보기
                  <select value={roomId} onChange={(e) => onSwitchRoom(e.target.value)}>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </header>

            <Tabs items={items} value={menu} onChange={(key) => go(key as RoomMenu)} />

            {showGroupTabs && (
              <div className="gp-view-tabs" role="tablist" aria-label="모둠 보기">
                {[{ id: '', name: '방 전체' }, ...room.groups].map((g) => (
                  <button key={g.id || 'all'} type="button" role="tab" aria-selected={view === g.id} className={view === g.id ? 'gp-pill is-active' : 'gp-pill'} onClick={() => setView(g.id)}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {taskId ? (
              <TaskDetail room={room} taskId={taskId} today={todayDate()} onBack={() => setTaskId(null)} />
            ) : (
              <>
                {menu === 'dashboard' && <Dashboard room={room} view={view} onOpenTask={open} onGoTo={go} />}
                {menu === 'tasks' && <TasksScreen room={room} view={view} onOpen={open} />}
                {menu === 'me' && <MyTasks room={room} onOpen={open} />}
                {menu === 'notices' && <Notices room={room} view={view} />}
                {menu === 'members' && <Members room={room} onChanged={reload} onDeleted={onDeleted ?? (() => undefined)} onOpenStudent={onOpenStudent} />}
              </>
            )}
          </>
        )}
      </LoadGate>
    </div>
  );
}
