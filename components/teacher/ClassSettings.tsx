'use client';

/**
 * ClassSettings — "학급설정" 탭 내용
 * 선택한 학급의 규칙을 교사가 직접 조정합니다.
 * - 뱃지: 어떤 뱃지를 학급에서 사용할지 on/off
 * - 별빛 캐릭터: 5단계 별빛 캐릭터(예: 별빛 새싹~전설)의 이름과 달성 기준(필요 뱃지 개수) 편집
 * classId를 prop으로 받아 해당 학급의 설정을 불러오고 저장합니다.
 */
import { ReactNode, useEffect, useState } from 'react';
import { BADGES } from '@/lib/badges';
import Notice from '@/components/ui/Notice';
import Tabs from '@/components/ui/Tabs';
import StudentRoster from '@/components/teacher/StudentRoster';
import { api } from '@/lib/api-client';

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
  letter: '별빛메일',
};

type SettingSection = 'classes' | 'roster' | 'letters' | 'badges' | 'titles';

type Props = {
  classId: string;
  initialSection?: Exclude<SettingSection, 'classes'>;
  lettersEnabled?: boolean;
  lettersToggling?: boolean;
  onToggleLetters?: () => void;
  onOpenClassManagement?: () => void;
  /** 학급 관리 화면을 이 안에서 그린다. 다른 섹션처럼 페이지를 벗어나지 않게 하려는 것. */
  renderClassManagement?: () => ReactNode;
  /** 명단이 바뀌면 알린다 — 학생 관리 탭의 목록도 다시 불러오게 한다. */
  onRosterChanged?: () => void;
};

export default function ClassSettings({ classId, initialSection = 'roster', lettersEnabled = false, lettersToggling = false, onToggleLetters, onOpenClassManagement, onRosterChanged, renderClassManagement }: Props) {
  const [activeSection, setActiveSection] = useState<SettingSection>(initialSection);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // 뱃지 설정 상태: badgeId → isEnabled
  const [badgeEnabled, setBadgeEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BADGES.map((b) => [b.id, true]))
  );
  const [badgeSaving, setBadgeSaving] = useState(false);

  // 별빛 캐릭터 설정 상태
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

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

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
      setMsg('별빛 캐릭터 설정이 저장되었습니다.'); clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setTitleSaving(false); }
  };

  const resetTitles = () => setTitles(DEFAULT_TITLES.map((t) => ({ ...t })));

  if (!classId) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tabs
        items={[{ key: 'classes', label: '학급관리', icon: '🏫' }]}
        value="classes"
        onChange={() => { if (!renderClassManagement) onOpenClassManagement?.(); }}
      />
      {renderClassManagement
        ? renderClassManagement()
        : <p style={{ color: '#94a3b8', fontSize: 14 }}>학급관리에서 학급을 만들거나 선택해주세요.</p>}
    </div>
  );
  if (loading) return <p style={{ color: '#94a3b8', fontSize: 14 }}>불러오는 중...</p>;

  // 카테고리별로 그룹
  const categories = Array.from(new Set(BADGES.map((b) => b.category)));
  const enabledCount = Object.values(badgeEnabled).filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Tabs
        items={[
          { key: 'classes', label: '학급관리', icon: '🏫' },
          { key: 'roster', label: '학생명단', icon: '🧑‍🚀' },
          { key: 'letters', label: '별빛메일', icon: '💌' },
          { key: 'badges', label: '뱃지설정', icon: '🏅' },
          { key: 'titles', label: '별빛단계', icon: '✨' },
        ]}
        value={activeSection}
        onChange={(key) => {
          // 학급 관리 화면을 안에서 그릴 수 있으면 페이지를 옮기지 않고 섹션만 바꾼다.
          if (key === 'classes' && !renderClassManagement) {
            onOpenClassManagement?.();
            return;
          }
          setActiveSection(key as SettingSection);
        }}
      />

      <Notice type="success" message={msg} />
      <Notice type="error" message={error} />

      {/* ── 학급 관리 ── */}
      {activeSection === 'classes' && renderClassManagement?.()}

      {/* ── 학생 명단 ── */}
      {activeSection === 'roster' && <StudentRoster classId={classId} onChanged={onRosterChanged} />}

      {/* ── 별빛메일 설정 ── */}
      {activeSection === 'letters' && (
        <section className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>별빛메일 설정</h3>
          <p className="hint" style={{ margin: '0 0 16px' }}>학생들이 별빛메일을 주고받을 수 있는지 설정합니다.</p>
          <div className="row space-between" style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fafbff' }}>
            <div><strong style={{ display: 'block', fontSize: 14 }}>별빛메일 사용</strong><span className="hint">끄면 학생 화면에서 편지 기능을 사용할 수 없습니다.</span></div>
            <div className="row" style={{ width: 'auto' }}>
              <button
                type="button"
                aria-pressed={lettersEnabled}
                aria-label={`별빛메일 ${lettersEnabled ? '끄기' : '켜기'}`}
                onClick={onToggleLetters}
                disabled={lettersToggling || !onToggleLetters}
                style={{ width: 44, minHeight: 24, height: 24, padding: 0, borderRadius: 12, background: lettersEnabled ? '#16a34a' : '#cbd5e1', boxShadow: 'none', position: 'relative' }}
              >
                <span style={{ position: 'absolute', top: 3, left: lettersEnabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </button>
              <strong style={{ color: lettersEnabled ? '#16a34a' : '#94a3b8', fontSize: 12 }}>{lettersToggling ? '변경 중' : lettersEnabled ? 'ON' : 'OFF'}</strong>
            </div>
          </div>
        </section>
      )}

      {/* ── 뱃지 설정 ── */}
      {activeSection === 'badges' && <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      </section>}

      {/* ── 별빛 캐릭터 설정 ── */}
      {activeSection === 'titles' && <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', fontSize: 17 }}>별빛 캐릭터 설정</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>각 별빛 캐릭터의 이름과 뱃지 개수 기준을 직접 설정합니다.</p>
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
                placeholder="별빛 캐릭터 이름"
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
          {titleSaving ? '저장 중...' : '별빛 캐릭터 설정 저장'}
        </button>
      </section>}
    </div>
  );
}
