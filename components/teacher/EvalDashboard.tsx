'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';

// ── Types ──────────────────────────────────────────────────────────
type RubricCriterion = {
  title: string;
  level_high: string | null;
  level_mid: string | null;
  level_low: string | null;
};

type Rubric = {
  id: string;
  title: string;
  goal: string | null;
  task: string | null;
  criteria: RubricCriterion[];
  sort_order: number;
};

type ReportLink = { id: string; url: string; label: string | null; sort_order: number };

type ReportSummary = {
  id: string;
  title: string;
  created_at: string;
  eval_report_items: { id: string; grade: string; sort_order: number }[];
  eval_report_images: { id: string; sort_order: number }[];
  eval_report_links: ReportLink[];
};

type ReportDetail = ReportSummary & {
  students: { id: string; name: string; student_number: number };
  eval_report_items: {
    id: string;
    rubric_title_snapshot: string;
    rubric_goal_snapshot: string | null;
    rubric_task_snapshot: string | null;
    rubric_level_high_snapshot: string | null;
    rubric_level_mid_snapshot: string | null;
    rubric_level_low_snapshot: string | null;
    grade: 'high' | 'mid' | 'low';
    teacher_feedback: string | null;
    sort_order: number;
  }[];
  eval_reflections: { id: string; content: string; created_at: string }[];
  eval_parent_comments: { id: string; content: string; created_at: string }[];
};

type StudentItem = { id: string; name: string; student_number: number };

type DraftItem = {
  rubricId: string | null;
  rubricTitleSnapshot: string;
  rubricGoalSnapshot: string | null;
  rubricTaskSnapshot: string | null;
  criterionTitleSnapshot: string | null;
  rubricLevelHighSnapshot: string | null;
  rubricLevelMidSnapshot: string | null;
  rubricLevelLowSnapshot: string | null;
  grade: 'high' | 'mid' | 'low';
  teacherFeedback: string;
  sortOrder: number;
};

const GRADE_LABEL: Record<'high' | 'mid' | 'low', string> = { high: '잘함', mid: '보통', low: '노력' };
const GRADE_COLOR: Record<'high' | 'mid' | 'low', string> = {
  high: '#16a34a',
  mid: '#d97706',
  low: '#dc2626'
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했습니다.');
  return json;
};

// ── Sub: 채점기준 관리 ────────────────────────────────────────────
type FormCriterion = { title: string; levelHigh: string; levelMid: string; levelLow: string };

function RubricManager({ onRubricsChange }: { onRubricsChange?: (rubrics: Rubric[]) => void }) {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ title: string; goal: string; task: string; criteria: FormCriterion[] }>({
    title: '', goal: '', task: '', criteria: []
  });
  const [savingId, setSavingId] = useState('');

  const clear = () => window.setTimeout(() => { setMsg(''); setError(''); }, 2500);

  useEffect(() => {
    api<{ rubrics: Rubric[] }>('/api/eval/rubrics').then((d) => setRubrics(d.rubrics)).catch(() => {});
  }, []);

  const resetForm = () => setForm({ title: '', goal: '', task: '', criteria: [] });

  const addCriterion = () => setForm((prev) => ({
    ...prev,
    criteria: [...prev.criteria, { title: '', levelHigh: '', levelMid: '', levelLow: '' }]
  }));

  const removeCriterion = (idx: number) => setForm((prev) => ({
    ...prev,
    criteria: prev.criteria.filter((_, i) => i !== idx)
  }));

  const updateCriterion = (idx: number, field: 'title' | 'levelHigh' | 'levelMid' | 'levelLow', value: string) =>
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => i === idx ? { ...c, [field]: value } : c)
    }));

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = JSON.stringify({
        title: form.title,
        goal: form.goal || null,
        task: form.task || null,
        criteria: form.criteria.map((c) => ({
          title: c.title,
          levelHigh: c.levelHigh || null,
          levelMid: c.levelMid || null,
          levelLow: c.levelLow || null,
        }))
      });
      if (editingId) {
        const d = await api<{ rubric: Rubric }>(`/api/eval/rubrics/${editingId}`, { method: 'PATCH', body });
        const updated = rubrics.map((r) => (r.id === editingId ? d.rubric : r));
        setRubrics(updated);
        onRubricsChange?.(updated);
        setMsg('수정되었습니다.');
      } else {
        const d = await api<{ rubric: Rubric }>('/api/eval/rubrics', { method: 'POST', body });
        const added = [...rubrics, d.rubric];
        setRubrics(added);
        onRubricsChange?.(added);
        setMsg('채점기준이 등록되었습니다.');
      }
      resetForm();
      setEditingId('');
      setShowForm(false);
      clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setLoading(false); }
  };

  const onEdit = (r: Rubric) => {
    setForm({
      title: r.title,
      goal: r.goal ?? '',
      task: r.task ?? '',
      criteria: r.criteria.map((c) => ({
        title: c.title,
        levelHigh: c.level_high ?? '',
        levelMid: c.level_mid ?? '',
        levelLow: c.level_low ?? '',
      }))
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('이 채점기준을 삭제할까요?')) return;
    setSavingId(id);
    try {
      await api(`/api/eval/rubrics/${id}`, { method: 'DELETE' });
      const removed = rubrics.filter((r) => r.id !== id);
      setRubrics(removed);
      onRubricsChange?.(removed);
      setMsg('삭제되었습니다.'); clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setSavingId(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Notice type="success" message={msg} />
      <Notice type="error" message={error} />

      {/* 등록 폼 */}
      {showForm ? (
        <form onSubmit={onSave} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: 16 }}>{editingId ? '채점기준 수정' : '새 채점기준 등록'}</h4>
            <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 13 }} onClick={() => { setShowForm(false); resetForm(); setEditingId(''); }}>취소</button>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>기준명 <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                placeholder="예: 발표하기" required maxLength={100}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>도달목표</label>
                <textarea value={form.goal} onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))} placeholder="학생이 달성해야 할 목표" maxLength={200} style={{ minHeight: 60, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>수행과제</label>
                <textarea value={form.task} onChange={(e) => setForm((prev) => ({ ...prev, task: e.target.value }))} placeholder="구체적인 평가 과제" maxLength={200} style={{ minHeight: 60, resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* 평가기준 카드들 */}
          {form.criteria.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#475569' }}>평가기준</p>
              {form.criteria.map((c, idx) => (
                <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '2px 10px' }}>{idx + 1}</span>
                    <input
                      value={c.title}
                      onChange={(e) => updateCriterion(idx, 'title', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="평가기준명 (예: 목소리 크기)"
                      maxLength={100}
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button type="button" onClick={() => removeCriterion(idx)} style={{ background: 'none', border: 'none', width: 'auto', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: '0 4px', flexShrink: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#dcfce7', borderRadius: 8, padding: 8 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>잘함</p>
                      <textarea
                        value={c.levelHigh}
                        onChange={(e) => updateCriterion(idx, 'levelHigh', e.target.value)}
                        placeholder='"잘함" 수준 설명'
                        maxLength={200}
                        style={{ minHeight: 52, resize: 'vertical', fontSize: 12, background: '#fff' }}
                      />
                    </div>
                    <div style={{ background: '#fef9c3', borderRadius: 8, padding: 8 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#a16207' }}>보통</p>
                      <textarea
                        value={c.levelMid}
                        onChange={(e) => updateCriterion(idx, 'levelMid', e.target.value)}
                        placeholder='"보통" 수준 설명'
                        maxLength={200}
                        style={{ minHeight: 52, resize: 'vertical', fontSize: 12, background: '#fff' }}
                      />
                    </div>
                    <div style={{ background: '#fee2e2', borderRadius: 8, padding: 8 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>노력</p>
                      <textarea
                        value={c.levelLow}
                        onChange={(e) => updateCriterion(idx, 'levelLow', e.target.value)}
                        placeholder='"노력" 수준 설명'
                        maxLength={200}
                        style={{ minHeight: 52, resize: 'vertical', fontSize: 12, background: '#fff' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={addCriterion} style={{ background: 'none', border: '1.5px dashed #cbd5e1', borderRadius: 8, padding: '10px 0', fontSize: 13, color: '#64748b', cursor: 'pointer', width: '100%' }}>
            + 평가기준 추가
          </button>

          <button type="submit" className="ghost" style={{ width: '100%' }} disabled={loading}>
            {loading ? '저장 중...' : editingId ? '수정 완료' : '채점기준 등록'}
          </button>
        </form>
      ) : (
        <button type="button" className="ghost" style={{ width: '100%', padding: '10px 0' }} onClick={() => { resetForm(); setEditingId(''); setShowForm(true); }}>
          + 새 채점기준 등록
        </button>
      )}

      {/* 채점기준 목록 */}
      {rubrics.length === 0 ? (
        <EmptyState title="등록된 채점기준이 없습니다" description="위 버튼을 눌러 채점기준을 등록하세요." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rubrics.map((r) => (
            <article key={r.id} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15 }}>{r.title}</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {r.goal && <span style={{ fontSize: 12, color: '#64748b' }}><strong>목표</strong> {r.goal}</span>}
                    {r.task && <span style={{ fontSize: 12, color: '#64748b' }}><strong>과제</strong> {r.task}</span>}
                  </div>
                  {r.criteria.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {r.criteria.map((c, i) => (
                        <span key={i} style={{ fontSize: 12, background: '#f0f9ff', color: '#0369a1', borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}>{c.title}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => onEdit(r)}>수정</button>
                  <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => onDelete(r.id)} disabled={savingId === r.id}>삭제</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub: 이미지 업로드 & 라이트박스 ──────────────────────────────
function ImageUploader({ reportId, images, onUploaded }: {
  reportId: string;
  images: { id: string; sort_order: number }[];
  onUploaded: (img: { id: string; sort_order: number }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchThumb = async (imageId: string) => {
    try {
      const d = await api<{ url: string }>(`/api/eval/reports/${reportId}/images/${imageId}/view`);
      setThumbUrls((prev) => ({ ...prev, [imageId]: d.url }));
      return d.url;
    } catch { return null; }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/eval/reports/${reportId}/images`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUploaded(json.image);
      fetchThumb(json.image.id);
    } catch (err) { setError((err as Error).message); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const openLightbox = async (imageId: string) => {
    const url = thumbUrls[imageId] ?? await fetchThumb(imageId);
    if (url) setLightboxUrl(url);
  };

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div style={{ marginTop: 12 }}>
      <p className="hint" style={{ margin: '0 0 8px', fontWeight: 600 }}>평가 자료 이미지 ({images.length}/5)</p>
      {error && <Notice type="error" message={error} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        {sorted.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => openLightbox(img.id)}
            style={{ width: 72, height: 72, padding: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', flexShrink: 0, cursor: 'zoom-in' }}
          >
            {thumbUrls[img.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrls[img.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} draggable={false} onContextMenu={(e) => e.preventDefault()} />
            ) : (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>로딩중</span>
            )}
          </button>
        ))}
        {images.length < 5 && (
          <>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFile} />
            <button
              type="button"
              className="outline"
              style={{ width: 72, height: 72, fontSize: 22, color: '#9ca3af', flexShrink: 0 }}
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '...' : '+'}
            </button>
          </>
        )}
      </div>
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'grid', placeItems: 'center', cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="평가 자료" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} onContextMenu={(e) => e.preventDefault()} draggable={false} />
        </div>
      )}
    </div>
  );
}

// ── Sub: 링크 추가 ───────────────────────────────────────────────
function LinkAdder({ reportId, links, onAdded, onDeleted }: {
  reportId: string;
  links: ReportLink[];
  onAdded: (link: ReportLink) => void;
  onDeleted: (linkId: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const onAdd = async () => {
    if (!url.trim()) return;
    setAdding(true); setError('');
    try {
      const d = await api<{ link: ReportLink }>(`/api/eval/reports/${reportId}/links`, {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), label: label.trim() || null }),
      });
      onAdded(d.link);
      setUrl(''); setLabel('');
    } catch (err) { setError((err as Error).message); }
    finally { setAdding(false); }
  };

  const onDelete = async (linkId: string) => {
    try {
      await api(`/api/eval/reports/${reportId}/links/${linkId}`, { method: 'DELETE' });
      onDeleted(linkId);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <p className="hint" style={{ margin: '0 0 8px', fontWeight: 600 }}>웹 링크 ({links.length}/10)</p>
      {links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {[...links].sort((a, b) => a.sort_order - b.sort_order).map((lk) => (
            <div key={lk.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f9ff', borderRadius: 6, padding: '5px 10px' }}>
              <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lk.label ? <><strong>{lk.label}</strong> — </> : ''}{lk.url}
              </span>
              <button type="button" className="outline" style={{ width: 'auto', padding: '2px 8px', fontSize: 11, flexShrink: 0 }} onClick={() => onDelete(lk.id)}>삭제</button>
            </div>
          ))}
        </div>
      )}
      {links.length < 10 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="링크 이름 (선택)" maxLength={100} style={{ fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." maxLength={2000} style={{ fontSize: 13, flex: 1 }} />
            <button type="button" className="ghost" style={{ width: 'auto', padding: '0 14px', fontSize: 13, flexShrink: 0 }} onClick={onAdd} disabled={adding || !url.trim()}>추가</button>
          </div>
          {error && <Notice type="error" message={error} />}
        </div>
      )}
    </div>
  );
}

// ── Sub: 보고서 상세 모달 ────────────────────────────────────────
function ReportDetailModal({ report, onClose }: { report: ReportDetail; onClose: () => void }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState('');
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<ReportLink[]>(report.eval_report_links ?? []);

  useEffect(() => {
    report.eval_report_images.forEach(async (img) => {
      try {
        const d = await api<{ url: string }>(`/api/eval/reports/${report.id}/images/${img.id}/view`);
        setThumbUrls((prev) => ({ ...prev, [img.id]: d.url }));
      } catch { /* ignore */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  const openImage = (imageId: string) => {
    const url = thumbUrls[imageId];
    if (url) setLightboxUrl(url);
  };

  const sortedItems = [...report.eval_report_items].sort((a, b) => a.sort_order - b.sort_order);
  const sortedImages = [...report.eval_report_images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
      >
        <div style={{ width: 'min(620px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>

          {/* 헤더 */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                {report.students?.name} · {new Date(report.created_at).toLocaleDateString('ko-KR')}
              </p>
              <h3 style={{ margin: 0, fontSize: 17 }}>{report.title}</h3>
            </div>
            <button type="button" className="outline" style={{ width: 'auto', flexShrink: 0 }} onClick={onClose}>닫기</button>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* 평가 결과 */}
            <section>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', letterSpacing: '0.02em' }}>평가 결과</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const levelDesc = item.grade === 'high' ? item.rubric_level_high_snapshot
                    : item.grade === 'mid' ? item.rubric_level_mid_snapshot
                    : item.rubric_level_low_snapshot;
                  return (
                    <div key={item.id} style={{ border: `1.5px solid ${GRADE_COLOR[item.grade]}33`, borderRadius: 12, overflow: 'hidden' }}>
                      {/* 항목 헤더 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: GRADE_COLOR[item.grade] + '0d', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
                          {item.rubric_title_snapshot}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: GRADE_COLOR[item.grade], background: GRADE_COLOR[item.grade] + '1a', padding: '2px 10px', borderRadius: 20 }}>
                            {GRADE_LABEL[item.grade]}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(isExpanded ? '' : item.id)}
                            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#64748b', cursor: 'pointer' }}
                          >
                            채점기준 {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>
                      {/* 피드백 */}
                      {item.teacher_feedback && (
                        <div style={{ padding: '8px 14px', background: '#fff', borderTop: `1px solid ${GRADE_COLOR[item.grade]}1a` }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{item.teacher_feedback}</p>
                        </div>
                      )}
                      {/* 채점기준 상세 */}
                      {isExpanded && (
                        <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {item.rubric_goal_snapshot && (
                            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}><strong>도달목표</strong> {item.rubric_goal_snapshot}</p>
                          )}
                          {item.rubric_task_snapshot && (
                            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}><strong>수행과제</strong> {item.rubric_task_snapshot}</p>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
                            {([['rubric_level_high_snapshot', '잘함', '#16a34a', '#dcfce7'], ['rubric_level_mid_snapshot', '보통', '#a16207', '#fef9c3'], ['rubric_level_low_snapshot', '노력', '#dc2626', '#fee2e2']] as const).map(([field, label, color, bg]) =>
                              item[field] ? (
                                <div key={field} style={{ background: bg, borderRadius: 8, padding: '6px 8px', border: item.grade === (field === 'rubric_level_high_snapshot' ? 'high' : field === 'rubric_level_mid_snapshot' ? 'mid' : 'low') ? `2px solid ${color}` : '1.5px solid transparent' }}>
                                  <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color }}>{label}</p>
                                  <p style={{ margin: 0, fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{item[field]}</p>
                                </div>
                              ) : null
                            )}
                          </div>
                          {levelDesc && (
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: GRADE_COLOR[item.grade], fontWeight: 600 }}>
                              → 이 학생의 수준: &quot;{levelDesc}&quot;
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 평가 자료 이미지 */}
            {sortedImages.length > 0 && (
              <section>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>평가 자료</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sortedImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => openImage(img.id)}
                      disabled={!thumbUrls[img.id]}
                      style={{ width: 80, height: 80, padding: 0, border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#f8fafc', flexShrink: 0, cursor: thumbUrls[img.id] ? 'zoom-in' : 'default' }}
                    >
                      {thumbUrls[img.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrls[img.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} draggable={false} onContextMenu={(e) => e.preventDefault()} />
                      ) : (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>로딩중</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 웹 링크 — 기존 보고서에도 추가/삭제 가능 */}
            <section>
              <LinkAdder
                reportId={report.id}
                links={links}
                onAdded={(lk) => setLinks((prev) => [...prev, lk])}
                onDeleted={(id) => setLinks((prev) => prev.filter((l) => l.id !== id))}
              />
            </section>

            {/* 학생 성찰일기 */}
            <section style={{ background: '#f8fbff', border: '1.5px solid #dbeafe', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>✏️ 학생 성찰일기</p>
              {report.eval_reflections?.[0] ? (
                <>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#1e293b' }}>{report.eval_reflections[0].content}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>{new Date(report.eval_reflections[0].created_at).toLocaleDateString('ko-KR')} 작성</p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>아직 작성하지 않았습니다.</p>
              )}
            </section>

            {/* 부모님 응원 */}
            <section style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>💌 부모님 응원</p>
              {report.eval_parent_comments?.[0] ? (
                <>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#1e293b' }}>{report.eval_parent_comments[0].content}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>{new Date(report.eval_parent_comments[0].created_at).toLocaleDateString('ko-KR')} 작성</p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>아직 작성하지 않았습니다.</p>
              )}
            </section>

          </div>
        </div>
      </div>

      {/* 라이트박스 */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'grid', placeItems: 'center', cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="평가 자료" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} onContextMenu={(e) => e.preventDefault()} draggable={false} />
        </div>
      )}
    </>
  );
}

// ── Main: EvalDashboard ───────────────────────────────────────────
export default function EvalDashboard({ classId, students }: { classId: string; students: StudentItem[] }) {
  const [subTab, setSubTab] = useState<'reports' | 'rubrics'>('reports');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [detailReport, setDetailReport] = useState<ReportDetail | null>(null);
  const [showRubricSelect, setShowRubricSelect] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ id: string; sort_order: number }[]>([]);
  const [uploadedLinks, setUploadedLinks] = useState<ReportLink[]>([]);
  const [createdReportId, setCreatedReportId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [pinnedRubric, setPinnedRubric] = useState<Rubric | null>(null);
  const [showPinPanel, setShowPinPanel] = useState(false);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const clear = () => window.setTimeout(() => { setMsg(''); setError(''); }, 2500);

  // 채점기준 초기 로드
  useEffect(() => {
    api<{ rubrics: Rubric[] }>('/api/eval/rubrics').then((d) => setRubrics(d.rubrics)).catch(() => {});
  }, []);

  // 학생 선택 시 보고서 목록 로드
  useEffect(() => {
    if (!selectedStudentId) { setReports([]); return; }
    setReportsLoading(true);
    api<{ reports: ReportSummary[] }>(`/api/eval/reports/student/${selectedStudentId}`)
      .then((d) => setReports(d.reports))
      .catch(() => setReports([]))
      .finally(() => setReportsLoading(false));
  }, [selectedStudentId]);

  // 채점기준 선택 화면 열기
  const openCreateForm = async () => {
    setCreatedReportId('');
    setUploadedImages([]);
    setUploadedLinks([]);
    if (pinnedRubric) {
      confirmRubricSelectionWith(pinnedRubric);
    } else {
      if (!rubrics.length) {
        const d = await api<{ rubrics: Rubric[] }>('/api/eval/rubrics');
        setRubrics(d.rubrics);
      }
      setShowCreateForm(false);
      setShowRubricSelect(true);
    }
  };

  // 채점기준 선택 완료 → 평가 입력 폼으로
  const confirmRubricSelectionWith = (r: Rubric) => {
    const items: DraftItem[] = r.criteria.length > 0
      ? r.criteria.map((c, i) => ({
          rubricId: r.id,
          rubricTitleSnapshot: r.title,
          rubricGoalSnapshot: r.goal,
          rubricTaskSnapshot: r.task,
          criterionTitleSnapshot: c.title,
          rubricLevelHighSnapshot: c.level_high,
          rubricLevelMidSnapshot: c.level_mid,
          rubricLevelLowSnapshot: c.level_low,
          grade: 'mid' as const,
          teacherFeedback: '',
          sortOrder: i,
        }))
      : [{
          rubricId: r.id,
          rubricTitleSnapshot: r.title,
          rubricGoalSnapshot: r.goal,
          rubricTaskSnapshot: r.task,
          criterionTitleSnapshot: null,
          rubricLevelHighSnapshot: null,
          rubricLevelMidSnapshot: null,
          rubricLevelLowSnapshot: null,
          grade: 'mid' as const,
          teacherFeedback: '',
          sortOrder: 0,
        }];
    setDraftItems(items);
    setShowRubricSelect(false);
    setShowCreateForm(true);
  };

  const onSaveReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setCreateLoading(true);
    setError('');
    try {
      const autoTitle = draftItems[0]?.rubricTitleSnapshot ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' 평가';
      const d = await api<{ report: { id: string; title: string; created_at: string } }>('/api/eval/reports', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          title: autoTitle,
          items: draftItems.map((item) => ({
            rubricId: item.rubricId,
            rubricTitleSnapshot: item.rubricTitleSnapshot,
            rubricGoalSnapshot: item.rubricGoalSnapshot,
            rubricTaskSnapshot: item.rubricTaskSnapshot,
            rubricLevelHighSnapshot: item.rubricLevelHighSnapshot,
            rubricLevelMidSnapshot: item.rubricLevelMidSnapshot,
            rubricLevelLowSnapshot: item.rubricLevelLowSnapshot,
            criterionTitleSnapshot: item.criterionTitleSnapshot,
            grade: item.grade,
            teacherFeedback: item.teacherFeedback || null,
            sortOrder: item.sortOrder
          }))
        })
      });
      setCreatedReportId(d.report.id);
      setReports((prev) => [{ id: d.report.id, title: d.report.title, created_at: d.report.created_at, eval_report_items: [], eval_report_images: [], eval_report_links: [] }, ...prev]);
      setMsg('평가보고서가 저장되었습니다. 이미지를 추가할 수 있습니다.');
      clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setCreateLoading(false); }
  };

  const onDeleteReport = async (reportId: string) => {
    if (!window.confirm('이 평가보고서를 삭제할까요?')) return;
    setDeletingId(reportId);
    try {
      await api(`/api/eval/reports/${reportId}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setMsg('삭제되었습니다.'); clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setDeletingId(''); }
  };

  const openDetail = async (reportId: string) => {
    try {
      const d = await api<{ report: ReportDetail }>(`/api/eval/reports/${reportId}`, { cache: 'no-store' });
      setDetailReport(d.report);
    } catch { /* ignore */ }
  };

  if (!classId) return <EmptyState title="학급을 선택하세요" description="평가피드백은 학급 선택 후 확인할 수 있습니다." />;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 탭 헤더 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {([['reports', '평가 작성'], ['rubrics', '채점기준 관리']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontSize: 14, fontWeight: 600,
              color: subTab === key ? '#2563eb' : '#94a3b8',
              borderBottom: subTab === key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -2,
            }}
          >{label}</button>
        ))}
      </div>

      <Notice type="success" message={msg} />
      <Notice type="error" message={error} />

      {/* ── 채점기준 관리 탭 ── */}
      {subTab === 'rubrics' && <RubricManager onRubricsChange={(updated) => setRubrics(updated)} />}

      {/* ── 평가 작성 탭 ── */}
      {subTab === 'reports' && (
        <>
        {/* 채점기준 고정 패널 */}
        <div style={{ background: pinnedRubric ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${pinnedRubric ? '#86efac' : '#e2e8f0'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          {pinnedRubric ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>채점기준 고정됨 — 학생 클릭 시 바로 평가 폼이 열립니다</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{pinnedRubric.title}</p>
                {pinnedRubric.criteria.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {pinnedRubric.criteria.map((c, i) => (
                      <span key={i} style={{ fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '1px 8px' }}>{c.title}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" className="outline" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setShowPinPanel((v) => !v)}>변경</button>
                <button type="button" className="outline" style={{ width: 'auto', padding: '4px 10px', fontSize: 12, color: '#94a3b8' }}
                  onClick={() => { setPinnedRubric(null); setShowPinPanel(false); }}>해제</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>채점기준을 고정하면 학생 클릭 시 바로 평가할 수 있습니다.</p>
                <button type="button" className="ghost" style={{ width: 'auto', padding: '4px 14px', fontSize: 13 }}
                  onClick={() => setShowPinPanel((v) => !v)}>채점기준 선택</button>
              </div>
            </div>
          )}
          {showPinPanel && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              {rubrics.length === 0 ? (
                <p className="hint" style={{ margin: 0, fontSize: 13 }}>채점기준 탭에서 먼저 기준을 등록해주세요.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {rubrics.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setPinnedRubric(r);
                        setShowPinPanel(false);
                        if (showCreateForm) confirmRubricSelectionWith(r);
                      }}
                      style={{
                        background: pinnedRubric?.id === r.id ? '#dcfce7' : '#fff',
                        border: `1.5px solid ${pinnedRubric?.id === r.id ? '#16a34a' : '#cbd5e1'}`,
                        borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
                        fontWeight: pinnedRubric?.id === r.id ? 700 : 500,
                        color: pinnedRubric?.id === r.id ? '#15803d' : '#374151',
                      }}
                    >{r.title}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr', gap: 20, alignItems: 'start' }}>

          {/* 학생 목록 */}
          <div style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: 2 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#475569' }}>학생 선택</p>
            {students.length === 0 ? (
              <p className="hint" style={{ fontSize: 12 }}>등록된 학생이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setCreatedReportId('');
                      setUploadedImages([]);
                      setUploadedLinks([]);
                      if (pinnedRubric) {
                        confirmRubricSelectionWith(pinnedRubric);
                      } else {
                        setShowCreateForm(false);
                        setShowRubricSelect(false);
                      }
                    }}
                    style={{
                      background: selectedStudentId === s.id ? '#eff6ff' : '#fff',
                      border: `1.5px solid ${selectedStudentId === s.id ? '#3b82f6' : '#e2e8f0'}`,
                      borderRadius: 8, padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                      color: selectedStudentId === s.id ? '#1d4ed8' : '#374151',
                      fontWeight: selectedStudentId === s.id ? 700 : 400, fontSize: 13,
                    }}
                  >
                    {s.student_number}번 {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽 영역 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            {!selectedStudentId ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <p style={{ margin: 0, fontSize: 14 }}>왼쪽에서 학생을 선택하세요</p>
              </div>
            ) : (
              <>
                {/* 학생명 + 새 평가 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{selectedStudent?.name} 학생</p>
                  {!showCreateForm && !showRubricSelect && (
                    <button type="button" className="ghost" style={{ width: 'auto' }} onClick={openCreateForm}>+ 새 평가 작성</button>
                  )}
                </div>

                {/* STEP 1: 채점기준 선택 */}
                {showRubricSelect && (
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>채점기준을 선택하세요</p>
                      <button type="button" onClick={() => setShowRubricSelect(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>×</button>
                    </div>
                    {rubrics.length === 0 ? (
                      <p className="hint" style={{ margin: 0, fontSize: 13 }}>채점기준 탭에서 먼저 기준을 등록해주세요.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {rubrics.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => confirmRubricSelectionWith(r)}
                            style={{
                              background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 8,
                              padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#374151',
                            }}
                          >
                            {r.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: 평가 입력 폼 */}
                {showCreateForm && (
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    {/* 채점기준 헤더 + 변경 버튼 */}
                    {draftItems[0] && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
                        <div>
                          <p style={{ margin: '0 0 2px', fontSize: 12, color: '#64748b', fontWeight: 500 }}>채점기준</p>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{draftItems[0].rubricTitleSnapshot}</p>
                          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            {draftItems[0].rubricGoalSnapshot && <span style={{ fontSize: 12, color: '#64748b' }}><strong>목표</strong> {draftItems[0].rubricGoalSnapshot}</span>}
                            {draftItems[0].rubricTaskSnapshot && <span style={{ fontSize: 12, color: '#64748b' }}><strong>과제</strong> {draftItems[0].rubricTaskSnapshot}</span>}
                          </div>
                        </div>
                        <button type="button" className="outline" style={{ width: 'auto', padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
                          onClick={() => { setShowCreateForm(false); setShowRubricSelect(true); }}>변경</button>
                      </div>
                    )}

                    <form onSubmit={onSaveReport} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {draftItems.map((item, idx) => (
                        <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                          {item.criterionTitleSnapshot && (
                            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>{item.criterionTitleSnapshot}</p>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                            {(['high', 'mid', 'low'] as const).map((g) => {
                              const desc = g === 'high' ? item.rubricLevelHighSnapshot : g === 'mid' ? item.rubricLevelMidSnapshot : item.rubricLevelLowSnapshot;
                              const selected = item.grade === g;
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => setDraftItems((prev) => prev.map((d, i) => i === idx ? { ...d, grade: g } : d))}
                                  style={{
                                    padding: '8px 6px', border: `2px solid ${GRADE_COLOR[g]}`,
                                    borderRadius: 8, background: selected ? GRADE_COLOR[g] + '18' : '#fff',
                                    cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3,
                                    outline: selected ? `2px solid ${GRADE_COLOR[g]}` : 'none',
                                  }}
                                >
                                  <span style={{ fontWeight: 700, fontSize: 13, color: GRADE_COLOR[g] }}>{GRADE_LABEL[g]}</span>
                                  {desc && <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4, wordBreak: 'keep-all' }}>{desc}</span>}
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            placeholder="피드백 입력 (선택, 200자)"
                            maxLength={200}
                            value={item.teacherFeedback}
                            onChange={(e) => setDraftItems((prev) => prev.map((d, i) => i === idx ? { ...d, teacherFeedback: e.target.value } : d))}
                            style={{ minHeight: 48, resize: 'vertical' }}
                          />
                        </div>
                      ))}

                      {!createdReportId ? (
                        <button type="submit" className="ghost" style={{ width: '100%', marginTop: 4 }} disabled={createLoading}>
                          {createLoading ? '저장 중...' : '평가 저장'}
                        </button>
                      ) : (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginTop: 4 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#16a34a' }}>평가가 저장되었습니다. 자료를 추가할 수 있습니다.</p>
                          <ImageUploader reportId={createdReportId} images={uploadedImages} onUploaded={(img) => setUploadedImages((prev) => [...prev, img])} />
                          <LinkAdder reportId={createdReportId} links={uploadedLinks} onAdded={(lk) => setUploadedLinks((prev) => [...prev, lk])} onDeleted={(id) => setUploadedLinks((prev) => prev.filter((l) => l.id !== id))} />
                          <button type="button" className="outline" style={{ width: '100%', marginTop: 12 }} onClick={() => { setShowCreateForm(false); setShowRubricSelect(false); setCreatedReportId(''); }}>완료</button>
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {/* 평가 목록 */}
                {!showCreateForm && !showRubricSelect && (
                  reportsLoading ? (
                    <p className="hint">불러오는 중...</p>
                  ) : reports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                      <p style={{ margin: 0, fontSize: 14 }}>아직 작성된 평가가 없습니다</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {reports.map((r) => {
                        const grades = [...r.eval_report_items].sort((a, b) => a.sort_order - b.sort_order);
                        return (
                          <article key={r.id} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>{r.title}</p>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                                {grades.map((item, i) => (
                                  <span key={i} style={{ fontSize: 11, fontWeight: 700, color: GRADE_COLOR[item.grade as 'high' | 'mid' | 'low'], background: GRADE_COLOR[item.grade as 'high' | 'mid' | 'low'] + '18', borderRadius: 20, padding: '1px 8px' }}>
                                    {GRADE_LABEL[item.grade as 'high' | 'mid' | 'low']}
                                  </span>
                                ))}
                                {r.eval_report_images.length > 0 && <span style={{ fontSize: 11, color: '#64748b' }}>이미지 {r.eval_report_images.length}장</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button type="button" className="ghost" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => openDetail(r.id)}>상세</button>
                              <button type="button" className="outline" style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => onDeleteReport(r.id)} disabled={deletingId === r.id}>삭제</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
        </>
      )}

      {detailReport && <ReportDetailModal report={detailReport} onClose={() => setDetailReport(null)} />}
    </section>
  );
}
