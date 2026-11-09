'use client';

/**
 * Dashboard — 방 대시보드
 * 주제 목표와 진행률, 흐름도, 자료 모음, 최근 공지 3개를 보이는 범위 안에서 모아 보여 줍니다.
 */
import Notice from '@/components/ui/Notice';
import ProgressBar from '@/components/ui/ProgressBar';
import { formatDateTime, formatRange } from '@/lib/group-project/format';
import type { GpNoticeView, RoomBundle, WorkspaceBundle } from '@/lib/group-project/types';
import AttachmentGallery from './AttachmentGallery';
import DownloadAllButton from './DownloadAllButton';
import { useGp } from './context';
import Linkify from './Linkify';
import Timeline from './Timeline';
import { LoadGate, SectionTitle, useLoad } from './ui';

export const UNASSIGNED_MESSAGE = '아직 모둠이 정해지지 않았어요. 선생님이 모둠을 정해 주면 모둠 할 일을 볼 수 있어요. 지금은 방 공통 항목만 보여요.';

type Props = { room: RoomBundle; view: string; onOpenTask: (id: string) => void; onGoTo: (menu: 'tasks' | 'notices') => void };

export default function Dashboard({ room, view, onOpenTask, onGoTo }: Props) {
  const { api } = useGp();
  const q = view ? `view=${view}&` : '';
  const { data, error, loading } = useLoad(
    () =>
      Promise.all([
        api<WorkspaceBundle>(`/rooms/${room.project.id}/tasks?${q}`),
        api<{ notices: GpNoticeView[] }>(`/rooms/${room.project.id}/notices?${q}limit=3`),
      ]),
    [api, room.project.id, q],
  );
  const ws = data?.[0];
  const notices = data?.[1].notices ?? [];
  const done = ws?.tasks.filter((t) => t.status === 'done').length ?? 0;
  const total = ws?.tasks.length ?? 0;
  const viewName = room.groups.find((g) => g.id === view)?.name;

  return (
    <LoadGate loading={loading} error={error} hasData={Boolean(ws)}>
      {ws && (
        <div className="gp-panel">
          {ws.unassignedInGroupRoom && <Notice type="info" message={UNASSIGNED_MESSAGE} />}

          <section className="card gp-overview">
            <div className="gp-min">
              <p className="gp-meta">주제 목표</p>
              <p className="gp-strong gp-pre">{room.topic.goal}</p>
              {room.project.description && (
                <p className="gp-pre">
                  <Linkify text={room.project.description} />
                </p>
              )}
              <p className="gp-meta">
                방 기간 {formatRange(room.project.start_date, room.project.end_date)}
                {room.myGroup && ` · 내 모둠: ${room.myGroup.name}`}
                {viewName && ` · 보는 중: ${viewName}`}
              </p>
            </div>
            <ProgressBar value={total ? (done / total) * 100 : 0} label={`진행률 ${done}/${total}`} />
          </section>

          <section className="card">
            <SectionTitle right={<button type="button" className="gp-text-button" onClick={() => onGoTo('tasks')}>할 일 전체 보기 →</button>}>흐름도</SectionTitle>
            <Timeline
              rangeStart={room.project.start_date}
              rangeEnd={room.project.end_date}
              today={ws.today}
              sections={ws.sections}
              names={ws.names}
              onOpen={onOpenTask}
            />
          </section>

          <div className="gp-split">
            <section className="card">
              <SectionTitle right={room.scope.isTeacher ? <DownloadAllButton topicId={room.topic.id} roomId={room.project.id} label="이 방 자료 모두 받기" /> : undefined}>자료 모음</SectionTitle>
              <AttachmentGallery items={ws.attachments} tasks={ws.tasks} onOpenTask={onOpenTask} />
            </section>
            <section className="card">
              <SectionTitle right={<button type="button" className="gp-text-button" onClick={() => onGoTo('notices')}>공지 전체 →</button>}>최근 공지</SectionTitle>
              {notices.length === 0 ? (
                <p className="hint">공지가 없어요</p>
              ) : (
                <ul className="gp-stack">
                  {notices.map((n) => (
                    <li key={n.id} className="gp-min">
                      <button type="button" className="gp-text-button" onClick={() => onGoTo('notices')}>
                        {n.title}
                      </button>
                      <p className="gp-meta">
                        {n.scopeLabel} · {n.authorName} · {formatDateTime(n.created_at)}
                      </p>
                      <p className="gp-clamp">
                        <Linkify text={n.body} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </LoadGate>
  );
}
