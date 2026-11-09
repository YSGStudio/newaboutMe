'use client';

/**
 * StudentPanel — 학생 "모둠 프로젝트" 탭
 * 진행 중인 최신 주제의 내 방 대시보드를 먼저 보여 줍니다. 방이 없으면 우리 반 주제 목록을 보여 줍니다.
 */
import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { formatRange } from '@/lib/group-project/format';
import type { GpTopic, StudentRoom } from '@/lib/group-project/types';
import { GpProvider, useGp } from './context';
import RoomCreateForm from './RoomCreateForm';
import RoomView from './RoomView';
import { BackButton, LoadGate, SectionTitle, useLoad } from './ui';

type TopicItem = GpTopic & { isLeader: boolean; hasRoom: boolean };
type MyRooms = { rooms: StudentRoom[]; defaultRoomId: string | null; topics: TopicItem[] };
type RoomLine = { id: string; name: string; leader_names: string; is_mine: boolean };

type TopicScreenProps = { topicId: string; onBack: () => void; onOpenRoom: (roomId: string) => void; onCreated: (roomId: string) => void };

function TopicScreen({ topicId, onBack, onOpenRoom, onCreated }: TopicScreenProps) {
  const { api } = useGp();
  const { data, error, loading } = useLoad(
    () => Promise.all([api<{ topic: GpTopic; isLeader: boolean }>(`/topics/${topicId}`), api<{ rooms: RoomLine[] }>(`/topics/${topicId}/rooms`)]),
    [api, topicId],
  );
  const info = data?.[0];
  const rooms = data?.[1].rooms ?? [];
  const mine = rooms.find((r) => r.is_mine);

  return (
    <div className="gp-panel">
      <div>
        <BackButton label="처음으로" onClick={onBack} />
      </div>
      <LoadGate loading={loading} error={error} hasData={Boolean(info)}>
        {info && (
          <>
            <header className="card">
              <h2 className="gp-title">{info.topic.title}</h2>
              <p className="gp-meta">{formatRange(info.topic.start_date, info.topic.end_date)} · 목표: {info.topic.goal}</p>
              {mine && (
                <div className="gp-actions gp-gap-top">
                  <button type="button" className="gp-btn" onClick={() => onOpenRoom(mine.id)}>내 방으로 가기: {mine.name}</button>
                </div>
              )}
            </header>
            <section className="card">
              <SectionTitle>프로젝트 방</SectionTitle>
              {rooms.length === 0 ? (
                <EmptyState title="아직 방이 없어요" description="방이 만들어지면 여기에 보여요." />
              ) : (
                <ul className="gp-stack">
                  {rooms.map((r) => (
                    <li key={r.id} className="gp-badges">
                      <strong>{r.name}</strong>
                      <span className="gp-meta">팀장 {r.leader_names || '없음'}</span>
                      {r.is_mine && <span className="badge">내 방</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {info.isLeader && !mine && (
              <section className="card">
                <SectionTitle>방 만들기</SectionTitle>
                <p className="hint">나는 이 주제의 팀장이에요. 방을 만들면 내가 방 팀장이 돼요.</p>
                <RoomCreateForm topic={info.topic} onCreated={onCreated} />
              </section>
            )}
          </>
        )}
      </LoadGate>
    </div>
  );
}

function Panel({ studentName }: { studentName: string }) {
  const { api } = useGp();
  const { data, error, loading, reload } = useLoad(() => api<MyRooms>('/me/rooms'), [api]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (data?.defaultRoomId && !roomId) setRoomId((v) => v ?? data.defaultRoomId);
  }, [data, roomId]);

  const openRoom = (id: string) => {
    setTopicId(null);
    setRoomId(id);
  };

  if (topicId) {
    return (
      <TopicScreen
        key={topicId}
        topicId={topicId}
        onBack={() => setTopicId(null)}
        onOpenRoom={openRoom}
        onCreated={(id) => {
          reload();
          openRoom(id);
        }}
      />
    );
  }

  const room = data?.rooms.find((r) => r.project.id === roomId);
  // 다른 주제에 방이 있어도, 새로 팀장이 된 주제의 방을 만들 길이 있어야 한다.
  const topicsToStart = data?.topics.filter((t) => t.isLeader && !t.hasRoom) ?? [];

  return (
    <LoadGate loading={loading} error={error} hasData={Boolean(data)}>
      {data && room ? (
        <div className="gp-panel">
          {topicsToStart.length > 0 && (
            <section className="card">
              <SectionTitle>내가 팀장인 새 주제가 있어요</SectionTitle>
              <div className="gp-actions">
                {topicsToStart.map((t) => (
                  <button key={t.id} type="button" className="ghost gp-btn" onClick={() => setTopicId(t.id)}>
                    {t.title} 방 만들기
                  </button>
                ))}
              </div>
            </section>
          )}
          <RoomView
            key={room.project.id}
            roomId={room.project.id}
            rooms={data.rooms.map((r) => ({ id: r.project.id, label: `${r.topic.title} · ${r.project.name}` }))}
            onSwitchRoom={setRoomId}
            onOpenTopic={() => setTopicId(room.topic.id)}
          />
        </div>
      ) : (
        data &&
        !data.defaultRoomId && (
          <div className="gp-panel">
            <header className="card">
              <h2 className="gp-title">아직 프로젝트 방이 없어요</h2>
              <p className="gp-meta">{studentName}님, 선생님이 방에 넣어 주면 여기에서 바로 볼 수 있어요.</p>
            </header>
            {data.topics.length === 0 ? (
              <EmptyState title="아직 등록된 주제가 없어요" description="선생님이 주제를 올리면 여기에 보여요." />
            ) : (
              <div className="gp-columns">
                {data.topics.map((t) => (
                  <section key={t.id} className="card">
                    <h3 className="gp-notice-title">{t.title}</h3>
                    <p className="gp-meta">{formatRange(t.start_date, t.end_date)}</p>
                    <div className="gp-actions gp-gap-top">
                      <button type="button" className="ghost gp-btn" onClick={() => setTopicId(t.id)}>주제 보기</button>
                      {t.isLeader && !t.hasRoom && <button type="button" className="gp-btn" onClick={() => setTopicId(t.id)}>방 만들기</button>}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </LoadGate>
  );
}

export default function StudentPanel({ studentName }: { studentName: string }) {
  return (
    <GpProvider kind="student">
      <div className="gp-root">
        <Panel studentName={studentName} />
      </div>
    </GpProvider>
  );
}
