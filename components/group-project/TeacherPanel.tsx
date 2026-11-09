'use client';

/**
 * TeacherPanel — 교사 "모둠 프로젝트" 탭
 * 선택한 학급의 주제 목록 → 주제(방 목록·방 만들기·수정) → 방 / 학생별 활동 / 학생 작업을 내부 상태로 전환합니다.
 */
import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import { todayDate } from '@/lib/date';
import { formatRange } from '@/lib/group-project/format';
import type { ProjectStats } from '@/lib/group-project/progress';
import type { ActivityRow, GpTopic } from '@/lib/group-project/types';
import ActivityTable from './ActivityTable';
import DownloadAllButton from './DownloadAllButton';
import TopicNotices from './TopicNotices';
import { GpProvider, useGp } from './context';
import RoomCreateForm from './RoomCreateForm';
import RoomView, { RoomMenu } from './RoomView';
import StudentWorkView from './StudentWorkView';
import TopicForm from './TopicForm';
import { BackButton, LoadGate, SectionTitle, useAction, useLoad } from './ui';

type Student = { id: string; name: string; student_number: number };

type Screen =
  | { name: 'topics' }
  | { name: 'topic'; topicId: string }
  | { name: 'room'; roomId: string; topicId: string; menu?: RoomMenu; taskId?: string | null }
  | { name: 'activity'; topicId: string }
  | { name: 'student'; topicId: string; studentId: string };

function TopicList({ classId, onOpen }: { classId: string; onOpen: (id: string) => void }) {
  const { api } = useGp();
  const { data, error, loading } = useLoad(() => api<{ topics: GpTopic[]; students: Student[] }>(`/classes/${classId}/topics`), [api, classId]);
  const [creating, setCreating] = useState(false);

  return (
    <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
      {data && (
        <div className="gp-panel">
          <section className="card">
            <SectionTitle right={<button type="button" className="gp-btn" onClick={() => setCreating((v) => !v)}>{creating ? '닫기' : '주제 등록'}</button>}>
              모둠 프로젝트 주제 {data.topics.length}개
            </SectionTitle>
            {creating && (
              <TopicForm
                students={data.students}
                submitLabel="주제 등록"
                onSubmit={async (body) => {
                  const { topic } = await api<{ topic: GpTopic }>(`/classes/${classId}/topics`, { method: 'POST', body: JSON.stringify(body) });
                  onOpen(topic.id);
                }}
              />
            )}
            {!creating && data.topics.length === 0 && <EmptyState title="등록된 주제 없음" description="주제와 팀장을 등록하면 프로젝트 방을 만들 수 있습니다." />}
          </section>
          {data.topics.length > 0 && (
            <div className="gp-columns">
              {data.topics.map((t) => (
                <button key={t.id} type="button" className="gp-topic-card" onClick={() => onOpen(t.id)}>
                  <strong>{t.title}</strong>
                  <small>{formatRange(t.start_date, t.end_date)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </LoadGate>
  );
}

type TopicData = { topic: GpTopic; leaders: { id: string; name: string }[]; students: Student[] };
type RoomsData = {
  rooms: { id: string; name: string; start_date: string; end_date: string; leader_names: string; stats: ProjectStats }[];
  leaderCandidates: { id: string; name: string; otherRoom: string | null }[];
};

function TopicScreen({ topicId, onBack, onOpenRoom, onActivity }: { topicId: string; onBack: () => void; onOpenRoom: (roomId: string, menu?: RoomMenu) => void; onActivity: () => void }) {
  const { api, confirmDelete } = useGp();
  const { data, error, loading, reload } = useLoad(
    () => Promise.all([api<TopicData>(`/topics/${topicId}`), api<RoomsData>(`/topics/${topicId}/rooms`)]),
    [api, topicId],
  );
  const del = useAction();

  async function remove() {
    if (!(await confirmDelete('이 주제를 삭제할까요? 모든 방·할 일·자료·공지가 함께 지워집니다.', '삭제'))) return;
    const ok = await del.run(async () => {
      await api(`/topics/${topicId}`, { method: 'DELETE' });
    });
    if (ok) onBack();
  }

  const topicData = data?.[0];
  const rooms = data?.[1];

  return (
    <div className="gp-panel">
      <div>
        <BackButton label="주제 목록" onClick={onBack} />
      </div>
      <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
        {topicData && rooms && (
          <>
            <header className="card">
              <h2 className="gp-title">{topicData.topic.title}</h2>
              <p className="gp-meta">{formatRange(topicData.topic.start_date, topicData.topic.end_date)} · 목표: {topicData.topic.goal}</p>
              <div className="gp-actions gp-gap-top">
                <button type="button" className="gp-btn" onClick={onActivity}>학생별 활동 모아보기</button>
                <DownloadAllButton topicId={topicId} label="학생 자료 모두 받기" />
              </div>
            </header>

            <TopicNotices topicId={topicId} />

            <section className="card">
              <SectionTitle>프로젝트 방 {rooms.rooms.length}개</SectionTitle>
              {rooms.rooms.length === 0 ? (
                <EmptyState title="아직 방 없음" description="팀장이 직접 만들거나 아래에서 만들 수 있습니다." />
              ) : (
                <div className="gp-columns">
                  {rooms.rooms.map((r) => (
                    <div key={r.id} className="gp-group-card">
                      <div className="gp-badges">
                        <button type="button" className="gp-text-button" onClick={() => onOpenRoom(r.id)}>{r.name}</button>
                        {!r.leader_names && <span className="gp-status is-overdue">팀장 없는 방</span>}
                      </div>
                      <p className="gp-meta">
                        팀장 {r.leader_names || '없음'} · {r.stats.members}명 · 모둠 {r.stats.groups}개 · {formatRange(r.start_date, r.end_date)}
                      </p>
                      <ProgressBar value={r.stats.total ? (r.stats.done / r.stats.total) * 100 : 0} label={`진행률 ${r.stats.done}/${r.stats.total}`} />
                      <div className="gp-actions gp-gap-top">
                        <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => onOpenRoom(r.id)}>대시보드</button>
                        <button type="button" className="ghost gp-btn gp-btn-sm" onClick={() => onOpenRoom(r.id, 'members')}>구성원·모둠</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="gp-columns">
              <section className="card">
                <SectionTitle>방 만들기</SectionTitle>
                <RoomCreateForm topic={topicData.topic} leaderChoices={rooms.leaderCandidates.filter((c) => !c.otherRoom)} onCreated={(id) => onOpenRoom(id, 'members')} />
              </section>
              <section className="card">
                <SectionTitle>주제 정보·팀장 수정</SectionTitle>
                <p className="hint">팀장에서 빠진 학생은 맡던 방의 팀장에서도 빠집니다.</p>
                <TopicForm
                  key={topicData.topic.title + topicData.topic.start_date + topicData.topic.end_date + topicData.leaders.length}
                  students={topicData.students}
                  topic={topicData.topic}
                  leaderIds={topicData.leaders.map((l) => l.id)}
                  submitLabel="저장"
                  onSubmit={async (body) => {
                    await api(`/topics/${topicId}`, { method: 'PATCH', body: JSON.stringify(body) });
                    await reload();
                  }}
                />
                <div className="gp-divider">
                  {del.feedback}
                  <button type="button" className="gp-btn gp-danger" disabled={del.busy} onClick={remove}>주제 삭제</button>
                </div>
              </section>
            </div>
          </>
        )}
      </LoadGate>
    </div>
  );
}

function ActivityScreen({ topicId, onBack, onOpenStudent, onOpen }: { topicId: string; onBack: () => void; onOpenStudent: (id: string) => void; onOpen: (projectId: string, taskId: string | null, menu?: 'notices') => void }) {
  const { api } = useGp();
  const { data, error, loading } = useLoad(
    () => api<{ topic: GpTopic; rows: ActivityRow[]; unplaced: Student[] }>(`/topics/${topicId}/activity`),
    [api, topicId],
  );
  return (
    <div className="gp-panel">
      <div>
        <BackButton label="주제로 돌아가기" onClick={onBack} />
      </div>
      <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
        {data && (
          <>
            <header className="card">
              <h2 className="gp-title">학생별 활동 모아보기</h2>
              <p className="gp-meta">{data.topic.title} · 학생 이름을 누르면 작업 전체 확인</p>
            </header>
            <section className="card">
              {data.rows.length === 0 ? (
                <EmptyState title="방에 들어간 학생 없음" description="학생을 방에 추가하면 활동이 집계됩니다." />
              ) : (
                <ActivityTable topicId={topicId} rows={data.rows} onOpenStudent={onOpenStudent} onOpen={onOpen} />
              )}
            </section>
            <section className="card">
              <SectionTitle>방 미배정 학생 {data.unplaced.length}명</SectionTitle>
              {data.unplaced.length === 0 ? (
                <p className="hint">모든 학생이 방에 배정됨</p>
              ) : (
                <ul className="gp-pills">
                  {data.unplaced.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="gp-pill" onClick={() => onOpenStudent(s.id)}>{s.name}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </LoadGate>
    </div>
  );
}

function Panel({ classId }: { classId: string }) {
  const { api } = useGp();
  const [screen, setScreen] = useState<Screen>({ name: 'topics' });

  // 사이드바에서 학급을 바꾸면 첫 화면으로 돌아간다.
  useEffect(() => setScreen({ name: 'topics' }), [classId]);

  const siblings = useLoad(
    () =>
      screen.name === 'room'
        ? api<RoomsData>(`/topics/${screen.topicId}/rooms`).then((d) => d.rooms.map((r) => ({ id: r.id, label: r.name })))
        : Promise.resolve([] as { id: string; label: string }[]),
    [api, screen.name === 'room' ? screen.topicId : ''],
  );

  if (!classId) return <EmptyState title="학급을 선택하십시오" description="사이드바에서 학급을 고르면 모둠 프로젝트를 관리할 수 있습니다." />;

  const openRoomTask = (topicId: string) => (projectId: string, taskId: string | null, menu?: 'notices') =>
    setScreen({ name: 'room', roomId: projectId, topicId, taskId, menu });

  switch (screen.name) {
    case 'topics':
      return <TopicList classId={classId} onOpen={(topicId) => setScreen({ name: 'topic', topicId })} />;
    case 'topic':
      return (
        <TopicScreen
          key={screen.topicId}
          topicId={screen.topicId}
          onBack={() => setScreen({ name: 'topics' })}
          onOpenRoom={(roomId, menu) => setScreen({ name: 'room', roomId, topicId: screen.topicId, menu })}
          onActivity={() => setScreen({ name: 'activity', topicId: screen.topicId })}
        />
      );
    case 'room':
      return (
        <RoomView
          key={`${screen.roomId}-${screen.taskId ?? ''}-${screen.menu ?? ''}`}
          roomId={screen.roomId}
          initialMenu={screen.menu}
          initialTaskId={screen.taskId}
          backLabel="주제로 돌아가기"
          onBack={() => setScreen({ name: 'topic', topicId: screen.topicId })}
          rooms={siblings.data ?? undefined}
          onSwitchRoom={(roomId) => setScreen({ name: 'room', roomId, topicId: screen.topicId })}
          onOpenStudent={(studentId) => setScreen({ name: 'student', topicId: screen.topicId, studentId })}
          onDeleted={() => setScreen({ name: 'topic', topicId: screen.topicId })}
        />
      );
    case 'activity':
      return (
        <ActivityScreen
          topicId={screen.topicId}
          onBack={() => setScreen({ name: 'topic', topicId: screen.topicId })}
          onOpenStudent={(studentId) => setScreen({ name: 'student', topicId: screen.topicId, studentId })}
          onOpen={openRoomTask(screen.topicId)}
        />
      );
    case 'student':
      return (
        <StudentWorkView
          topicId={screen.topicId}
          studentId={screen.studentId}
          today={todayDate()}
          onBack={() => setScreen({ name: 'activity', topicId: screen.topicId })}
          onOpen={openRoomTask(screen.topicId)}
        />
      );
  }
}

export default function TeacherPanel({ classId }: { classId: string }) {
  return (
    <GpProvider kind="teacher">
      <div className="gp-root">
        <Panel classId={classId} />
      </div>
    </GpProvider>
  );
}
