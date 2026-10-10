'use client';

/**
 * ClassVoyageMap — 학생 별빛여행의 "우리 반 항해 지도"
 * 같은 반 친구들의 우주선이 별 지도 어디쯤 날고 있는지 한 줄에 한 명씩 보여줍니다.
 * 연료 숫자는 보여주지 않고(서버도 내려주지 않음) 우주선 위치로만 차이를 나타냅니다.
 * 친구 줄은 번호 순이고, 내 줄은 금색으로 강조합니다.
 * 교사가 학급설정 > 별빛여행에서 끄면(enabled: false) 아무것도 그리지 않습니다.
 */
import { useCallback, useEffect, useState } from 'react';
import usePoll from '@/lib/use-poll';

type MapStar = { level: number; name: string; emoji: string };
type CrewMember = { name: string; studentNumber: number; position: number; isMe: boolean };
type ClassMapData =
  | { enabled: false }
  | { enabled: true; stars: MapStar[]; crew: CrewMember[] };

/** 출발점 — 별 목록(level 1~)에는 없으므로 지도 맨 앞에 붙인다. */
const START: MapStar = { level: 0, name: '지구', emoji: '🌏' };

export default function ClassVoyageMap() {
  const [data, setData] = useState<ClassMapData | null>(null);

  const syncClassVoyageMap = useCallback(async () => {
    const res = await fetch('/api/voyage/class');
    if (!res.ok) return;
    setData((await res.json()) as ClassMapData);
  }, []);

  useEffect(() => { void syncClassVoyageMap(); }, [syncClassVoyageMap]);

  // 별빛메일 설정과 동일하게 10초마다 확인하고, 숨겼던 탭으로 돌아오면 즉시 맞춘다.
  usePoll(syncClassVoyageMap, { enabled: true, intervalMs: 10_000 });

  if (!data || !data.enabled || data.crew.length === 0) return null;

  const stops = [START, ...data.stars];
  const lastIndex = stops.length - 1;
  /** 지도 위치(0 ~ 별 개수)를 줄 안의 가로 위치(%)로 바꾼다. */
  const toLeft = (position: number) => `${(Math.min(position, lastIndex) / lastIndex) * 100}%`;

  return (
    <section className="card voyage-crew-card">
      <div>
        <p className="voyage-section-kicker">CLASS STAR MAP</p>
        <h2>우리 반 항해 지도</h2>
        <p className="hint" style={{ margin: '4px 0 0' }}>친구들의 우주선이 어디쯤 날고 있는지 볼 수 있어요.</p>
      </div>

      <div className="voyage-crew-map">
        <div className="voyage-crew-row voyage-crew-head" aria-hidden="true">
          <span className="voyage-crew-name" />
          <div className="voyage-crew-lane">
            {stops.map((stop, index) => (
              <span key={stop.level} className="voyage-crew-stop" style={{ left: toLeft(index) }}>
                <b>{stop.emoji}</b>
                <small>{stop.name}</small>
              </span>
            ))}
          </div>
        </div>

        {data.crew.map((member) => (
          <div
            key={member.studentNumber}
            className={`voyage-crew-row${member.isMe ? ' is-me' : ''}`}
          >
            <span className="voyage-crew-name">
              {member.name}
              {member.isMe && <em>나</em>}
            </span>
            <div className="voyage-crew-lane">
              <span
                className="voyage-crew-ship"
                style={{ left: toLeft(member.position) }}
                role="img"
                aria-label={`${member.name}의 우주선, ${stops[Math.floor(Math.min(member.position, lastIndex))].name} 근처`}
              >
                🚀
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
