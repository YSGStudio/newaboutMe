'use client';

/**
 * LearningContent — 학생 "배움성찰" 탭.
 *
 * 선생님이 연 활동을 책 카드로 보여주고, 책을 누르면 상세에서
 * 결과물(사진·PDF)을 올리고 성찰 질문에 답을 씁니다. 선생님 피드백이 오면 함께 보입니다.
 *
 * 문구는 모두 해요체입니다. 상태 판정과 파일 규칙은 lib/learning.ts 한 곳에서 가져옵니다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import BookCard from '@/components/student/BookCard';
import { SUBJECT_COLOR, DEFAULT_SUBJECT_COLOR } from '@/lib/subjects';
import { formatDateInSeoul } from '@/lib/date';
import {
  LearningStatus,
  STUDENT_STATUS_LABEL,
  STATUS_COLOR,
  MAX_ANSWER_LENGTH,
  MAX_FILES_PER_SUBMISSION,
  MAX_LINKS_PER_SUBMISSION,
  checkLearningFile,
  checkLearningLink,
  isPreviewableImage,
} from '@/lib/learning';

// ── Types ──────────────────────────────────────────────────────────

type ActivityRow = {
  id: string;
  subject: string;
  unit: string;
  title: string;
  created_at: string;
  status: LearningStatus;
  submittedByTeacher: boolean;
  materialCount: number;
  questionCount: number;
};

type SubmissionFile = { id: string; file_name: string; mime_type: string; sort_order: number; url: string | null };
type SubmissionLink = { id: string; url: string; label: string | null; sort_order: number };
type QuestionRow = { id: string; question: string; sort_order: number; answer: string };

type Detail = {
  activity: { id: string; subject: string; unit: string; title: string; created_at: string };
  questions: QuestionRow[];
  submission: {
    id: string;
    status: string;
    submitted_by: string;
    submitted_at: string | null;
    feedback_text: string | null;
    feedback_updated_at: string | null;
    files: SubmissionFile[];
    links: SubmissionLink[];
  } | null;
  status: LearningStatus;
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청에 실패했어요.');
  return json;
};

/** 서울 시각 기준 'YYYY-MM' — 월별 탭 그룹 키. 평가기록 탭과 같은 방식입니다. */
const monthKeyOf = (iso: string) => formatDateInSeoul(new Date(iso)).slice(0, 7);
const thisMonth = () => formatDateInSeoul(new Date()).slice(0, 7);

/** 'YYYY. M. D.' — 학생 화면에 보여주는 날짜 표기 */
const formatDay = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const formatShort = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

export default function LearningContent() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const [subject, setSubject] = useState('all');
  const [month, setMonth] = useState(thisMonth);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [openingId, setOpeningId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await api<{ activities: ActivityRow[] }>('/api/learning/my', { cache: 'no-store' });
      setActivities(data.activities);
      setLoaded(true);
    } catch (err) {
      setError((err as Error).message);
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── 필터 ────────────────────────────────────────────────────────

  const subjectsInUse = useMemo(
    () => [...new Set(activities.map((a) => a.subject))],
    [activities]
  );

  const bySubject = useMemo(
    () => (subject === 'all' ? activities : activities.filter((a) => a.subject === subject)),
    [activities, subject]
  );

  /** 과목으로 먼저 좁힌 뒤 월로 묶습니다. 목록이 최신순이라 그룹도 최신 월부터입니다. */
  const monthGroups = useMemo(() => {
    const groups = new Map<string, ActivityRow[]>();
    for (const activity of bySubject) {
      const key = monthKeyOf(activity.created_at);
      const bucket = groups.get(key);
      if (bucket) bucket.push(activity);
      else groups.set(key, [activity]);
    }
    return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
  }, [bySubject]);

  const hasMultipleYears = new Set(monthGroups.map((g) => g.key.slice(0, 4))).size > 1;
  const monthLabel = (key: string) => {
    const m = Number(key.slice(5, 7));
    return hasMultipleYears ? `${key.slice(0, 4)}년 ${m}월` : `${m}월`;
  };

  // 고른 달에 활동이 없으면(이번 달이 비어 있는 경우 등) 전체를 보여줍니다.
  const activeGroup = monthGroups.find((g) => g.key === month);
  const visible = activeGroup ? activeGroup.rows : bySubject;

  // ── 상세 ────────────────────────────────────────────────────────

  const openDetail = async (activityId: string) => {
    setDetailLoading(true);
    setOpeningId(activityId);
    setModalError('');
    setModalMsg('');
    try {
      const data = await api<Detail>(`/api/learning/my/${activityId}`, { cache: 'no-store' });
      setDetail(data);
      setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, q.answer])));
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setDetailLoading(false);
      setOpeningId('');
    }
  };

  const refreshDetail = async (activityId: string) => {
    const data = await api<Detail>(`/api/learning/my/${activityId}`, { cache: 'no-store' });
    setDetail(data);
    setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, q.answer])));
    await load();
  };

  const locked = Boolean(detail?.submission?.feedback_text);

  const saveAnswer = async () => {
    if (!detail) return;
    setSaving(true);
    setModalError('');
    setModalMsg('');
    try {
      const result = await api<{ submitted: boolean; newBadges?: { name: string }[] }>(
        `/api/learning/my/${detail.activity.id}/answer`,
        {
          method: 'PUT',
          body: JSON.stringify({
            answers: detail.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
          }),
        }
      );
      await refreshDetail(detail.activity.id);

      // 성찰을 내면 별빛 여행 연료와 별빛 퀘스트 뱃지가 함께 쌓입니다.
      const badgeNames = (result.newBadges ?? []).map((badge) => badge.name);
      if (badgeNames.length > 0) {
        setModalMsg(`성찰을 냈어요! 새 뱃지를 받았어요 — ${badgeNames.join(', ')} 🏅`);
      } else if (result.submitted) {
        setModalMsg('성찰을 냈어요! 별빛 연료가 쌓였어요 ⛽');
      } else {
        setModalMsg('성찰을 저장했어요.');
      }
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!detail) return;
    const currentCount = detail.submission?.files.length ?? 0;

    // 서버에서도 같은 함수로 다시 검사하지만, 여기서 먼저 걸러 이유를 바로 보여줍니다.
    const rejection = checkLearningFile({ type: file.type, size: file.size }, currentCount);
    if (rejection) {
      setModalError(rejection);
      return;
    }

    setUploading(true);
    setModalError('');
    setModalMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api(`/api/learning/my/${detail.activity.id}/files`, { method: 'POST', body: form });
      await refreshDetail(detail.activity.id);
      setModalMsg('결과물을 올렸어요.');
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!detail) return;
    setModalError('');
    setModalMsg('');
    try {
      await api(`/api/learning/my/${detail.activity.id}/files/${fileId}`, { method: 'DELETE' });
      await refreshDetail(detail.activity.id);
    } catch (err) {
      setModalError((err as Error).message);
    }
  };

  const addLink = async () => {
    if (!detail) return;
    const currentCount = detail.submission?.links.length ?? 0;

    // 서버에서도 같은 함수로 다시 검사하지만, 여기서 먼저 걸러 이유를 바로 보여줍니다.
    const rejection = checkLearningLink(linkUrl, currentCount);
    if (rejection) {
      setModalError(rejection);
      return;
    }

    setLinkSaving(true);
    setModalError('');
    setModalMsg('');
    try {
      await api(`/api/learning/my/${detail.activity.id}/links`, {
        method: 'POST',
        body: JSON.stringify({ url: linkUrl, label: linkLabel || undefined }),
      });
      await refreshDetail(detail.activity.id);
      setLinkUrl('');
      setLinkLabel('');
      setLinkOpen(false);
      setModalMsg('링크를 등록했어요.');
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setLinkSaving(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    if (!detail) return;
    setModalError('');
    setModalMsg('');
    try {
      await api(`/api/learning/my/${detail.activity.id}/links/${linkId}`, { method: 'DELETE' });
      await refreshDetail(detail.activity.id);
    } catch (err) {
      setModalError((err as Error).message);
    }
  };

  const openFile = async (fileId: string) => {
    try {
      const data = await api<{ url: string }>(`/api/learning/files/${fileId}/view`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setModalError((err as Error).message);
    }
  };

  // ── 렌더 ────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <section className="card">
        <h2 style={{ margin: '0 0 12px' }}>배움성찰</h2>
        <p className="hint">불러오는 중...</p>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2 style={{ margin: '0 0 12px' }}>배움성찰</h2>
        {error && <Notice type="error" message={error} />}

        {activities.length === 0 ? (
          <EmptyState
            title="아직 활동이 없어요"
            description="선생님이 배움 활동을 열면 여기에 책이 생겨요."
          />
        ) : (
          <>
            {/* 과목 탭 — 두 과목 이상일 때만 */}
            {subjectsInUse.length > 1 && (
              <div className="eval-subject-tabs" role="group" aria-label="과목 선택" style={{ marginBottom: 10 }}>
                {['all', ...subjectsInUse].map((key) => {
                  const isActive = subject === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isActive}
                      className={`eval-subject-tab${isActive ? ' is-active' : ''}`}
                      onClick={() => setSubject(key)}
                    >
                      <span className="eval-subject-icon" aria-hidden="true">{key === 'all' ? '✨' : '📚'}</span>
                      <span>{key === 'all' ? '전체' : key}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 월별 탭 — 배움성찰은 월 단위로 관리하므로 활동이 있으면 항상 보여줍니다 */}
            {monthGroups.length > 0 && (
              <div className="eval-month-tabs" role="group" aria-label="월 선택" style={{ marginBottom: 14 }}>
                {[{ key: 'all', label: '전체', icon: '✨', count: bySubject.length }].concat(
                  monthGroups.map((g) => ({ key: g.key, label: monthLabel(g.key), icon: '🗓️', count: g.rows.length }))
                ).map((tab) => {
                  const isActive = (activeGroup?.key ?? 'all') === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      aria-pressed={isActive}
                      className={`eval-month-tab${isActive ? ' is-active' : ''}`}
                      onClick={() => setMonth(tab.key)}
                    >
                      <span className="eval-month-icon" aria-hidden="true">{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span className="eval-month-count">{tab.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {visible.map((activity) => {
                const accent = SUBJECT_COLOR[activity.subject] ?? DEFAULT_SUBJECT_COLOR;
                const tone = STATUS_COLOR[activity.status];
                return (
                  <BookCard
                    key={activity.id}
                    onClick={() => openDetail(activity.id)}
                    disabled={detailLoading}
                    loading={openingId === activity.id}
                    accentColor={accent}
                    eyebrow={activity.subject}
                    title={activity.title}
                    badges={
                      <span style={{
                        fontSize: 8.5, fontWeight: 800, lineHeight: 1.4,
                        borderRadius: 5, padding: '1.5px 5px',
                        background: tone.bg, color: tone.text, border: `1px solid ${tone.border}`,
                        boxShadow: '0 1px 3px rgba(20,18,40,0.25)',
                      }}>
                        {STUDENT_STATUS_LABEL[activity.status]}
                      </span>
                    }
                    caption={
                      <>
                        {activity.unit}
                        <br />
                        {formatShort(activity.created_at)}
                      </>
                    }
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* 책 상세 — 결과물 올리기 + 성찰 쓰기 + 선생님 피드백 */}
      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div style={{ width: 'min(600px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div className="row space-between">
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    {detail.activity.subject} · {detail.activity.unit}
                  </p>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{detail.activity.title}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                    올라온 날 {formatDay(detail.activity.created_at)}
                    {detail.submission?.submitted_at && ` · 낸 날 ${formatDay(detail.submission.submitted_at)}`}
                  </p>
                </div>
                <button type="button" className="outline" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setDetail(null)}>닫기</button>
              </div>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {modalError && <Notice type="error" message={modalError} />}
              {modalMsg && <Notice type="success" message={modalMsg} />}

              {locked && (
                <p style={{
                  margin: 0, padding: '10px 12px', borderRadius: 10,
                  background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#047857',
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  선생님 피드백이 도착해서 이제 고칠 수 없어요. 피드백을 읽어보세요.
                </p>
              )}

              {/* 내 결과물 */}
              <div>
                <div className="row space-between" style={{ marginBottom: 8, gap: 6 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#374151' }}>
                    나의 결과물
                  </p>
                  {!locked && (
                    <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: 'auto', fontSize: 12, padding: '5px 11px' }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || (detail.submission?.files.length ?? 0) >= MAX_FILES_PER_SUBMISSION}
                      >
                        {uploading ? '올리는 중...' : '사진·PDF'}
                      </button>
                      <button
                        type="button"
                        className="outline"
                        style={{ width: 'auto', fontSize: 12, padding: '5px 11px' }}
                        onClick={() => setLinkOpen((open) => !open)}
                        disabled={(detail.submission?.links.length ?? 0) >= MAX_LINKS_PER_SUBMISSION}
                      >
                        🔗 링크
                      </button>
                    </div>
                  )}
                </div>

                <p className="hint" style={{ margin: '0 0 8px' }}>
                  사진·PDF {detail.submission?.files.length ?? 0}/{MAX_FILES_PER_SUBMISSION} ·
                  링크 {detail.submission?.links.length ?? 0}/{MAX_LINKS_PER_SUBMISSION}
                </p>

                {/* 링크 등록 칸 — 버튼을 눌렀을 때만 열립니다 */}
                {linkOpen && !locked && (
                  <div style={{
                    marginBottom: 10, padding: '10px 12px', borderRadius: 12,
                    border: '1px solid #ddd6fe', background: '#faf9ff',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https:// 로 시작하는 주소를 붙여넣어요"
                      maxLength={2000}
                    />
                    <input
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      placeholder="이름 (안 써도 돼요)"
                      maxLength={60}
                    />
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: 'auto' }}
                        onClick={addLink}
                        disabled={linkSaving || linkUrl.trim().length === 0}
                      >
                        {linkSaving ? '등록 중...' : '링크 등록'}
                      </button>
                      <button
                        type="button"
                        className="outline"
                        style={{ width: 'auto' }}
                        onClick={() => { setLinkOpen(false); setLinkUrl(''); setLinkLabel(''); }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                  }}
                />
                {(detail.submission?.files.length ?? 0) === 0 && (detail.submission?.links.length ?? 0) === 0 ? (
                  <p className="hint" style={{ margin: 0 }}>아직 올린 결과물이 없어요.</p>
                ) : (
                  /* 사진은 썸네일로 미리 보여주고, PDF는 아이콘 타일로 대신합니다 */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
                    {detail.submission!.files.map((file) => {
                      const isImage = isPreviewableImage(file.mime_type) && file.url;
                      return (
                        <div key={file.id} style={{
                          position: 'relative', borderRadius: 10, overflow: 'hidden',
                          border: '1px solid #e2e8f0', background: '#f8fafc',
                        }}>
                          <button
                            type="button"
                            onClick={() => openFile(file.id)}
                            title={file.file_name}
                            style={{
                              width: '100%', padding: 0, border: 'none', background: 'none',
                              cursor: 'pointer', display: 'block',
                            }}
                          >
                            {isImage ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={file.url!}
                                alt={file.file_name}
                                style={{ display: 'block', width: '100%', height: 88, objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{
                                display: 'grid', placeItems: 'center', height: 88,
                                fontSize: 28, background: '#eef2ff',
                              }}>📄</span>
                            )}
                            <span style={{
                              display: 'block', padding: '5px 7px', fontSize: 11, color: '#475569',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left',
                            }}>
                              {file.file_name}
                            </span>
                          </button>
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => deleteFile(file.id)}
                              aria-label={`${file.file_name} 삭제`}
                              style={{
                                position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                                padding: 0, borderRadius: 999, border: 'none',
                                background: 'rgba(15,23,42,0.62)', color: '#fff',
                                fontSize: 12, lineHeight: 1, cursor: 'pointer',
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {(detail.submission?.links.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                    {detail.submission!.links.map((link) => (
                      <div key={link.id} className="row space-between" style={{
                        padding: '8px 10px', borderRadius: 10,
                        border: '1px solid #e2e8f0', background: '#f8fafc', gap: 6,
                      }}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={link.url}
                          style={{
                            flex: 1, color: '#4f46e5', fontSize: 13, fontWeight: 600,
                            textDecoration: 'none',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          🔗 {link.label || link.url}
                        </a>
                        {!locked && (
                          <button
                            type="button"
                            className="outline"
                            style={{ width: 'auto', flexShrink: 0, fontSize: 12, padding: '4px 10px' }}
                            onClick={() => deleteLink(link.id)}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 선생님 질문마다 바로 아래에 내 답을 붙여, 무엇에 답하는지 헷갈리지 않게 합니다 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detail.questions.map((question, index) => (
                  <div key={question.id} style={{ borderRadius: 12, border: '1px solid #ddd6fe', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#f5f3ff', borderBottom: '1px solid #ddd6fe' }}>
                      <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 800, color: '#7c6bd6', letterSpacing: '0.02em' }}>
                        선생님 질문 {detail.questions.length > 1 ? index + 1 : ''}
                      </p>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#312e81', fontWeight: 600 }}>
                        {question.question}
                      </p>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 13, color: '#374151' }}>나의 성찰</p>
                      {locked ? (
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                          {(answers[question.id] ?? '').trim() || '쓴 내용이 없어요.'}
                        </p>
                      ) : (
                        <>
                          <textarea
                            value={answers[question.id] ?? ''}
                            onChange={(e) => setAnswers((prev) => ({
                              ...prev,
                              [question.id]: e.target.value.slice(0, MAX_ANSWER_LENGTH),
                            }))}
                            rows={4}
                            placeholder="생각한 것을 자유롭게 써보세요."
                            style={{ width: '100%' }}
                          />
                          <span className="hint" style={{ display: 'block', marginTop: 4 }}>
                            {(answers[question.id] ?? '').length}/{MAX_ANSWER_LENGTH}자
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {!locked && detail.questions.length > 0 && (
                  <div>
                    <button
                      type="button"
                      className="ghost"
                      style={{ width: 'auto' }}
                      onClick={saveAnswer}
                      disabled={saving}
                    >
                      {saving ? '저장 중...' : '성찰 저장하기'}
                    </button>
                    <p className="hint" style={{ margin: '6px 0 0' }}>
                      결과물 1개 이상을 올리고 질문에 모두 답하면 제출이 끝나요.
                    </p>
                  </div>
                )}
              </div>

              {/* 선생님 피드백 */}
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: '#374151' }}>선생님 피드백</p>
                {detail.submission?.feedback_text ? (
                  <p style={{
                    margin: 0, padding: '12px 14px', borderRadius: 12,
                    background: '#f5f3ff', border: '1px solid #ddd6fe',
                    fontSize: 14, lineHeight: 1.7, color: '#312e81', whiteSpace: 'pre-wrap',
                  }}>
                    {detail.submission.feedback_text}
                  </p>
                ) : (
                  <p className="hint" style={{ margin: 0 }}>선생님 피드백을 기다리고 있어요.</p>
                )}
              </div>

              {detail.submission?.submitted_by === 'teacher' && (
                <p className="hint" style={{ margin: 0 }}>선생님이 결과물을 대신 올려주셨어요.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
