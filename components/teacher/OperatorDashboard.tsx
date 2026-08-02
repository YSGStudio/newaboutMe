'use client';

/**
 * OperatorDashboard — 관리자 전용 "운영관리" 탭
 * 웹사이트 운영에 필요한 기능을 한 화면에 모은 운영자 대시보드입니다. (운영자.md 1단계)
 * - 상단: 운영 개요 KPI(교사/유료/학급/학생 수, 이번 달 AI 사용량·추정 비용)
 * - 하위 섹션: 회원관리(등급 변경·검색·정렬·만료임박) / 사용량·비용 / 공지(알림장)
 * 기존 권한설정·알림설정 탭을 이 안으로 흡수했습니다. 모든 API는 관리자(role=admin)만 접근합니다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RefreshButton from '@/components/ui/RefreshButton';
import AdminNoticeManager from '@/components/teacher/AdminNoticeManager';

type Role = 'general' | 'paid' | 'admin';

type TeacherRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  paidUntil: string | null;
  aiMonthlyLimit: number | null;
  aiUsedThisMonth: number;
  createdAt: string;
};

type Overview = {
  counts: { teacherTotal: number; teacherPaid: number; teacherAdmin: number; classCount: number; studentCount: number };
  classes: { id: string; class_name: string }[];
  ai: {
    thisMonthTotal: number;
    byFeature: Record<string, number>;
    estimatedCostUsd: number;
    topTeachers: { id: string; name: string; count: number }[];
  };
  activityLast7Days: { emotion: number; planCompleted: number; letter: number; evalReport: number; reflection: number };
  activeStudents: { dau: number; wau: number };
  nextYearResetDate: string;
  expiringSoon: { id: string; name: string; paidUntil: string | null }[];
};

type AppSettings = {
  freeAiLimit: number;
  paidAiLimit: number;
  freeClassLimit: number;
  maintenanceOn: boolean;
  maintenanceMessage: string;
};

type AuditLog = { id: string; actorName: string; action: string; detail: string | null; createdAt: string };

const AUDIT_LABEL: Record<string, string> = {
  teacher_role_change: '등급 변경',
  notice_create: '알림 등록',
  notice_update: '알림 수정',
  notice_delete: '알림 삭제',
  settings_update: '설정 변경',
  year_reset_manual: '학년말 초기화',
  data_export: '데이터 내보내기',
};

const ROLE_LABEL: Record<Role, string> = { general: '일반', paid: '유료', admin: '관리자' };
const ROLE_COLOR: Record<Role, string> = { general: '#64748b', paid: '#16a34a', admin: '#7c3aed' };
const FEATURE_LABEL: Record<string, string> = {
  growth_report: '성장 분석',
  holland_report: '홀란드 분석',
  subject_report: '종합평가',
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : '요청에 실패했습니다.');
  return json;
};

type SortKey = 'name' | 'createdAt' | 'aiUsedThisMonth' | 'role';

export default function OperatorDashboard() {
  const [section, setSection] = useState<'members' | 'usage' | 'notices' | 'settings' | 'audit' | 'ops'>('members');
  const [overview, setOverview] = useState<Overview | null>(null);

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState('');
  const edits = useRef<Map<string, { role: Role; paidUntil: string }>>(new Map());

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');

  // 설정 섹션
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  // 감사 로그 섹션
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  // 데이터·운영 섹션
  const [exportClassId, setExportClassId] = useState('');
  const [resetting, setResetting] = useState(false);

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, ts] = await Promise.all([
        api<Overview>('/api/admin/overview'),
        api<{ teachers: TeacherRow[] }>('/api/admin/teachers'),
      ]);
      setOverview(ov);
      setTeachers(ts.teachers);
      edits.current = new Map(ts.teachers.map((t) => [t.id, { role: t.role, paidUntil: t.paidUntil ?? '' }]));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaveRole = async (teacherId: string) => {
    const edit = edits.current.get(teacherId);
    if (!edit) return;
    setSavingId(teacherId);
    setError('');
    setMessage('');
    try {
      await api('/api/admin/teachers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          role: edit.role,
          paidUntil: edit.role === 'paid' && edit.paidUntil ? edit.paidUntil : null,
        }),
      });
      await load();
      setMessage('저장되었습니다.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId('');
    }
  };

  // 섹션 열릴 때 필요한 데이터 지연 로드 (설정·감사로그)
  useEffect(() => {
    if (section === 'settings' && !settings) {
      api<{ settings: AppSettings }>('/api/admin/settings')
        .then((d) => { setSettings(d.settings); setSettingsForm(d.settings); })
        .catch((e) => setError((e as Error).message));
    }
    if (section === 'audit' && !auditLoaded) {
      api<{ logs: AuditLog[] }>('/api/admin/audit')
        .then((d) => { setAuditLogs(d.logs); setAuditLoaded(true); })
        .catch((e) => setError((e as Error).message));
    }
  }, [section, settings, auditLoaded]);

  const saveSettings = async () => {
    if (!settingsForm) return;
    setSettingsSaving(true);
    setError('');
    try {
      const d = await api<{ settings: AppSettings }>('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      setSettings(d.settings);
      setSettingsForm(d.settings);
      setMessage('설정을 저장했습니다.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const runYearReset = async () => {
    const input = window.prompt('학년말 데이터 초기화를 실행하면 모든 학급·학생·기록이 영구 삭제됩니다.\n계속하려면 "초기화"를 입력하세요.');
    if (input === null) return;
    if (input !== '초기화') { window.alert('확인 문구가 일치하지 않아 취소되었습니다.'); return; }
    setResetting(true);
    setError('');
    try {
      const d = await api<{ deletedClasses: number }>('/api/admin/reset-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: '초기화' }),
      });
      setMessage(`학년말 초기화 완료 — 학급 ${d.deletedClasses}개 삭제`);
      await load();
      setAuditLoaded(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const exportClass = () => {
    if (!exportClassId) { window.alert('내보낼 학급을 선택하세요.'); return; }
    window.open(`/api/admin/export?classId=${exportClassId}`, '_blank');
  };

  // 검색 + 정렬된 교사 목록
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? teachers.filter((t) => `${t.name} ${t.email}`.toLowerCase().includes(q))
      : teachers;
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name);
        case 'aiUsedThisMonth': return b.aiUsedThisMonth - a.aiUsedThisMonth;
        case 'role': return a.role.localeCompare(b.role);
        default: return b.createdAt.localeCompare(a.createdAt); // 최신 가입 순
      }
    });
    return sorted;
  }, [teachers, search, sortKey]);

  const kpi = (label: string, value: string | number, sub?: string, accent = '#6366f1') => (
    <div style={{ flex: '1 1 120px', minWidth: 120, background: '#fff', border: '1px solid #e0e7ff', borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: accent }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  );

  return (
    <section className="card">
      <div className="row space-between" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>운영관리</h2>
          <p className="hint" style={{ margin: 0 }}>서비스 운영 현황을 한눈에 보고, 회원·공지를 관리합니다. (관리자 전용)</p>
        </div>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      {/* 운영 개요 KPI */}
      {overview && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {kpi('교사', overview.counts.teacherTotal, `유료 ${overview.counts.teacherPaid} · 관리자 ${overview.counts.teacherAdmin}`)}
          {kpi('학급', overview.counts.classCount)}
          {kpi('학생', overview.counts.studentCount)}
          {kpi('이번 달 AI', `${overview.ai.thisMonthTotal}회`, `추정 $${overview.ai.estimatedCostUsd.toFixed(2)}`, '#0891b2')}
          {kpi('활동 학생', `${overview.activeStudents.dau}명`, `주간 ${overview.activeStudents.wau}명`, '#0d9488')}
          {kpi('유료 만료 임박', `${overview.expiringSoon.length}명`, '7일 이내', overview.expiringSoon.length > 0 ? '#dc2626' : '#16a34a')}
        </div>
      )}

      {/* 하위 섹션 탭 */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['members', '회원관리'], ['usage', '사용량·비용'], ['notices', '공지'], ['settings', '설정'], ['audit', '감사로그'], ['ops', '데이터·운영']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            style={{
              width: 'auto', minHeight: 'unset', flex: '1 1 auto', padding: '8px 12px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: section === key ? '#fff' : 'transparent',
              color: section === key ? '#4f46e5' : '#64748b',
              boxShadow: section === key ? '0 1px 4px rgba(79,70,229,0.15)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 회원관리 ── */}
      {section === 'members' && (
        <>
          {message && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 10 }}>{message}</p>}

          {overview && overview.expiringSoon.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
              <b>유료 만료 임박(7일 이내):</b>{' '}
              {overview.expiringSoon.map((t) => `${t.name}(${t.paidUntil})`).join(', ')}
            </div>
          )}

          <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름·이메일로 검색"
              style={{ flex: '1 1 200px' }}
            />
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ flex: '0 0 auto', width: 'auto' }}>
              <option value="createdAt">최신 가입 순</option>
              <option value="name">이름 순</option>
              <option value="aiUsedThisMonth">AI 사용량 순</option>
              <option value="role">등급 순</option>
            </select>
          </div>

          {loading && teachers.length === 0 ? (
            <p className="hint">교사 목록을 불러오는 중...</p>
          ) : displayed.length === 0 ? (
            <p className="hint">{search.trim() ? '검색 결과가 없습니다.' : '등록된 교사가 없습니다.'}</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px 100px 130px 100px 60px', gap: 8, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  {['이름', '아이디(이메일)', '현재등급', '변경등급', '유료 만료일', 'AI 사용/한도', ''].map((h) => (
                    <span key={h} style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</span>
                  ))}
                </div>
                {displayed.map((teacher, idx) => {
                  const expiringSoon = teacher.role === 'paid' && teacher.paidUntil !== null
                    && teacher.paidUntil >= today
                    && teacher.paidUntil <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
                  return (
                    <div
                      key={teacher.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '90px 1fr 70px 100px 130px 100px 60px', gap: 8,
                        alignItems: 'center', padding: '10px 14px',
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        borderBottom: idx < displayed.length - 1 ? '1px solid #f1f5f9' : 'none',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{teacher.name}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                          가입 {new Date(teacher.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {teacher.email || '-'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLOR[teacher.role] }}>
                        {ROLE_LABEL[teacher.role]}
                        {teacher.role === 'paid' && teacher.paidUntil && (
                          <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: expiringSoon ? '#dc2626' : '#94a3b8' }}>
                            ~{teacher.paidUntil}{expiringSoon ? ' ⚠' : ''}
                          </span>
                        )}
                      </span>
                      <select
                        defaultValue={teacher.role}
                        onChange={(e) => {
                          const current = edits.current.get(teacher.id) ?? { role: teacher.role, paidUntil: teacher.paidUntil ?? '' };
                          edits.current.set(teacher.id, { ...current, role: e.target.value as Role });
                        }}
                        disabled={teacher.role === 'admin'}
                        style={{ fontSize: 13, padding: '6px 8px' }}
                      >
                        <option value="general">일반</option>
                        <option value="paid">유료</option>
                      </select>
                      <input
                        type="date"
                        defaultValue={teacher.paidUntil ?? ''}
                        onChange={(e) => {
                          const current = edits.current.get(teacher.id) ?? { role: teacher.role, paidUntil: '' };
                          edits.current.set(teacher.id, { ...current, paidUntil: e.target.value });
                        }}
                        disabled={teacher.role === 'admin'}
                        style={{ fontSize: 12, padding: '6px 8px' }}
                      />
                      <span
                        title="이번 달 AI 분석 사용량 / 월 한도 (무료 10회, 유료 100회, 관리자 무제한)"
                        style={{
                          fontSize: 12, fontWeight: 700,
                          color: teacher.aiMonthlyLimit !== null && teacher.aiUsedThisMonth >= teacher.aiMonthlyLimit ? '#dc2626' : '#334155',
                        }}
                      >
                        {teacher.aiUsedThisMonth}/{teacher.aiMonthlyLimit ?? '∞'}
                      </span>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: '100%', padding: '7px 0', fontSize: 12 }}
                        onClick={() => onSaveRole(teacher.id)}
                        disabled={savingId === teacher.id || teacher.role === 'admin'}
                      >
                        {savingId === teacher.id ? '...' : '저장'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 사용량·비용 ── */}
      {section === 'usage' && (
        overview ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>이번 달 AI 분석</h3>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569' }}>
                총 <b>{overview.ai.thisMonthTotal}회</b> · 추정 비용 <b>${overview.ai.estimatedCostUsd.toFixed(2)}</b>
                <span style={{ color: '#94a3b8' }}> (gpt-4o 기준 추정치)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(overview.ai.byFeature).map(([feature, count]) => (
                  <span key={feature} style={{ fontSize: 13, background: '#eef2ff', color: '#4338ca', borderRadius: 8, padding: '6px 12px' }}>
                    {FEATURE_LABEL[feature] ?? feature} <b>{count}</b>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>AI 사용 상위 교사</h3>
              {overview.ai.topTeachers.length === 0 ? (
                <p className="hint">이번 달 사용 기록이 없습니다.</p>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {overview.ai.topTeachers.map((t, i) => (
                    <div key={t.id} className="row space-between" style={{ fontSize: 13, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                      <span>{i + 1}. {t.name}</span>
                      <b>{t.count}회</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>최근 7일 활동</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['감정 기록', overview.activityLast7Days.emotion],
                  ['계획 실천', overview.activityLast7Days.planCompleted],
                  ['클래스메일', overview.activityLast7Days.letter],
                  ['평가', overview.activityLast7Days.evalReport],
                  ['성찰일기', overview.activityLast7Days.reflection],
                ].map(([label, count]) => (
                  <span key={label as string} style={{ fontSize: 13, background: '#f0fdf4', color: '#166534', borderRadius: 8, padding: '6px 12px' }}>
                    {label} <b>{count}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="hint">불러오는 중...</p>
        )
      )}

      {/* ── 공지(알림장) ── */}
      {section === 'notices' && <AdminNoticeManager />}

      {/* ── 설정 ── */}
      {section === 'settings' && (
        settingsForm ? (
          <div style={{ display: 'grid', gap: 16, maxWidth: 460 }}>
            {message && <p style={{ color: '#16a34a', fontSize: 13, margin: 0 }}>{message}</p>}
            <p className="hint" style={{ margin: 0 }}>여기서 바꾼 값은 코드 배포 없이 바로 적용됩니다. (최대 1분 캐시)</p>
            <div>
              <label>무료회원 월 AI 분석 한도</label>
              <input type="number" min={0} value={settingsForm.freeAiLimit}
                onChange={(e) => setSettingsForm((f) => f && ({ ...f, freeAiLimit: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <div>
              <label>유료회원 월 AI 분석 한도</label>
              <input type="number" min={0} value={settingsForm.paidAiLimit}
                onChange={(e) => setSettingsForm((f) => f && ({ ...f, paidAiLimit: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <div>
              <label>무료회원 학급 생성 한도</label>
              <input type="number" min={0} value={settingsForm.freeClassLimit}
                onChange={(e) => setSettingsForm((f) => f && ({ ...f, freeClassLimit: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={settingsForm.maintenanceOn}
                  onChange={(e) => setSettingsForm((f) => f && ({ ...f, maintenanceOn: e.target.checked }))}
                  style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>점검 배너 표시</span>
              </label>
              <input style={{ marginTop: 8 }} placeholder="점검 안내 문구 (예: 오늘 22시~24시 서비스 점검 예정)"
                value={settingsForm.maintenanceMessage} maxLength={500}
                onChange={(e) => setSettingsForm((f) => f && ({ ...f, maintenanceMessage: e.target.value }))} />
              <p className="hint" style={{ margin: '6px 0 0' }}>켜면 모든 사용자 화면 상단에 안내 배너가 노출됩니다.</p>
            </div>
            <button type="button" className="ghost" onClick={saveSettings} disabled={settingsSaving}>
              {settingsSaving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        ) : <p className="hint">불러오는 중...</p>
      )}

      {/* ── 감사로그 ── */}
      {section === 'audit' && (
        !auditLoaded ? <p className="hint">불러오는 중...</p>
        : auditLogs.length === 0 ? <p className="hint">기록된 관리자 활동이 없습니다.</p>
        : (
          <div style={{ display: 'grid', gap: 6 }}>
            <p className="hint" style={{ margin: '0 0 4px' }}>관리자의 등급 변경·공지·설정·초기화 등 주요 행위 기록(최근 50건)</p>
            {auditLogs.map((log) => (
              <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '150px 90px 1fr', gap: 8, alignItems: 'baseline', fontSize: 12.5, padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>
                <span style={{ color: '#94a3b8' }}>{new Date(log.createdAt).toLocaleString('ko-KR')}</span>
                <span style={{ fontWeight: 700, color: '#4338ca' }}>{AUDIT_LABEL[log.action] ?? log.action}</span>
                <span style={{ color: '#334155' }}>{log.actorName} · {log.detail ?? ''}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── 데이터·운영 ── */}
      {section === 'ops' && overview && (
        <div style={{ display: 'grid', gap: 20 }}>
          {message && <p style={{ color: '#16a34a', fontSize: 13, margin: 0 }}>{message}</p>}

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>학급 데이터 내보내기</h3>
            <p className="hint" style={{ margin: '0 0 8px' }}>선택한 학급의 학생·감정기록·평가를 JSON 파일로 백업합니다.</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <select value={exportClassId} onChange={(e) => setExportClassId(e.target.value)} style={{ flex: '1 1 200px' }}>
                <option value="">학급 선택…</option>
                {overview.classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
              <button type="button" className="outline" style={{ width: 'auto' }} onClick={exportClass} disabled={!exportClassId}>
                JSON 내보내기
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>학년말 데이터 초기화</h3>
            <p className="hint" style={{ margin: '0 0 4px' }}>
              자동 초기화 예정일: <b>{overview.nextYearResetDate}</b> (매년 3월 1일, 서울 기준)
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#b91c1c' }}>
              ⚠ 수동 실행 시 <b>모든 학급·학생·기록이 즉시 영구 삭제</b>됩니다. 되돌릴 수 없습니다.
            </p>
            <button
              type="button"
              onClick={runYearReset}
              disabled={resetting}
              style={{ width: 'auto', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626' }}
            >
              {resetting ? '초기화 중...' : '지금 학년말 초기화 실행'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
