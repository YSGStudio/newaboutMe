'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';

// ── Types ──────────────────────────────────────────────────────────
type Rubric = {
  id: string;
  title: string;
  goal: string | null;
  task: string | null;
  level_high: string | null;
  level_mid: string | null;
  level_low: string | null;
  sort_order: number;
};

type ReportSummary = {
  id: string;
  title: string;
  created_at: string;
  eval_report_items: { id: string; grade: string; sort_order: number }[];
  eval_report_images: { id: string; sort_order: number }[];
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
  rubricLevelHighSnapshot: string | null;
  rubricLevelMidSnapshot: string | null;
  rubricLevelLowSnapshot: string | null;
  grade: 'high' | 'mid' | 'low';
  teacherFeedback: string;
  sortOrder: number;
};

const GRADE_LABEL: Record<'high' | 'mid' | 'low', string> = { high: '상', mid: '중', low: '하' };
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
function RubricManager() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', goal: '', task: '', levelHigh: '', levelMid: '', levelLow: '' });
  const [savingId, setSavingId] = useState('');

  const clear = () => window.setTimeout(() => { setMsg(''); setError(''); }, 2500);

  useEffect(() => {
    api<{ rubrics: Rubric[] }>('/api/eval/rubrics').then((d) => setRubrics(d.rubrics)).catch(() => {});
  }, []);

  const resetForm = () => setForm({ title: '', goal: '', task: '', levelHigh: '', levelMid: '', levelLow: '' });

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingId) {
        const d = await api<{ rubric: Rubric }>(`/api/eval/rubrics/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: form.title, goal: form.goal || null, task: form.task || null, levelHigh: form.levelHigh || null, levelMid: form.levelMid || null, levelLow: form.levelLow || null })
        });
        setRubrics((prev) => prev.map((r) => (r.id === editingId ? d.rubric : r)));
        setMsg('수정되었습니다.');
      } else {
        const d = await api<{ rubric: Rubric }>('/api/eval/rubrics', {
          method: 'POST',
          body: JSON.stringify({ title: form.title, goal: form.goal || null, task: form.task || null, levelHigh: form.levelHigh || null, levelMid: form.levelMid || null, levelLow: form.levelLow || null })
        });
        setRubrics((prev) => [...prev, d.rubric]);
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
    setForm({ title: r.title, goal: r.goal ?? '', task: r.task ?? '', levelHigh: r.level_high ?? '', levelMid: r.level_mid ?? '', levelLow: r.level_low ?? '' });
    setEditingId(r.id);
    setShowForm(true);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('이 채점기준을 삭제할까요?')) return;
    setSavingId(id);
    try {
      await api(`/api/eval/rubrics/${id}`, { method: 'DELETE' });
      setRubrics((prev) => prev.filter((r) => r.id !== id));
      setMsg('삭제되었습니다.'); clear();
    } catch (err) { setError((err as Error).message); clear(); }
    finally { setSavingId(''); }
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row space-between">
        <h3 style={{ margin: 0 }}>채점기준 목록</h3>
        <button type="button" className="ghost" style={{ width: 'auto' }} onClick={() => { resetForm(); setEditingId(''); setShowForm((v) => !v); }}>
          {showForm ? '닫기' : '+ 기준 추가'}
        </button>
      </div>
      <Notice type="success" message={msg} />
      <Notice type="error" message={error} />

      {showForm && (
        <form className="card grid" style={{ padding: 16, gap: 10 }} onSubmit={onSave}>
          <h4 style={{ margin: 0 }}>{editingId ? '채점기준 수정' : '새 채점기준 등록'}</h4>
          {[
            { key: 'title', label: '기준명', required: true, placeholder: '예: 발표 태도' },
            { key: 'goal', label: '도달목표', placeholder: '학생이 달성해야 할 목표를 입력하세요' },
            { key: 'task', label: '수행과제', placeholder: '평가에 사용되는 구체적인 과제를 입력하세요' },
            { key: 'levelHigh', label: '상', placeholder: '"상" 등급 수행 수준을 입력하세요' },
            { key: 'levelMid', label: '중', placeholder: '"중" 등급 수행 수준을 입력하세요' },
            { key: 'levelLow', label: '하', placeholder: '"하" 등급 수행 수준을 입력하세요' }
          ].map(({ key, label, required, placeholder }) => (
            <div key={key}>
              <label>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
              <textarea
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                required={required}
                maxLength={key === 'title' ? 100 : 200}
                style={{ minHeight: 56, resize: 'vertical' }}
              />
            </div>
          ))}
          <div className="row">
            <button type="submit" className="ghost" style={{ flex: 1 }} disabled={loading}>
              {loading ? '저장 중...' : editingId ? '수정 저장' : '등록'}
            </button>
            <button type="button" className="outline" style={{ flex: 1 }} onClick={() => { setShowForm(false); resetForm(); setEditingId(''); }}>취소</button>
          </div>
        </form>
      )}

      {rubrics.length === 0 ? (
        <EmptyState title="등록된 채점기준이 없습니다" description="+ 기준 추가 버튼을 눌러 채점기준을 등록하세요." />
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {rubrics.map((r) => (
            <article key={r.id} className="card" style={{ padding: 12 }}>
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <strong>{r.title}</strong>
                <div className="row" style={{ gap: 4 }}>
                  <button type="button" className="outline" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => onEdit(r)}>수정</button>
                  <button type="button" className="outline" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => onDelete(r.id)} disabled={savingId === r.id}>삭제</button>
                </div>
              </div>
              {r.goal && <p className="hint" style={{ margin: '2px 0' }}><strong>도달목표:</strong> {r.goal}</p>}
              {r.task && <p className="hint" style={{ margin: '2px 0' }}><strong>수행과제:</strong> {r.task}</p>}
              <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {r.level_high && <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>상: {r.level_high}</span>}
                {r.level_mid && <span className="badge" style={{ background: '#fef9c3', color: '#a16207' }}>중: {r.level_mid}</span>}
                {r.level_low && <span className="badge" style={{ background: '#fee2e2', color: '#dc2626' }}>하: {r.level_low}</span>}
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    } catch (err) { setError((err as Error).message); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <p className="hint" style={{ margin: '0 0 6px', fontWeight: 600 }}>평가 자료 이미지 ({images.length}/5)</p>
      {error && <Notice type="error" message={error} />}
      {images.length < 5 && (
        <>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFile} />
          <button type="button" className="outline" style={{ width: 'auto', fontSize: 13 }} onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? '업로드 중...' : '이미지 추가'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Sub: 보고서 상세 모달 ────────────────────────────────────────
function ReportDetailModal({ report, onClose }: { report: ReportDetail; onClose: () => void }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loadingImageId, setLoadingImageId] = useState('');
  const [expandedItemId, setExpandedItemId] = useState('');

  const openImage = async (imageId: string) => {
    setLoadingImageId(imageId);
    try {
      const d = await api<{ url: string }>(`/api/eval/reports/${report.id}/images/${imageId}/view`);
      setLightboxUrl(d.url);
    } catch { /* ignore */ }
    finally { setLoadingImageId(''); }
  };

  const sortedItems = [...report.eval_report_items].sort((a, b) => a.sort_order - b.sort_order);
  const sortedImages = [...report.eval_report_images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
      >
        <div className="card" style={{ width: 'min(860px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
          <div className="row space-between" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>{report.title}</h3>
              <p className="hint" style={{ margin: '4px 0 0' }}>{new Date(report.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
            <button type="button" className="outline" style={{ width: 'auto' }} onClick={onClose}>닫기</button>
          </div>

          {/* 채점기준별 평가 */}
          <div className="grid" style={{ gap: 10 }}>
            {sortedItems.map((item) => {
              const isExpanded = expandedItemId === item.id;
              return (
                <article key={item.id} className="card" style={{ padding: 12 }}>
                  <div className="row space-between" style={{ marginBottom: 6 }}>
                    <strong>{item.rubric_title_snapshot}</strong>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="badge" style={{ background: GRADE_COLOR[item.grade] + '22', color: GRADE_COLOR[item.grade], fontWeight: 700 }}>
                        {GRADE_LABEL[item.grade]}
                      </span>
                      <button type="button" className="outline" style={{ width: 'auto', padding: '3px 8px', fontSize: 12 }} onClick={() => setExpandedItemId(isExpanded ? '' : item.id)}>
                        기준 {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>
                  {item.teacher_feedback && <p style={{ margin: '4px 0 0', fontSize: 14 }}>{item.teacher_feedback}</p>}
                  {isExpanded && (
                    <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                      {item.rubric_goal_snapshot && <p className="hint" style={{ margin: '2px 0' }}><strong>도달목표:</strong> {item.rubric_goal_snapshot}</p>}
                      {item.rubric_task_snapshot && <p className="hint" style={{ margin: '2px 0' }}><strong>수행과제:</strong> {item.rubric_task_snapshot}</p>}
                      {item.rubric_level_high_snapshot && <p className="hint" style={{ margin: '2px 0', color: '#16a34a' }}><strong>상:</strong> {item.rubric_level_high_snapshot}</p>}
                      {item.rubric_level_mid_snapshot && <p className="hint" style={{ margin: '2px 0', color: '#a16207' }}><strong>중:</strong> {item.rubric_level_mid_snapshot}</p>}
                      {item.rubric_level_low_snapshot && <p className="hint" style={{ margin: '2px 0', color: '#dc2626' }}><strong>하:</strong> {item.rubric_level_low_snapshot}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* 평가 자료 이미지 */}
          {sortedImages.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="hint" style={{ margin: '0 0 8px', fontWeight: 600 }}>평가 자료 이미지</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sortedImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    className="outline"
                    style={{ width: 80, height: 80, fontSize: 12, padding: 4 }}
                    onClick={() => openImage(img.id)}
                    disabled={loadingImageId === img.id}
                  >
                    {loadingImageId === img.id ? '로딩...' : `이미지 ${img.sort_order + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 성찰일기 */}
          <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
            <p className="hint" style={{ margin: '0 0 6px', fontWeight: 600 }}>학생 성찰일기</p>
            {report.eval_reflections?.[0] ? (
              <div className="card" style={{ padding: 12, background: '#f8fbff' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{report.eval_reflections[0].content}</p>
                <p className="hint" style={{ margin: '6px 0 0', fontSize: 12 }}>{new Date(report.eval_reflections[0].created_at).toLocaleDateString('ko-KR')}</p>
              </div>
            ) : (
              <p className="hint">아직 성찰일기를 작성하지 않았습니다.</p>
            )}
          </div>

          {/* 부모님 응원 */}
          <div style={{ marginTop: 14, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
            <p className="hint" style={{ margin: '0 0 6px', fontWeight: 600 }}>부모님 응원</p>
            {report.eval_parent_comments?.[0] ? (
              <div className="card" style={{ padding: 12, background: '#fffbeb' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{report.eval_parent_comments[0].content}</p>
                <p className="hint" style={{ margin: '6px 0 0', fontSize: 12 }}>{new Date(report.eval_parent_comments[0].created_at).toLocaleDateString('ko-KR')}</p>
              </div>
            ) : (
              <p className="hint">아직 부모님 응원이 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* 라이트박스 */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'grid', placeItems: 'center', cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="평가 자료"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
          />
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
  const [selectedRubricIds, setSelectedRubricIds] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ id: string; sort_order: number }[]>([]);
  const [createdReportId, setCreatedReportId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const clear = () => window.setTimeout(() => { setMsg(''); setError(''); }, 2500);

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
    const d = await api<{ rubrics: Rubric[] }>('/api/eval/rubrics');
    setRubrics(d.rubrics);
    setSelectedRubricIds(new Set(d.rubrics.map((r) => r.id)));
    setCreatedReportId('');
    setUploadedImages([]);
    setShowCreateForm(false);
    setShowRubricSelect(true);
  };

  // 채점기준 선택 완료 → 평가 입력 폼으로
  const confirmRubricSelection = () => {
    const selected = rubrics.filter((r) => selectedRubricIds.has(r.id));
    setDraftItems(selected.map((r, i) => ({
      rubricId: r.id,
      rubricTitleSnapshot: r.title,
      rubricGoalSnapshot: r.goal,
      rubricTaskSnapshot: r.task,
      rubricLevelHighSnapshot: r.level_high,
      rubricLevelMidSnapshot: r.level_mid,
      rubricLevelLowSnapshot: r.level_low,
      grade: 'mid',
      teacherFeedback: '',
      sortOrder: i
    })));
    setShowRubricSelect(false);
    setShowCreateForm(true);
  };

  const toggleRubric = (id: string) => {
    setSelectedRubricIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onSaveReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setCreateLoading(true);
    setError('');
    try {
      const autoTitle = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' 평가';
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
            grade: item.grade,
            teacherFeedback: item.teacherFeedback || null,
            sortOrder: item.sortOrder
          }))
        })
      });
      setCreatedReportId(d.report.id);
      setReports((prev) => [{ id: d.report.id, title: d.report.title, created_at: d.report.created_at, eval_report_items: [], eval_report_images: [] }, ...prev]);
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
      const d = await api<{ report: ReportDetail }>(`/api/eval/reports/${reportId}`);
      setDetailReport(d.report);
    } catch { /* ignore */ }
  };

  if (!classId) return <EmptyState title="학급을 선택하세요" description="평가피드백은 학급 선택 후 확인할 수 있습니다." />;

  return (
    <section className="card">
      <div className="row space-between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>평가피드백</h2>
        <div className="row" style={{ gap: 6, width: 'auto' }}>
          <button type="button" className={subTab === 'reports' ? 'ghost' : 'outline'} style={{ width: 'auto' }} onClick={() => setSubTab('reports')}>평가 관리</button>
          <button type="button" className={subTab === 'rubrics' ? 'ghost' : 'outline'} style={{ width: 'auto' }} onClick={() => setSubTab('rubrics')}>채점기준</button>
        </div>
      </div>

      <Notice type="success" message={msg} />
      <Notice type="error" message={error} />

      {subTab === 'rubrics' && <RubricManager />}

      {subTab === 'reports' && (
        <div className="grid two" style={{ alignItems: 'start', gap: 14 }}>
          {/* 왼쪽: 학생 목록 */}
          <div>
            <h3 style={{ marginTop: 0 }}>학생 선택</h3>
            {students.length === 0 ? (
              <EmptyState title="학생이 없습니다" description="학생을 먼저 등록하세요." />
            ) : (
              <div className="grid" style={{ gap: 6 }}>
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={selectedStudentId === s.id ? 'ghost' : 'outline'}
                    style={{ textAlign: 'left', padding: '10px 14px' }}
                    onClick={() => { setSelectedStudentId(s.id); setShowCreateForm(false); setShowRubricSelect(false); }}
                  >
                    <strong>{s.student_number}번 {s.name}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽: 보고서 목록 */}
          <div>
            {!selectedStudentId ? (
              <EmptyState title="학생을 선택하세요" description="왼쪽에서 학생을 클릭하면 평가 목록이 표시됩니다." />
            ) : (
              <>
                <div className="row space-between" style={{ marginBottom: 10 }}>
                  <h3 style={{ margin: 0 }}>{selectedStudent?.name} 평가 목록</h3>
                  <button type="button" className="ghost" style={{ width: 'auto' }} onClick={openCreateForm}>+ 새 평가 작성</button>
                </div>

                {/* 채점기준 선택 화면 */}
                {showRubricSelect && (
                  <div className="card" style={{ padding: 14, marginBottom: 12 }}>
                    <div className="row space-between" style={{ marginBottom: 10 }}>
                      <h4 style={{ margin: 0 }}>채점기준 선택</h4>
                      <button type="button" className="outline" style={{ width: 'auto', fontSize: 12 }} onClick={() => setShowRubricSelect(false)}>취소</button>
                    </div>
                    {rubrics.length === 0 ? (
                      <Notice type="info" message="등록된 채점기준이 없습니다. 채점기준 탭에서 먼저 기준을 등록하세요." />
                    ) : (
                      <>
                        <div className="grid" style={{ gap: 6, marginBottom: 12 }}>
                          {rubrics.map((r) => (
                            <label
                              key={r.id}
                              className="card"
                              style={{ padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: selectedRubricIds.has(r.id) ? '#f0f9ff' : undefined }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedRubricIds.has(r.id)}
                                onChange={() => toggleRubric(r.id)}
                                style={{ marginTop: 2, flexShrink: 0 }}
                              />
                              <div>
                                <strong>{r.title}</strong>
                                {r.goal && <p className="hint" style={{ margin: '2px 0 0', fontSize: 12 }}>도달목표: {r.goal}</p>}
                              </div>
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="ghost"
                          style={{ width: '100%' }}
                          onClick={confirmRubricSelection}
                          disabled={selectedRubricIds.size === 0}
                        >
                          선택 완료 ({selectedRubricIds.size}개)
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* 평가 작성 폼 */}
                {showCreateForm && (
                  <div className="card" style={{ padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: '0 0 10px' }}>새 평가보고서 작성</h4>
                    <form onSubmit={onSaveReport}>
                      {draftItems.length === 0 ? (
                        <Notice type="info" message="등록된 채점기준이 없습니다. 채점기준 탭에서 먼저 기준을 등록하세요." />
                      ) : (
                        <div className="grid" style={{ gap: 10, marginBottom: 12 }}>
                          {draftItems.map((item, idx) => (
                            <article key={item.rubricId ?? idx} className="card" style={{ padding: 12 }}>
                              <strong style={{ display: 'block', marginBottom: 8 }}>{item.rubricTitleSnapshot}</strong>
                              {item.rubricGoalSnapshot && <p className="hint" style={{ margin: '2px 0', fontSize: 12 }}><strong>도달목표:</strong> {item.rubricGoalSnapshot}</p>}
                              {item.rubricTaskSnapshot && <p className="hint" style={{ margin: '2px 0', fontSize: 12 }}><strong>수행과제:</strong> {item.rubricTaskSnapshot}</p>}

                              <div className="row" style={{ gap: 6, margin: '10px 0 8px' }}>
                                {(['high', 'mid', 'low'] as const).map((g) => {
                                  const desc = g === 'high' ? item.rubricLevelHighSnapshot : g === 'mid' ? item.rubricLevelMidSnapshot : item.rubricLevelLowSnapshot;
                                  return (
                                    <button
                                      key={g}
                                      type="button"
                                      className={item.grade === g ? 'ghost' : 'outline'}
                                      style={{ flex: 1, fontSize: 13, padding: '6px 4px', color: item.grade === g ? undefined : GRADE_COLOR[g] }}
                                      onClick={() => setDraftItems((prev) => prev.map((d, i) => i === idx ? { ...d, grade: g } : d))}
                                      title={desc ?? undefined}
                                    >
                                      {GRADE_LABEL[g]}
                                    </button>
                                  );
                                })}
                              </div>
                              <textarea
                                placeholder="이 학생에 대한 피드백 (선택, 200자)"
                                maxLength={200}
                                value={item.teacherFeedback}
                                onChange={(e) => setDraftItems((prev) => prev.map((d, i) => i === idx ? { ...d, teacherFeedback: e.target.value } : d))}
                                style={{ minHeight: 52, resize: 'vertical' }}
                              />
                            </article>
                          ))}
                        </div>
                      )}

                      {!createdReportId ? (
                        <button type="submit" className="ghost" style={{ width: '100%' }} disabled={createLoading || draftItems.length === 0}>
                          {createLoading ? '저장 중...' : '보고서 저장'}
                        </button>
                      ) : (
                        <>
                          <ImageUploader
                            reportId={createdReportId}
                            images={uploadedImages}
                            onUploaded={(img) => setUploadedImages((prev) => [...prev, img])}
                          />
                          <button type="button" className="outline" style={{ marginTop: 10, width: '100%' }} onClick={() => { setShowCreateForm(false); setShowRubricSelect(false); setCreatedReportId(''); }}>완료</button>
                        </>
                      )}
                    </form>
                  </div>
                )}

                {reportsLoading ? (
                  <p className="hint">불러오는 중...</p>
                ) : reports.length === 0 ? (
                  <EmptyState title="평가 기록이 없습니다" description="+ 새 평가 작성 버튼으로 평가를 시작하세요." />
                ) : (
                  <div className="grid" style={{ gap: 8 }}>
                    {reports.map((r) => (
                      <article key={r.id} className="card" style={{ padding: 12 }}>
                        <div className="row space-between">
                          <div>
                            <strong>{r.title}</strong>
                            <p className="hint" style={{ margin: '2px 0 0', fontSize: 12 }}>
                              {new Date(r.created_at).toLocaleDateString('ko-KR')} · 항목 {r.eval_report_items.length}개
                              {r.eval_report_images.length > 0 && ` · 이미지 ${r.eval_report_images.length}장`}
                            </p>
                          </div>
                          <div className="row" style={{ gap: 4 }}>
                            <button type="button" className="ghost" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => openDetail(r.id)}>상세</button>
                            <button type="button" className="outline" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => onDeleteReport(r.id)} disabled={deletingId === r.id}>삭제</button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {detailReport && <ReportDetailModal report={detailReport} onClose={() => setDetailReport(null)} />}
    </section>
  );
}
