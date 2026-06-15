'use client';

import { useEffect, useState } from 'react';
import { BADGES } from '@/lib/badges';
import Notice from '@/components/ui/Notice';

const DEFAULT_TITLES = [
  { tier: 1, name: '별빛 새싹',  threshold: 0  },
  { tier: 2, name: '별빛 탐험가', threshold: 5  },
  { tier: 3, name: '별빛 기록자', threshold: 10 },
  { tier: 4, name: '별빛 마스터', threshold: 15 },
  { tier: 5, name: '별빛 전설',  threshold: 20 },
];

const CATEGORY_LABELS: Record<string, string> = {
  emotion: '감정 기록',
  plan: '일일 계획',
  reflection: '성찰일기',
  letter: '클래스메일',
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

export default function ClassSettings({ classId }: { classId: string }) {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // 뱃지 설정 상태: badgeId → isEnabled
  const [badgeEnabled, setBadgeEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BADGES.map((b) => [b.id, true]))
  );
  const [badgeSaving, setBadgeSaving] = useState(false);

  // 칭호 설정 상태
  const [titles, setTitles] = useState(DEFAULT_TITLES.map((t) => ({ ...t })));
  const [titleSaving, setTitleSaving] = useState(false);

  const clear = () => window.setTimeout(() => { setMsg(''); setError(''); }, 2500);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    api<{ badges: { badge_id: string; is_enabled: boolean }[]; titles: { tier: number; name: string; threshold: number }[] }>(
      `/api/teacher/class-settings?classId=${classId}`
    )
      .then((d) => {
        if (d.badges.length > 0) {
          const map: Record<string, boolean> = Object.fromEntries(BADGES.map((b) => [b.id, true]));
          d.badges.forEach((b) => { map[b.badge_id] = b.is_enabled; });
          setBadgeEnabled(map);
        } else {
          setBadgeEnabled(Object.fromEntries(BADGES.map((b) => [b.id, true])));
        }
        if (d.titles.length === 5) {
          setTitles([...d.titles].sort((a, b) => a.tier - b.tier));
        } else {
          setTitles(DEFAULT_TITLES.map((t) => ({ ...t })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  const onToggleBadge = (id: string) => {
    setBadgeEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onSelectAll = (enable: boolean) => {
    setBadgeEnabled(Object.fromEntries(BADGES.map((b) => [b.id, enable])));
  };

  const saveBadges = async () => {
    setBadgeSaving(true); setError('');
    try {
      await api('/api/teacher/class-settings/badges', {
        method: 'PUT',
        body: JSON.stringify({
          classId,
          badges: BADGES.map((b) => ({ badgeId: b.id, isEnabled: badgeEnabled[b.id] ?? true })),
        }),
      });
      setMsg('뱃지 설정이 저장되었습니다.'); clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setBadgeSaving(false); }
  };

  const saveTitles = async () => {
    setTitleSaving(true); setError('');
    try {
      await api('/api/teacher/class-settings/titles', {
        method: 'PUT',
        body: JSON.stringify({ classId, titles }),
      });
      setMsg('칭호 설정이 저장되었습니다.'); clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setTitleSaving(false); }
  };

  const resetTitles = () => setTitles(DEFAULT_TITLES.map((t) => ({ ...t })));

  if (!classId) return <p style={{ color: '#94a3b8', fontSize: 14 }}>학급을 선택하면 설정이 표시됩니다.</p>;
  if (loading) return <p style={{ color: '#94a3b8', fontSize: 14 }}>불러오는 중...</p>;

  // 카테고리별로 그룹
  const categories = Array.from(new Set(BADGES.map((b) => b.category)));
  const enabledCount = Object.values(badgeEnabled).filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Notice type="success" message={msg} />
      <Notice type="error" message={error} />

      {/* ── 뱃지 설정 ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', fontSize: 17 }}>뱃지 설정</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              활성화된 뱃지만 학생들에게 지급됩니다. ({enabledCount}/{BADGES.length}개 활성)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => onSelectAll(true)}>전체 켜기</button>
            <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => onSelectAll(false)}>전체 끄기</button>
          </div>
        </div>

        {categories.map((cat) => (
          <div key={cat}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#475569', letterSpacing: '0.02em' }}>
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {BADGES.filter((b) => b.category === cat).map((b) => {
                const on = badgeEnabled[b.id] ?? true;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onToggleBadge(b.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: on ? '#f0fdf4' : '#f8fafc',
                      border: `1.5px solid ${on ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0, opacity: on ? 1 : 0.35 }}>{b.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 1px', fontWeight: 700, fontSize: 13, color: on ? '#15803d' : '#94a3b8' }}>{b.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.condition}</p>
                    </div>
                    <div style={{
                      width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                      background: on ? '#22c55e' : '#d1d5db',
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16,
                        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button type="button" className="ghost" style={{ width: '100%', marginTop: 4 }} onClick={saveBadges} disabled={badgeSaving}>
          {badgeSaving ? '저장 중...' : '뱃지 설정 저장'}
        </button>
      </section>

      {/* ── 칭호 설정 ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 20, borderTop: '1.5px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', fontSize: 17 }}>칭호 설정</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>각 칭호의 이름과 뱃지 개수 기준을 직접 설정합니다.</p>
          </div>
          <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={resetTitles}>기본값</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {titles.map((t, idx) => (
            <div key={t.tier} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center',
              background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#6366f1', minWidth: 30 }}>Tier {t.tier}</span>
              <input
                value={t.name}
                onChange={(e) => setTitles((prev) => prev.map((ti, i) => i === idx ? { ...ti, name: e.target.value } : ti))}
                maxLength={30}
                placeholder="칭호 이름"
                style={{ margin: 0, fontSize: 14 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>뱃지</span>
                <input
                  type="number"
                  value={t.threshold}
                  onChange={(e) => setTitles((prev) => prev.map((ti, i) => i === idx ? { ...ti, threshold: Math.max(0, Number(e.target.value)) } : ti))}
                  min={0}
                  max={20}
                  style={{ margin: 0, width: 60, fontSize: 14, textAlign: 'center' }}
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>개 이상</span>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="ghost" style={{ width: '100%' }} onClick={saveTitles} disabled={titleSaving}>
          {titleSaving ? '저장 중...' : '칭호 설정 저장'}
        </button>
      </section>
    </div>
  );
}
