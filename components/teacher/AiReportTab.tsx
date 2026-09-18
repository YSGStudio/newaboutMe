'use client';

/**
 * AiReportTab — 교사 "AI생성" 탭.
 *
 * 학생을 고르면 그 학생의 배움성찰 기록을 과목별로 불러와 보여주고,
 * 교사가 과목을 골라 교과발달상황을 만듭니다. 결과는 과목별로 저장되고 복사할 수 있습니다.
 *
 * AI에는 교사 판단만 보냅니다 — 평가요소 이름, 교사 등급과 그 등급의 기준 문장, 요소 코멘트, 서술 피드백.
 * 학생 답변은 이 화면에서 참고용으로만 보여주고 AI에는 보내지 않습니다.
 * 학생은 AI에 출석번호로만 전달됩니다.
 */
import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import RefreshButton from '@/components/ui/RefreshButton';
import { api } from '@/lib/api-client';
import { SUBJECT_LIST } from '@/lib/subjects';
import {
  GRADE_LABEL,
  STATUS_COLOR,
  TEACHER_STATUS_LABEL,
  type Grade,
  type LearningStatus,
} from '@/lib/learning';
import { GradeChip } from '@/components/learning/GradeParts';

// ── Types ──────────────────────────────────────────────────────────

type Usage = { used: number; limit: number | null; remaining: number | null };

type RosterStudent = { id: string; name: string; student_number: number; savedSubjects: string[] };

type ViewQuestion = {
  question: string;
  answer: string;
  criterion: {
    title: string;
    levelHigh: string | null;
    levelMid: string | null;
    levelLow: string | null;
    teacherGrade: Grade | null;
    teacherComment: string | null;
  } | null;
};

type ViewActivity = {
  id: string;
  unit: string;
  title: string;
  createdAt: string;
  status: LearningStatus;
  feedback: string | null;
  sendable: boolean;
  questions: ViewQuestion[];
};

type ViewSubject = { subject: string; activities: ViewActivity[]; sendableCount: number };

type SavedReport = { subject: string; content: string; sourceCount: number; generatedAt: string };

/** 생성 1회 비용 — 라우트(app/api/ai/learning-subject-report/[studentId])와 같은 값 */
const COST = 2;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 과목을 SUBJECT_LIST 순서로 정렬 — 목록에 없는 과목은 뒤로 */
const subjectOrder = (subject: string) => {
  const index = (SUBJECT_LIST as readonly string[]).indexOf(subject);
  return index === -1 ? SUBJECT_LIST.length : index;
};

const levelOf = (criterion: NonNullable<ViewQuestion['criterion']>, grade: Grade) =>
  grade === 'high' ? criterion.levelHigh : grade === 'mid' ? criterion.levelMid : criterion.levelLow;

type Props = {
  classId: string;
  /** 생성 후 상단 사용량 표시를 다시 읽게 한다 */
  onAiUsageChanged?: () => void;
};

export default function AiReportTab({ classId, onAiUsageChanged }: Props) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const [activeId, setActiveId] = useState('');
  const [subjects, setSubjects] = useState<ViewSubject[]>([]);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [message, setMessage] = useState('');

  const loadStudents = async () => {
    if (!classId) return;
    try {
      const data = await api<{ students: RosterStudent[]; usage: Usage }>(
        `/api/ai/learning-subject-report?classId=${classId}`,
        { cache: 'no-store' },
      );
      setStudents(data.students);
      setUsage(data.usage);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    setActiveId('');
    setSubjects([]);
    setSaved([]);
    setLoaded(false);
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  /** 자료 불러오기 — 과목별 배움성찰 기록과 저장된 결과를 함께 읽는다. */
  const loadDetail = async (studentId: string) => {
    setDetailLoading(true);
    setDetailError('');
    setMessage('');
    try {
      const data = await api<{ subjects: ViewSubject[]; saved: SavedReport[]; usage: Usage }>(
        `/api/ai/learning-subject-report/${studentId}`,
        { cache: 'no-store' },
      );
      const sorted = [...data.subjects].sort((a, b) => subjectOrder(a.subject) - subjectOrder(b.subject));
      setSubjects(sorted);
      setSaved(data.saved);
      setUsage(data.usage);
      // 보낼 기록이 있는 과목을 기본으로 고른다.
      setPicked(sorted.filter((s) => s.sendableCount > 0).map((s) => s.subject));
    } catch (err) {
      setDetailError((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const selectStudent = (studentId: string) => {
    setActiveId(studentId);
    setSubjects([]);
    setSaved([]);
    loadDetail(studentId);
  };

  const togglePicked = (subject: string) =>
    setPicked((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));

  const generate = async () => {
    if (!activeId || picked.length === 0) return;
    setGenerating(true);
    setDetailError('');
    setMessage('');
    try {
      const data = await api<{ reports: SavedReport[]; usage: Usage }>(
        `/api/ai/learning-subject-report/${activeId}`,
        { method: 'POST', body: JSON.stringify({ subjects: picked }) },
      );
      setSaved((prev) => {
        const next = new Map(prev.map((r) => [r.subject, r]));
        data.reports.forEach((r) => next.set(r.subject, r));
        return [...next.values()];
      });
      setUsage(data.usage);
      setStudents((prev) => prev.map((s) => (
        s.id === activeId
          ? { ...s, savedSubjects: [...new Set([...s.savedSubjects, ...data.reports.map((r) => r.subject)])] }
          : s
      )));
      setMessage(`${data.reports.map((r) => r.subject).join(', ')} 교과발달상황을 만들었습니다.`);
      onAiUsageChanged?.();
    } catch (err) {
      setDetailError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('복사했습니다.');
    } catch {
      setDetailError('복사하지 못했습니다. 글을 직접 선택해 복사해주세요.');
    }
  };

  // ── 렌더 ────────────────────────────────────────────────────────

  if (!classId) {
    return (
      <section className="card">
        <EmptyState title="학급을 먼저 선택해주세요" description="학급을 고르면 교과발달상황을 만들 수 있습니다." />
      </section>
    );
  }

  const active = students.find((s) => s.id === activeId) ?? null;
  const savedBySubject = new Map(saved.map((r) => [r.subject, r]));
  const sortedSaved = [...saved].sort((a, b) => subjectOrder(a.subject) - subjectOrder(b.subject));
  const notEnough = usage?.remaining !== null && usage?.remaining !== undefined && usage.remaining < COST;

  return (
    <section className="card ai-report-dashboard">
      {generating && (
        <div className="growth-analysis-backdrop" role="dialog" aria-modal="true" aria-labelledby="ai-report-analysis-title">
          <div className="growth-analysis-modal">
            <div className="growth-star-scene" aria-hidden="true">
              <span className="growth-star growth-star-1">✦</span>
              <span className="growth-star growth-star-2">✧</span>
              <span className="growth-star growth-star-3">✦</span>
              <span className="growth-shooting-star" />
              <span className="growth-star-orbit"><span className="growth-star-core">★</span></span>
            </div>
            <p id="ai-report-analysis-title" className="growth-analysis-title">별빛이 배움성찰 기록을 살펴보고 있어요</p>
            <p className="growth-analysis-description">
              교과발달상황을 만들고 있어요.<br />완료될 때까지 다른 화면을 조작하지 마세요.
            </p>
            <div className="growth-analysis-dots" aria-hidden="true"><span /><span /><span /></div>
          </div>
        </div>
      )}

      <div className="ai-report-header">
        <div className="ai-report-header-copy">
          <span className="ai-report-kicker">AI RECORD ASSISTANT</span>
          <h2>AI생성 · 교과발달상황</h2>
          <p>
            배움성찰의 평가요소 등급·기준과 최종 피드백으로 과목별 교과발달상황을 만듭니다.
            학생 답변은 참고용으로만 보이고 AI에 보내지 않습니다.
          </p>
        </div>
        <RefreshButton onClick={async () => { await loadStudents(); if (activeId) await loadDetail(activeId); }} />
      </div>

      {error && <Notice type="error" message={error} />}

      {!loaded ? (
        <p className="hint">불러오는 중...</p>
      ) : students.length === 0 ? (
        <EmptyState title="학생이 없습니다" description="학생명단에 학생을 먼저 등록해주세요." />
      ) : (
        <div className="ai-report-layout">
          {/* 학생 목록 */}
          <aside className="ai-report-roster">
            <div className="ai-report-panel-heading">
              <span aria-hidden="true">👤</span>
              <div><strong>학생 선택</strong><small>{students.length}명</small></div>
            </div>
            <div className="ai-report-students" role="list" aria-label="학생 목록">
              {students.map((student) => (
              <button
                key={student.id}
                type="button"
                role="listitem"
                className={`ai-report-student${student.id === activeId ? ' is-selected' : ''}`}
                onClick={() => selectStudent(student.id)}
                aria-current={student.id === activeId}
              >
                <span>{student.student_number}. {student.name}</span>
                <small>{student.savedSubjects.length > 0 ? student.savedSubjects.join('·') : '—'}</small>
              </button>
              ))}
            </div>
          </aside>

          {/* 상세 */}
          <div className="ai-report-detail">
            {!active ? (
              <EmptyState title="학생을 고르세요" description="학생을 고르면 과목별 배움성찰 기록을 불러옵니다." />
            ) : detailLoading ? (
              <p className="hint">자료를 불러오는 중...</p>
            ) : (
              <>
                <div className="ai-report-student-heading">
                  <span aria-hidden="true">✦</span>
                  <div><small>선택한 학생</small><h3>{active.student_number}. {active.name}</h3></div>
                </div>
                {detailError && <Notice type="error" message={detailError} />}
                {message && <Notice type="success" message={message} />}

                {subjects.length === 0 ? (
                  <EmptyState title="배움성찰 기록이 없습니다" description="학생이 낸 배움성찰이 있어야 교과발달상황을 만들 수 있습니다." />
                ) : (
                  <>
                    {/* 과목 선택 + 생성 */}
                    <section className="ai-report-generator" aria-labelledby="ai-report-generator-title">
                      <div className="ai-report-section-heading">
                        <div><span aria-hidden="true">1</span><div><strong id="ai-report-generator-title">생성할 과목 선택</strong><small>교사 평가가 있는 기록만 AI에 전달됩니다.</small></div></div>
                        <b>{picked.length}개 선택</b>
                      </div>
                      <div className="eval-subject-tabs" role="group" aria-label="생성할 과목 선택">
                        {subjects.map((s) => {
                          const isActive = picked.includes(s.subject);
                          return (
                            <button
                              key={s.subject}
                              type="button"
                              aria-pressed={isActive}
                              className={`eval-subject-tab${isActive ? ' is-active' : ''}`}
                              onClick={() => togglePicked(s.subject)}
                              disabled={s.sendableCount === 0}
                              title={s.sendableCount === 0 ? '교사 등급이나 피드백이 있는 기록이 없습니다.' : undefined}
                            >
                              <span className="eval-subject-icon" aria-hidden="true">{isActive ? '✓' : '📚'}</span>
                              <span>{s.subject} {s.sendableCount}건</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="ai-report-generate-action">
                        <button
                          type="button"
                          style={{ width: 'auto' }}
                          onClick={generate}
                          disabled={generating || picked.length === 0 || notEnough}
                        >
                          교과발달상황 생성 ({COST}회)
                        </button>
                        <span className="hint">
                          {usage?.remaining === null || usage?.remaining === undefined ? '사용 횟수 제한 없음' : `남은 횟수 ${usage.remaining}회`}
                          {notEnough && ' · 횟수가 부족합니다.'}
                        </span>
                      </div>
                    </section>

                    {/* 저장된 결과 */}
                    {sortedSaved.length > 0 && (
                      <section className="ai-report-results" aria-labelledby="ai-report-results-title">
                        <div className="ai-report-section-heading">
                          <div><span aria-hidden="true">2</span><div><strong id="ai-report-results-title">생성된 교과발달상황</strong><small>과목별 결과를 확인하고 복사할 수 있습니다.</small></div></div>
                        </div>
                        {sortedSaved.map((report) => (
                          <div key={report.subject} className="ai-report-result">
                            <div className="row space-between" style={{ gap: 6 }}>
                              <strong>{report.subject}</strong>
                              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                                <small className="hint">{formatDateTime(report.generatedAt)} · 기록 {report.sourceCount}건</small>
                                <button
                                  type="button"
                                  className="outline"
                                  style={{ width: 'auto', fontSize: 12, padding: '4px 10px', minHeight: 0 }}
                                  onClick={() => copy(report.content)}
                                >
                                  복사
                                </button>
                              </div>
                            </div>
                            <p>{report.content}</p>
                          </div>
                        ))}
                      </section>
                    )}

                    {/* 과목별 기록 */}
                    <section className="ai-report-sources" aria-labelledby="ai-report-sources-title">
                      <div className="ai-report-section-heading">
                        <div><span aria-hidden="true">3</span><div><strong id="ai-report-sources-title">참고할 배움성찰 기록</strong><small>AI 생성에 활용되는 교사 평가 자료입니다.</small></div></div>
                      </div>
                      {subjects.map((s) => (
                        <details key={s.subject} className="ai-report-subject" open={!savedBySubject.has(s.subject)}>
                        <summary>
                          <strong>{s.subject}</strong> · 활동 {s.activities.length}개 · AI에 보낼 기록 {s.sendableCount}건
                        </summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                          {s.activities.map((activity) => {
                            const tone = STATUS_COLOR[activity.status];
                            return (
                              <div key={activity.id} className="ai-report-activity">
                                <div className="row space-between" style={{ gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                                    {[activity.unit, activity.title].filter(Boolean).join(' · ')}
                                  </span>
                                  <span style={{ flexShrink: 0, padding: '1px 8px', borderRadius: 999, background: tone.bg, color: tone.text, fontSize: 11, fontWeight: 700 }}>
                                    {TEACHER_STATUS_LABEL[activity.status]}
                                  </span>
                                </div>
                                {activity.questions.map((q, index) => (
                                  <div key={index} style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>
                                    {q.criterion ? (
                                      <>
                                        <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                          <strong style={{ color: '#6d5bc5' }}>{q.criterion.title}</strong>
                                          <span>교사</span>
                                          <GradeChip grade={q.criterion.teacherGrade} labels={GRADE_LABEL} />
                                        </div>
                                        {q.criterion.teacherGrade && levelOf(q.criterion, q.criterion.teacherGrade) && (
                                          <div>기준: {levelOf(q.criterion, q.criterion.teacherGrade)}</div>
                                        )}
                                        {q.criterion.teacherComment && <div>코멘트: {q.criterion.teacherComment}</div>}
                                      </>
                                    ) : (
                                      <strong style={{ color: '#475569' }}>질문 {index + 1}</strong>
                                    )}
                                    <div style={{ color: '#94a3b8' }}>
                                      답변(참고): {q.answer.trim() || '없음'}
                                    </div>
                                  </div>
                                ))}
                                {activity.feedback && (
                                  <div style={{ fontSize: 12, lineHeight: 1.6, color: '#312e81' }}>서술 피드백: {activity.feedback}</div>
                                )}
                                {!activity.sendable && (
                                  <small className="hint">교사 등급·피드백이 없어 AI에 보내지 않습니다.</small>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        </details>
                      ))}
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
