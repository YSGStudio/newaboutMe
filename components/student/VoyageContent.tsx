'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Star = {
  level: number;
  name: string;
  emoji: string;
  fuel_threshold: number;
  reward_ship_tier: number | null;
  fact: string;
};

type Ledger = {
  id: string;
  source_type: string;
  amount: number;
  multiplier: number;
  earned_on: string;
  note: string | null;
};

type VoyageData = {
  student: { id: string; name: string };
  state: { total_fuel: number; current_star: number; ship_tier: number; streak_days: number };
  stars: Star[];
  recentLog: Ledger[];
  todayFuel: number;
  missions: { plan: boolean; emotion: boolean; reflection: boolean; letterCount: number };
};

type QuestSummary = {
  title: string;
  badgeCount: number;
  totalEnabled: number;
};

const SOURCE_LABEL: Record<string, string> = {
  plan_check: '오늘 계획 전체 체크',
  emotion_feed: '감정 기록',
  reflection: '성찰일기',
  letter: '클래스메일',
  badge: '새 뱃지 획득',
  weekly_streak: '주간 개근 보너스',
  teacher_grant: '선생님 특별 연료',
  teacher_revoke: '연료 조정',
  comeback: '복귀 보너스',
};

export default function VoyageContent({ standalone = false }: { standalone?: boolean }) {
  const [data, setData] = useState<VoyageData | null>(null);
  const [quest, setQuest] = useState<QuestSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/voyage/me').then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '항해 정보를 불러오지 못했습니다.');
        return json as VoyageData;
      }),
      fetch('/api/badges/me').then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '별빛 퀘스트를 불러오지 못했습니다.');
        const totalEnabled = Array.isArray(json.badges)
          ? json.badges.filter((badge: { isEnabled: boolean }) => badge.isEnabled).length
          : 20;
        return {
          title: json.title ?? '별빛 새싹',
          badgeCount: json.badgeCount ?? 0,
          totalEnabled: totalEnabled || 20,
        } as QuestSummary;
      }),
    ])
      .then(([voyageData, questData]) => {
        setData(voyageData);
        setQuest(questData);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const progress = useMemo(() => {
    if (!data) return { next: null as Star | null, previous: 0, percent: 0 };
    const next = data.stars.find((star) => star.fuel_threshold > data.state.total_fuel) ?? null;
    const previous = [...data.stars].reverse().find((star) => star.fuel_threshold <= data.state.total_fuel)?.fuel_threshold ?? 0;
    const percent = next ? Math.min(100, ((data.state.total_fuel - previous) / (next.fuel_threshold - previous)) * 100) : 100;
    return { next, previous, percent };
  }, [data]);

  if (error) {
    return <section className="card"><p style={{ color: '#dc2626' }}>{error}</p>{standalone && <Link href="/student">학생 홈으로 돌아가기</Link>}</section>;
  }
  if (!data) return <section className="card"><p>우주선을 준비하고 있어요...</p></section>;

  const missions = [
    { icon: '✅', name: '오늘 계획', fuel: 5, done: data.missions.plan },
    { icon: '💜', name: '감정 기록', fuel: 8, done: data.missions.emotion },
    { icon: '📖', name: '성찰일기', fuel: 10, done: data.missions.reflection },
    { icon: '💌', name: '클래스메일', fuel: 5, done: data.missions.letterCount > 0 },
  ];
  const questPercent = quest ? Math.min(100, (quest.badgeCount / quest.totalEnabled) * 100) : 0;

  return (
    <div className={`voyage-page${standalone ? ' voyage-page-standalone' : ' voyage-page-embedded'}`}>
      <header className="voyage-topbar">
        {standalone ? <Link href="/student">← 학생 홈</Link> : <span className="voyage-topbar-kicker">MY VOYAGE</span>}
        <div><span>✦</span><strong>{data.student.name}의 우주여행</strong></div>
        <span className="voyage-fuel-pill">⛽ {data.state.total_fuel.toLocaleString()}</span>
      </header>

      <section className="voyage-hero">
        <div className="voyage-hero-stars" aria-hidden="true">✦　·　★　　　✧　·　　　★</div>
        <div className={`voyage-ship voyage-ship-tier-${data.state.ship_tier}`} aria-label={`우주선 티어 ${data.state.ship_tier}`}>🚀</div>
        <div className="voyage-hero-copy">
          <p>STAR VOYAGER · TIER {data.state.ship_tier}</p>
          <h1>{progress.next ? `${progress.next.emoji} ${progress.next.name}을 향해 항해 중!` : '⭐ 프록시마 b 도착 완료!'}</h1>
          <span>{progress.next ? `다음 기항지까지 ${progress.next.fuel_threshold - data.state.total_fuel} 연료` : '우주의 끝까지 멋지게 완주했어요'}</span>
        </div>
        <div className="voyage-booster">🔥 감정·계획 {data.state.streak_days}일 연속 · ×{data.state.streak_days >= 10 ? 2 : data.state.streak_days >= 5 ? 1.5 : data.state.streak_days >= 3 ? 1.2 : 1}</div>
      </section>

      <section className="card voyage-route-card">
        <div className="row space-between">
          <div><p className="voyage-section-kicker">MY STAR ROUTE</p><h2>나의 별 지도</h2></div>
          <span>오늘 +{data.todayFuel} 연료</span>
        </div>
        <div className="voyage-route">
          {data.stars.map((star) => {
            const reached = data.state.total_fuel >= star.fuel_threshold;
            const current = star.level === data.state.current_star;
            return (
              <div key={star.level} className={`voyage-star-stop${reached ? ' reached' : ''}${current ? ' current' : ''}`}>
                <span>{star.emoji}</span><small>{star.name}</small>
              </div>
            );
          })}
        </div>
        <div className="voyage-gauge"><div style={{ width: `${progress.percent}%` }}><span>🚀</span></div></div>
        <p className="voyage-gauge-label">
          {progress.next ? `${data.state.total_fuel - progress.previous} / ${progress.next.fuel_threshold - progress.previous}` : '4,000 / 4,000'} 구간 연료
        </p>
      </section>

      <section className="card voyage-missions">
        <div className="row space-between"><div><p className="voyage-section-kicker">TODAY&apos;S FUEL</p><h2>오늘의 연료 충전</h2></div><strong>+{data.todayFuel}</strong></div>
        <div className="voyage-mission-grid">
          {missions.map((mission) => (
            <div key={mission.name} className={`voyage-mission${mission.done ? ' done' : ''}`}>
              <span>{mission.icon}</span><strong>{mission.name}</strong><small>{mission.done ? `+${mission.fuel} 완료` : `+${mission.fuel} 대기`}</small>
            </div>
          ))}
        </div>
      </section>

      {quest && (
        <Link href="/student/badges" className="voyage-quest-card">
          <div className="voyage-quest-icon" aria-hidden="true">🏅</div>
          <div className="voyage-quest-copy">
            <p className="voyage-section-kicker">STARLIGHT QUEST</p>
            <h2>별빛 퀘스트</h2>
            <span>현재 칭호 <strong>{quest.title}</strong></span>
          </div>
          <div className="voyage-quest-progress">
            <div><span>수집 현황</span><strong>{quest.badgeCount} / {quest.totalEnabled}</strong></div>
            <div className="voyage-quest-gauge"><i style={{ width: `${questPercent}%` }} /></div>
          </div>
          <span className="voyage-quest-arrow" aria-hidden="true">›</span>
        </Link>
      )}

      <section className="card voyage-log-card">
        <div><p className="voyage-section-kicker">VOYAGE LOG</p><h2>최근 항해일지</h2></div>
        {data.recentLog.length === 0 ? <p className="hint">첫 활동을 완료하면 항해일지가 시작돼요.</p> : (
          <div className="voyage-log-list">
            {data.recentLog.map((entry) => (
              <div key={entry.id}>
                <span>{entry.amount >= 0 ? '✦' : '↘'}</span>
                <div><strong>{SOURCE_LABEL[entry.source_type] ?? entry.source_type}</strong><small>{entry.earned_on}{entry.note ? ` · ${entry.note}` : ''}</small></div>
                <b className={entry.amount >= 0 ? '' : 'negative'}>{entry.amount >= 0 ? '+' : ''}{entry.amount}</b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
