'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BADGES } from '@/lib/badges';

type BadgeWithStatus = (typeof BADGES)[number] & { earned: boolean; earnedAt: string | null; isEnabled: boolean };

const TITLE_META: Record<string, { color: string; next: string | null; nextThreshold: number; image: string }> = {
  '별빛 새싹':   { color: '#22c55e', next: '별빛 탐험가', nextThreshold: 5,  image: '/별빛새싹.png' },
  '별빛 탐험가': { color: '#3b82f6', next: '별빛 기록자', nextThreshold: 10, image: '/별빛탐험가.png' },
  '별빛 기록자': { color: '#8b5cf6', next: '별빛 마스터', nextThreshold: 15, image: '/별빛기록자.png' },
  '별빛 마스터': { color: '#f59e0b', next: '별빛 전설',  nextThreshold: 20, image: '/별빛마스터.png' },
  '별빛 전설':   { color: '#ec4899', next: null,        nextThreshold: 20, image: '/별빛전설.png' },
};

type Stats = { emotionCount: number; perfectPlanDays: number; reflectionCount: number; letterSentCount: number };

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeWithStatus[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [title, setTitle] = useState('별빛 새싹');
  const [stats, setStats] = useState<Stats>({ emotionCount: 0, perfectPlanDays: 0, reflectionCount: 0, letterSentCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/badges/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.badges) {
          setBadges(d.badges);
          setBadgeCount(d.badgeCount);
          setTitle(d.title);
          if (d.stats) setStats(d.stats);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const titleMeta = TITLE_META[title] ?? null;
  const enabledBadges = badges.filter((b) => b.isEnabled);
  const totalEnabled = enabledBadges.length || 20;
  const progressRatio = Math.min(badgeCount / totalEnabled, 1);


  return (
    <main style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", maxWidth: 680, margin: '0 auto', padding: '80px 16px 40px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/student" style={{ textDecoration: 'none', color: '#6366f1', fontSize: 14, fontWeight: 600 }}>← 돌아가기</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e1b4b' }}>내 뱃지 모음판</h1>
      </div>

      {/* 칭호 카드 */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
        borderRadius: 20, padding: '28px 28px 24px',
        color: '#fff', marginBottom: 24,
      }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#a5b4fc' }}>현재 칭호</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {titleMeta && <img src={titleMeta.image} alt={title} style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />}
          <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: titleMeta?.color ?? '#a78bfa' }}>{title}</p>
        </div>

        {/* 전체 진행 바 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#c7d2fe' }}>뱃지 수집 현황</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{badgeCount} / {totalEnabled}개</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 8,
              background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
              width: `${progressRatio * 100}%`,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {titleMeta?.next && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#a5b4fc' }}>
            다음 칭호 <strong style={{ color: '#fbbf24' }}>{titleMeta.next}</strong>까지{' '}
            {Math.max(0, titleMeta.nextThreshold - badgeCount)}개 더 필요해요
          </p>
        )}
        {titleMeta && !titleMeta.next && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>
            🌈 최고 칭호 달성! 모든 뱃지를 수집했어요!
          </p>
        )}

        {/* 누적 기록 통계 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { icon: '💜', label: '감정 기록', value: stats.emotionCount,    unit: '회' },
            { icon: '✅', label: '계획 100%', value: stats.perfectPlanDays, unit: '일' },
            { icon: '📝', label: '성찰일기',  value: stats.reflectionCount, unit: '회' },
            { icon: '💌', label: '편지 발송', value: stats.letterSentCount, unit: '통' },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.12)', borderRadius: 10,
              padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6,
              border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
            }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: '#a5b4fc', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap' }}>
                {s.value}<span style={{ fontSize: 11, fontWeight: 400, color: '#a5b4fc', marginLeft: 2 }}>{s.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>


      {/* 뱃지 그리드 */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>불러오는 중...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 14,
        }}>
          {enabledBadges.map((badge) => (
            <div
              key={badge.id}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: '20px 12px 16px',
                textAlign: 'center',
                border: badge.earned ? `2px solid ${badge.categoryColor}` : '1.5px solid #e2e8f0',
                boxShadow: badge.earned ? `0 0 16px ${badge.categoryColor}44` : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'filter 0.5s, box-shadow 0.5s',
                filter: badge.earned ? 'none' : 'grayscale(100%) opacity(0.45)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>{badge.icon}</div>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: badge.earned ? '#1e1b4b' : '#94a3b8' }}>
                {badge.name}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                {badge.condition}
              </p>
              {badge.earned && badge.earnedAt && (
                <p style={{ margin: 0, fontSize: 10, color: badge.categoryColor, fontWeight: 600 }}>
                  {badge.earnedAt.slice(0, 10)}
                </p>
              )}
              {!badge.earned && (
                <span style={{
                  position: 'absolute', top: 10, right: 10,
                  fontSize: 14, opacity: 0.5,
                }}>🔒</span>
              )}
              {badge.earned && (
                <span style={{
                  position: 'absolute', top: 10, right: 10,
                  fontSize: 14,
                }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
