'use client';

/**
 * AdminNoticeManager — 관리자 전용 "알림설정" 탭
 * 교사가 로그인할 때 뜨는 공지(알림장)를 관리합니다.
 * - 새 알림 등록: 제목·내용·표시 기간(시작~종료)·즉시 활성화 여부
 * - 목록: 상태 배지(표시 중/예약/종료/비활성), 활성 토글, 수정, 삭제, "다시 보지 않기" 누른 교사 수
 * 서버 API: /api/admin/notices (관리자 role만 접근 가능)
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import RefreshButton from '@/components/ui/RefreshButton';

type Notice = {
  id: string;
  title: string;
  content: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  createdAt: string;
  dismissedCount: number;
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : '요청에 실패했습니다.');
  return json;
};

// 서울 기준 오늘 날짜(YYYY-MM-DD)
const seoulToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const addDays = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE');
};

type FormState = { title: string; content: string; startsOn: string; endsOn: string; isActive: boolean };
const emptyForm = (): FormState => ({ title: '', content: '', startsOn: seoulToday(), endsOn: addDays(seoulToday(), 7), isActive: true });

export default function AdminNoticeManager() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [savingId, setSavingId] = useState<string | null>(null);

  const notify = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ notices: Notice[] }>('/api/admin/notices');
      setNotices(d.notices);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setError('');
    setCreating(true);
    try {
      await api('/api/admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      setCreateForm(emptyForm());
      await load();
      notify('알림을 등록했습니다.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const patchNotice = async (id: string, body: Partial<FormState>, okMsg: string) => {
    setError('');
    setSavingId(id);
    try {
      await api(`/api/admin/notices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await load();
      notify(okMsg);
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('이 알림을 삭제할까요? 교사들의 "다시 보지 않기" 기록도 함께 삭제됩니다.')) return;
    setError('');
    setSavingId(id);
    try {
      await api(`/api/admin/notices/${id}`, { method: 'DELETE' });
      await load();
      notify('알림을 삭제했습니다.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const startEdit = (n: Notice) => {
    setEditingId(n.id);
    setEditForm({ title: n.title, content: n.content, startsOn: n.startsOn, endsOn: n.endsOn, isActive: n.isActive });
  };

  const today = seoulToday();
  const statusOf = (n: Notice): { label: string; color: string; bg: string } => {
    if (!n.isActive) return { label: '비활성', color: '#64748b', bg: '#f1f5f9' };
    if (today < n.startsOn) return { label: '예약됨', color: '#0369a1', bg: '#e0f2fe' };
    if (today > n.endsOn) return { label: '기간종료', color: '#92400e', bg: '#fef3c7' };
    return { label: '표시 중', color: '#166534', bg: '#dcfce7' };
  };

  return (
    <section className="card">
      <div className="row space-between" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>알림설정</h2>
          <p className="hint" style={{ margin: 0 }}>교사가 로그인할 때 표시할 알림장을 등록합니다. 표시 기간 동안 매 로그인 시 뜨며, 교사가 &apos;다시 보지 않기&apos;를 선택하면 그 교사에게는 더 이상 표시되지 않습니다.</p>
        </div>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
      {message && <p style={{ color: '#16a34a', fontSize: 13, margin: '0 0 10px' }}>{message}</p>}

      {/* 새 알림 등록 */}
      <form onSubmit={onCreate} style={{ border: '1.5px solid #e0e7ff', borderRadius: 12, padding: 16, marginBottom: 20, display: 'grid', gap: 12, background: '#fafbff' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>새 알림 등록</p>
        <div>
          <label>제목</label>
          <input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="예) 여름방학 데이터 백업 안내" maxLength={200} required />
        </div>
        <div>
          <label>내용</label>
          <textarea value={createForm.content} onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))} placeholder="교사에게 안내할 내용을 입력하세요." rows={4} maxLength={4000} required />
        </div>
        <div className="grid two" style={{ gap: 12 }}>
          <div>
            <label>표시 시작일</label>
            <input type="date" value={createForm.startsOn} onChange={(e) => setCreateForm((f) => ({ ...f, startsOn: e.target.value }))} required />
          </div>
          <div>
            <label>표시 종료일</label>
            <input type="date" value={createForm.endsOn} min={createForm.startsOn} onChange={(e) => setCreateForm((f) => ({ ...f, endsOn: e.target.value }))} required />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
          <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))} style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: '#475569' }}>바로 활성화 (체크 해제 시 나중에 켤 수 있습니다)</span>
        </label>
        <button type="submit" className="ghost" style={{ width: '100%' }} disabled={creating}>
          {creating ? '등록 중...' : '알림 등록'}
        </button>
      </form>

      {/* 알림 목록 */}
      {loading && notices.length === 0 ? (
        <p className="hint">불러오는 중...</p>
      ) : notices.length === 0 ? (
        <EmptyState title="등록된 알림이 없습니다" description="위에서 새 알림을 등록하면 교사 로그인 시 표시됩니다." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {notices.map((n) => {
            const status = statusOf(n);
            const isEditing = editingId === n.id;
            const busy = savingId === n.id;
            return (
              <div key={n.id} style={{ border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                {!isEditing ? (
                  <>
                    <div className="row space-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: status.color, background: status.bg, borderRadius: 20, padding: '2px 10px' }}>{status.label}</span>
                          <strong style={{ fontSize: 15, color: '#1e1b4b', wordBreak: 'break-word' }}>{n.title}</strong>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#475569', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.content}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                          {n.startsOn} ~ {n.endsOn} · 다시 보지 않기 {n.dismissedCount}명
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => patchNotice(n.id, { isActive: !n.isActive }, n.isActive ? '알림을 비활성화했습니다.' : '알림을 활성화했습니다.')}
                        disabled={busy}
                        style={{ width: 'auto', fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid', borderColor: n.isActive ? '#fca5a5' : '#86efac', background: '#fff', color: n.isActive ? '#dc2626' : '#16a34a' }}
                      >
                        {n.isActive ? '비활성화' : '활성화'}
                      </button>
                      <button type="button" className="outline" style={{ width: 'auto', fontSize: 12.5, padding: '6px 14px' }} onClick={() => startEdit(n)} disabled={busy}>수정</button>
                      <button type="button" style={{ width: 'auto', fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626' }} onClick={() => onDelete(n.id)} disabled={busy}>삭제</button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <label>제목</label>
                      <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} />
                    </div>
                    <div>
                      <label>내용</label>
                      <textarea value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} rows={4} maxLength={4000} />
                    </div>
                    <div className="grid two" style={{ gap: 12 }}>
                      <div>
                        <label>표시 시작일</label>
                        <input type="date" value={editForm.startsOn} onChange={(e) => setEditForm((f) => ({ ...f, startsOn: e.target.value }))} />
                      </div>
                      <div>
                        <label>표시 종료일</label>
                        <input type="date" value={editForm.endsOn} min={editForm.startsOn} onChange={(e) => setEditForm((f) => ({ ...f, endsOn: e.target.value }))} />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, color: '#475569' }}>활성화</span>
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="ghost" style={{ flex: 1 }} onClick={() => patchNotice(n.id, editForm, '알림을 수정했습니다.')} disabled={busy}>{busy ? '저장 중...' : '저장'}</button>
                      <button type="button" className="outline" style={{ flex: 1 }} onClick={() => setEditingId(null)} disabled={busy}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
