'use client';

/**
 * LearningDashboard — 교사 "배움성찰" 탭.
 *
 * 왼쪽에서 활동을 만들고 고르면, 오른쪽에 학급 전체 학생이 카드로 깔립니다.
 * 카드 색이 상태(미제출·제출 완료·피드백 완료)를 나타내되, 색만으로 구분하지 않도록
 * 카드마다 상태 라벨을 함께 씁니다.
 *
 * 피드백은 선택 사항입니다. 쓰지 않은 학생에게 미완료 경고를 표시하지 않습니다.
 * 상태 판정과 파일 규칙은 lib/learning.ts 한 곳에서 가져옵니다.
 */
import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import RefreshButton from '@/components/ui/RefreshButton';
import { useConfirm } from '@/components/ui/useConfirm';
import { SUBJECT_LIST, SUBJECT_COLOR, DEFAULT_SUBJECT_COLOR } from '@/lib/subjects';
import { api } from '@/lib/api-client';
import {
  LearningStatus,
  TEACHER_STATUS_LABEL,
  STATUS_COLOR,
  MAX_FEEDBACK_LENGTH,
  MAX_FILES_PER_SUBMISSION,
  MAX_QUESTIONS_PER_ACTIVITY,
  SUGGESTED_QUESTIONS,
  MAX_LINKS_PER_SUBMISSION,
  checkLearningFile,
  checkLearningLink,
  isPreviewableImage,
} from '@/lib/learning';

// ── Types ──────────────────────────────────────────────────────────

type Question = { id: string; question: string; sort_order: number };

type Activity = {
  id: string;
  subject: string;
  unit: string;
  title: string;
  created_at: string;
  learning_activity_questions: Question[];
  submittedCount: number;
  reviewedCount: number;
};

type SubmissionFile = { id: string; file_name: string; mime_type: string; sort_order: number; url: string | null };
type SubmissionLink = { id: string; url: string; label: string | null; sort_order: number };
type AnswerRow = { questionId: string; question: string; answer: string };

type Submission = {
  id: string;
  status: string;
  submitted_by: string;
  submitted_at: string | null;
  feedback_text: string | null;
  feedback_updated_at: string | null;
  files: SubmissionFile[];
  links: SubmissionLink[];
  answers: AnswerRow[];
};

type StudentCell = {
  student: { id: string; name: string; student_number: number };
  status: LearningStatus;
  submission: Submission | null;
};

/** 활동을 펼쳐 학생 카드를 보고 있는 동안 제출 현황을 다시 읽는 주기 */
const POLL_INTERVAL_MS = 15_000;

/**
 * 학생 카드에서 활동 카드의 집계를 다시 센다.
 * 서버(app/api/learning/activities/route.ts)와 같은 셈법이라야 새로고침 결과와 어긋나지 않는다.
 * submitted = 제출 + 피드백 완료, reviewed = 피드백 완료.
 */
const countCells = (students: StudentCell[]) => ({
  submittedCount: students.filter((cell) => cell.status !== 'none').length,
  reviewedCount: students.filter((cell) => cell.status === 'reviewed').length,
});

const EMPTY_FORM = {
  subject: SUBJECT_LIST[0] as string,
  unit: '',
  title: '',
  // 처음에는 기본 질문 하나로 시작하고, 교사가 "질문 추가"로 늘린다.
  reflectionQuestions: [SUGGESTED_QUESTIONS[0]],
};

/** 교사 화면 날짜 표기 — 간결한 명사형에 맞춰 짧게 씁니다. */
const formatDay = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const formatShort = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

export default function LearningDashboard({ classId }: { classId: string }) {
  const { confirm, confirmDialog } = useConfirm();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [subjectFilter, setSubjectFilter] = useState('all');

  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const [cells, setCells] = useState<StudentCell[]>([]);
  const [cellsLoading, setCellsLoading] = useState(false);

  const [openCell, setOpenCell] = useState<StudentCell | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const proxyInputRef = useRef<HTMLInputElement>(null);
  const [proxyTarget, setProxyTarget] = useState<StudentCell | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proxyLinkOpen, setProxyLinkOpen] = useState(false);
  const [proxyLinkUrl, setProxyLinkUrl] = useState('');
  const [proxyLinkLabel, setProxyLinkLabel] = useState('');
  const [proxyLinkSaving, setProxyLinkSaving] = useState(false);

  const notifyLater = () => window.setTimeout(() => { setMessage(''); setError(''); }, 2500);

  // ── 로드 ────────────────────────────────────────────────────────

  // quiet=true는 자동 갱신용이다. 실패해도 오류 배너를 띄우지 않고 다음 주기에 다시 시도한다.
  const loadActivities = async (quiet = false) => {
    if (!classId) return;
    try {
      const data = await api<{ activities: Activity[]; totalStudents: number }>(
        `/api/learning/activities?classId=${classId}`,
        { cache: 'no-store' }
      );
      setActivities(data.activities);
      setTotalStudents(data.totalStudents);
      setLoaded(true);
    } catch (err) {
      if (quiet) return;
      setError((err as Error).message);
      setLoaded(true);
      notifyLater();
    }
  };

  useEffect(() => {
    setSelectedId('');
    setCells([]);
    setLoaded(false);
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  /**
   * 한 활동의 학생 카드를 읽어온다. 실패하면 null.
   * quiet=true는 자동 갱신용 — 오류 배너를 띄우지 않고 다음 주기에 다시 시도한다.
   */
  const fetchCells = async (activityId: string, quiet = false): Promise<StudentCell[] | null> => {
    try {
      const data = await api<{ students: StudentCell[] }>(
        `/api/learning/activities/${activityId}/submissions`,
        { cache: 'no-store' }
      );
      return data.students;
    } catch (err) {
      if (!quiet) {
        setError((err as Error).message);
        notifyLater();
      }
      return null;
    }
  };

  const loadCells = async (activityId: string) => {
    setCellsLoading(true);
    try {
      const students = await fetchCells(activityId);
      if (students) setCells(students);
    } finally {
      setCellsLoading(false);
    }
  };

  // ── 자동 갱신 ───────────────────────────────────────────────────
  // 학생이 제출해도 교사 화면은 스스로 바뀌지 않는다(이 프로젝트에는 Realtime 구독이 없다).
  // 그래서 폴링으로 메우되, 범위를 최대한 좁힌다.
  //
  //   · 교사가 배움성찰 탭에 있을 때만 — 탭을 벗어나면 이 컴포넌트가 언마운트된다(app/teacher/page.tsx)
  //   · 활동을 펼쳐 학생 카드가 떠 있을 때만 — 접으면 타이머 자체를 만들지 않는다
  //   · 펼친 활동 하나만 — 활동 목록 전체(/api/learning/activities)는 다시 읽지 않는다
  //
  // 활동 카드의 "제출 4/25" 집계는 서버를 다시 부르는 대신 방금 읽어온 학생 카드에서 직접 센다.
  // 서버(app/api/learning/activities/route.ts)가 쓰는 셈법과 같다 —
  // submitted는 제출·피드백 완료를 합친 수, reviewed는 피드백 완료만.

  // 인터벌 콜백은 만들어질 때의 값을 붙잡고 있으므로, 매 렌더의 최신 값을 ref로 건네준다.
  // 교사가 무언가 쓰거나 저장하는 중이면 건너뛴다. 화면을 발밑에서 갈아끼우지 않기 위함이다.
  const pollBusyRef = useRef(false);
  pollBusyRef.current =
    Boolean(openCell) || formOpen || Boolean(proxyTarget) || proxyLinkOpen
    || saving || feedbackSaving || uploading || proxyLinkSaving;
  const pollRunningRef = useRef(false);

  useEffect(() => {
    // 펼쳐진 활동이 없으면 폴링하지 않는다.
    if (!selectedId) return;

    const refresh = async () => {
      // 브라우저 탭이 뒤에 있거나 창이 최소화됐으면 읽지 않는다.
      if (document.hidden) return;
      // 앞선 요청이 아직 안 끝났으면(느린 회선) 겹쳐 쏘지 않는다.
      if (pollBusyRef.current || pollRunningRef.current) return;

      pollRunningRef.current = true;
      try {
        const students = await fetchCells(selectedId, true);
        if (!students) return;
        setCells(students);
        setActivities((prev) => prev.map((activity) => (
          activity.id === selectedId ? { ...activity, ...countCells(students) } : activity
        )));
      } finally {
        pollRunningRef.current = false;
      }
    };

    // 다른 탭에 갔다 돌아왔을 때는 다음 주기를 기다리지 않고 바로 맞춘다.
    const onVisibilityChange = () => { if (!document.hidden) refresh(); };

    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /**
   * 새로고침 버튼 — 활동 목록과 함께, 펼쳐둔 활동의 학생 카드까지 다시 읽는다.
   * 활동만 갱신하면 "제출 4/25"로 숫자는 늘었는데 카드 색은 그대로인 어긋난 화면이 된다.
   */
  const refreshNow = async () => {
    await Promise.all([
      loadActivities(),
      selectedId ? loadCells(selectedId) : Promise.resolve(),
    ]);
  };

  const selectActivity = (activityId: string) => {
    if (selectedId === activityId) {
      setSelectedId('');
      setCells([]);
      return;
    }
    setSelectedId(activityId);
    loadCells(activityId);
  };

  // ── 활동 생성·수정·삭제 ──────────────────────────────────────────

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api(`/api/learning/activities/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) });
        setMessage('활동을 수정했습니다.');
      } else {
        await api('/api/learning/activities', { method: 'POST', body: JSON.stringify({ ...form, classId }) });
        setMessage('활동을 만들었습니다.');
      }
      setForm(EMPTY_FORM);
      setFormOpen(false);
      setEditingId('');
      await loadActivities();
      if (editingId && selectedId === editingId) await loadCells(editingId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      notifyLater();
    }
  };

  const startEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setForm({
      subject: activity.subject,
      unit: activity.unit,
      title: activity.title,
      reflectionQuestions: [...activity.learning_activity_questions]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((q) => q.question),
    });
    setFormOpen(true);
  };

  const removeActivity = async (activity: Activity) => {
    const ok = await confirm({
      title: '활동을 삭제할까요?',
      message: `"${activity.title}" 활동과 학생 제출물·결과물 파일이 모두 삭제됩니다.\n되돌릴 수 없습니다.`,
      confirmText: '삭제',
    });
    if (!ok) return;

    try {
      await api(`/api/learning/activities/${activity.id}`, { method: 'DELETE' });
      setMessage('활동을 삭제했습니다.');
      if (selectedId === activity.id) {
        setSelectedId('');
        setCells([]);
      }
      await loadActivities();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      notifyLater();
    }
  };

  // ── 피드백 ──────────────────────────────────────────────────────

  const openDetail = (cell: StudentCell) => {
    setOpenCell(cell);
    setFeedback(cell.submission?.feedback_text ?? '');
    setModalError('');
    setProxyLinkOpen(false);
    setProxyLinkUrl('');
    setProxyLinkLabel('');
  };

  const saveFeedback = async () => {
    if (!openCell?.submission) return;
    setFeedbackSaving(true);
    setModalError('');
    try {
      await api(`/api/learning/submissions/${openCell.submission.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      });
      await loadCells(selectedId);
      await loadActivities();
      setOpenCell(null);
      setMessage('피드백을 저장했습니다.');
      notifyLater();
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setFeedbackSaving(false);
    }
  };

  const removeFeedback = async () => {
    if (!openCell?.submission) return;
    setFeedbackSaving(true);
    setModalError('');
    try {
      await api(`/api/learning/submissions/${openCell.submission.id}/feedback`, { method: 'DELETE' });
      await loadCells(selectedId);
      await loadActivities();
      setOpenCell(null);
      setMessage('피드백을 지웠습니다. 학생이 다시 고칠 수 있습니다.');
      notifyLater();
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setFeedbackSaving(false);
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

  // ── 대리 업로드 ──────────────────────────────────────────────────

  const startProxyUpload = (cell: StudentCell) => {
    setProxyTarget(cell);
    proxyInputRef.current?.click();
  };

  const uploadProxyFile = async (file: File) => {
    if (!proxyTarget || !selectedId) return;
    const currentCount = proxyTarget.submission?.files.length ?? 0;

    const rejection = checkLearningFile({ type: file.type, size: file.size }, currentCount);
    if (rejection) {
      setError(rejection);
      notifyLater();
      return;
    }

    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('studentId', proxyTarget.student.id);
      form.append('file', file);
      await api(`/api/learning/activities/${selectedId}/proxy-files`, { method: 'POST', body: form });
      await loadCells(selectedId);
      await loadActivities();
      setMessage(`${proxyTarget.student.name} 학생의 결과물을 대신 올렸습니다.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setProxyTarget(null);
      if (proxyInputRef.current) proxyInputRef.current.value = '';
      notifyLater();
    }
  };

  const addProxyLink = async () => {
    if (!openCell || !selectedId) return;
    const currentCount = openCell.submission?.links.length ?? 0;

    const rejection = checkLearningLink(proxyLinkUrl, currentCount);
    if (rejection) {
      setModalError(rejection);
      return;
    }

    setProxyLinkSaving(true);
    setModalError('');
    try {
      await api(`/api/learning/activities/${selectedId}/proxy-links`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: openCell.student.id,
          url: proxyLinkUrl,
          label: proxyLinkLabel || undefined,
        }),
      });
      const data = await api<{ students: StudentCell[] }>(
        `/api/learning/activities/${selectedId}/submissions`,
        { cache: 'no-store' }
      );
      setCells(data.students);
      // 열려 있는 카드도 새 내용으로 바꿔 준다 — 닫았다 다시 열지 않아도 링크가 보인다.
      setOpenCell(data.students.find((cell) => cell.student.id === openCell.student.id) ?? null);
      await loadActivities();
      setProxyLinkUrl('');
      setProxyLinkLabel('');
      setProxyLinkOpen(false);
      setMessage(`${openCell.student.name} 학생의 링크를 대신 등록했습니다.`);
      notifyLater();
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setProxyLinkSaving(false);
    }
  };

  // ── 렌더 ────────────────────────────────────────────────────────

  const visibleActivities = subjectFilter === 'all'
    ? activities
    : activities.filter((a) => a.subject === subjectFilter);

  const subjectsInUse = [...new Set(activities.map((a) => a.subject))];
  const selected = activities.find((a) => a.id === selectedId) ?? null;
  const activityQuestions = [...(selected?.learning_activity_questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  if (!classId) {
    return (
      <section className="card">
        <EmptyState title="학급을 먼저 선택해주세요" description="학급을 고르면 배움성찰 활동을 만들 수 있습니다." />
      </section>
    );
  }

  return (
    <section className="card learning-dashboard">
      <div className="learning-dashboard-header">
        <div className="learning-dashboard-heading">
          <span className="learning-dashboard-kicker">LEARNING REFLECTION</span>
          <h2>배움성찰</h2>
          <p>학생의 결과물과 생각을 모아 배움의 과정을 살펴봅니다.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <RefreshButton onClick={refreshNow} />
          <button
            type="button"
            className="ghost"
            style={{ width: 'auto' }}
            onClick={() => {
              setEditingId('');
              setForm(EMPTY_FORM);
              setFormOpen((open) => !open);
            }}
          >
            {formOpen ? '닫기' : '새 활동 만들기'}
          </button>
        </div>
      </div>

      {message && <Notice type="success" message={message} />}
      {error && <Notice type="error" message={error} />}

      <div className="learning-summary" aria-label="배움성찰 현황">
        <div><span aria-hidden="true">📚</span><small>전체 활동</small><strong>{activities.length}</strong></div>
        <div><span aria-hidden="true">✍️</span><small>선택 활동 제출</small><strong>{selected ? `${selected.submittedCount}/${totalStudents}` : '—'}</strong></div>
        <div><span aria-hidden="true">💬</span><small>선택 활동 피드백</small><strong>{selected?.reviewedCount ?? '—'}</strong></div>
      </div>

      <div className="notice info learning-dashboard-guide">
        활동을 열면 학생이 결과물과 성찰을 남깁니다. 피드백은 필요한 학생에게만 선택적으로 남길 수 있습니다.
      </div>

      {/* 활동 생성·수정 폼 */}
      {formOpen && (
        <form className="student-add-form learning-activity-form" onSubmit={submitForm}>
          <div className="learning-form-heading">
            <span aria-hidden="true">✦</span>
            <div><strong>{editingId ? '활동 수정' : '새 배움 활동'}</strong><p>학생에게 제시할 활동과 성찰 질문을 입력합니다.</p></div>
          </div>
          <div className="grid two" style={{ gap: 10 }}>
            <label>
              과목
              <select
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              >
                {SUBJECT_LIST.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </label>
            <label>
              단원
              <input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="예: 3. 소수의 나눗셈"
                maxLength={60}
              />
            </label>
          </div>
          <label>
            활동명
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="예: 소수 나눗셈 문제 만들기"
              maxLength={80}
            />
          </label>
          {/* 성찰 질문 — 필요한 만큼 추가할 수 있다 */}
          <div>
            <div className="row space-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                성찰 질문 ({form.reflectionQuestions.length}/{MAX_QUESTIONS_PER_ACTIVITY})
              </span>
              <button
                type="button"
                className="outline"
                style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
                onClick={() => setForm((f) => ({
                  ...f,
                  reflectionQuestions: [
                    ...f.reflectionQuestions,
                    SUGGESTED_QUESTIONS[f.reflectionQuestions.length] ?? '',
                  ],
                }))}
                disabled={form.reflectionQuestions.length >= MAX_QUESTIONS_PER_ACTIVITY}
              >
                + 질문 추가
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.reflectionQuestions.map((question, index) => (
                <div key={index} className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                    display: 'grid', placeItems: 'center',
                    background: '#ede9fe', color: '#6d5bc5', fontSize: 11, fontWeight: 800,
                  }}>
                    {index + 1}
                  </span>
                  <input
                    value={question}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      reflectionQuestions: f.reflectionQuestions.map((q, i) => (i === index ? e.target.value : q)),
                    }))}
                    placeholder="예: 이번 활동에서 잘한 점은 무엇인가요?"
                    maxLength={200}
                    style={{ flex: 1 }}
                  />
                  {/* 질문이 하나뿐일 땐 지울 수 없다 — 질문 없는 활동은 만들 수 없기 때문 */}
                  <button
                    type="button"
                    className="outline"
                    style={{ width: 'auto', flexShrink: 0, fontSize: 12, padding: '4px 9px' }}
                    onClick={() => setForm((f) => ({
                      ...f,
                      reflectionQuestions: f.reflectionQuestions.filter((_, i) => i !== index),
                    }))}
                    disabled={form.reflectionQuestions.length <= 1}
                    aria-label={`${index + 1}번 질문 삭제`}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            {editingId && (
              <p className="hint" style={{ margin: '6px 0 0', color: '#b45309' }}>
                질문을 수정하면 학생이 이미 쓴 답변이 함께 지워집니다.
              </p>
            )}
          </div>
          <button type="submit" disabled={saving}>
            {saving ? '저장 중...' : editingId ? '활동 수정' : '활동 만들기'}
          </button>
        </form>
      )}

      {/* 과목 필터 */}
      {subjectsInUse.length > 1 && (
        <div className="eval-subject-tabs" role="group" aria-label="과목 선택" style={{ marginBottom: 12 }}>
          {['all', ...subjectsInUse].map((key) => {
            const isActive = subjectFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                className={`eval-subject-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setSubjectFilter(key)}
              >
                <span className="eval-subject-icon" aria-hidden="true">{key === 'all' ? '✨' : '📚'}</span>
                <span>{key === 'all' ? '전체' : key}</span>
              </button>
            );
          })}
        </div>
      )}

      {!loaded ? (
        <p className="hint">불러오는 중...</p>
      ) : activities.length === 0 ? (
        <EmptyState
          title="아직 활동이 없습니다"
          description="새 활동 만들기를 눌러 과목·단원·활동명·성찰 질문을 등록하세요."
        />
      ) : (
        <div className="learning-activity-list">
          {visibleActivities.map((activity) => {
            const accent = SUBJECT_COLOR[activity.subject] ?? DEFAULT_SUBJECT_COLOR;
            const isSelected = selectedId === activity.id;
            return (
              <div
                key={activity.id}
                className={`learning-activity-card${isSelected ? ' is-selected' : ''}`}
                style={{ '--learning-accent': accent } as CSSProperties}
              >
                <span className="learning-card-star learning-card-star-one" aria-hidden="true">✦</span>
                <span className="learning-card-star learning-card-star-two" aria-hidden="true">★</span>
                <div className="learning-activity-card-head">
                  <button
                    type="button"
                    onClick={() => selectActivity(activity.id)}
                    className="learning-activity-toggle"
                    aria-expanded={isSelected}
                    aria-controls={`learning-students-${activity.id}`}
                  >
                    <span className="learning-activity-subject">{activity.subject}</span>
                    <span className="learning-activity-copy">
                      <strong>{activity.title}</strong>
                      <span>{activity.unit || '단원 정보 없음'} · {formatShort(activity.created_at)} 등록</span>
                    </span>
                    <span className="learning-activity-metrics">
                      <span><small>제출</small><strong>{activity.submittedCount}/{totalStudents}</strong></span>
                      <span><small>피드백</small><strong>{activity.reviewedCount}</strong></span>
                    </span>
                    <span className={`learning-activity-chevron${isSelected ? ' is-open' : ''}`} aria-hidden="true">⌄</span>
                  </button>
                  <div className="learning-activity-actions">
                    <button type="button" className="outline" style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }} onClick={() => startEdit(activity)}>수정</button>
                    <button type="button" className="outline" style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }} onClick={() => removeActivity(activity)}>삭제</button>
                  </div>
                </div>

                {/* 학생 카드 그리드 */}
                {isSelected && (
                  <div className="learning-student-panel" id={`learning-students-${activity.id}`}>
                    <div className="learning-student-panel-heading">
                      <div><span aria-hidden="true">✦</span><strong>학생 배움 기록</strong></div>
                      <small>학생 카드를 눌러 결과물과 성찰을 확인하세요.</small>
                    </div>
                    {cellsLoading ? (
                      <p className="hint" style={{ margin: 0 }}>불러오는 중...</p>
                    ) : cells.length === 0 ? (
                      <p className="hint" style={{ margin: 0 }}>이 학급에 등록된 학생이 없습니다.</p>
                    ) : (
                      <div className="learning-student-grid">
                        {cells.map((cell) => {
                          const tone = STATUS_COLOR[cell.status];
                          return (
                            <button
                              key={cell.student.id}
                              type="button"
                              onClick={() => openDetail(cell)}
                              className="learning-student-cell"
                              style={{
                                width: '100%',
                                display: 'flex', flexDirection: 'column', gap: 2,
                                alignItems: 'flex-start', textAlign: 'left',
                                padding: '8px 10px', borderRadius: 10,
                                border: `1px solid ${tone.border}`,
                                background: tone.bg,
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>
                                {cell.student.student_number}. {cell.student.name}
                              </span>
                              {/* 색만으로 구분하지 않도록 상태 라벨을 항상 함께 표시 */}
                              <span style={{ fontSize: 11, fontWeight: 700, color: tone.text }}>
                                {TEACHER_STATUS_LABEL[cell.status]}
                              </span>
                              {cell.submission?.submitted_by === 'teacher' && (
                                <span style={{ fontSize: 10, color: '#78350f' }}>교사 대리 업로드</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 대리 업로드용 숨은 입력 */}
      <input
        ref={proxyInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadProxyFile(file);
        }}
      />

      {/* 제출물 상세 + 피드백 */}
      {openCell && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setOpenCell(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div className="learning-detail-modal">
            <div className="learning-detail-header">
              <div className="row space-between">
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    {selected?.subject} · {selected?.unit}
                  </p>
                  <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>
                    {openCell.student.student_number}. {openCell.student.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                    {selected && `활동 등록 ${formatDay(selected.created_at)}`}
                    {openCell.submission?.submitted_at && ` · 제출 ${formatDay(openCell.submission.submitted_at)}`}
                    {openCell.submission?.feedback_updated_at && ` · 피드백 ${formatDay(openCell.submission.feedback_updated_at)}`}
                  </p>
                </div>
                <button type="button" className="outline" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setOpenCell(null)}>닫기</button>
              </div>
            </div>

            <div className="learning-detail-body">
              {modalError && <Notice type="error" message={modalError} />}

              <div>
                <div className="row space-between" style={{ marginBottom: 6, gap: 6 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#374151' }}>결과물</p>
                  {/* 대리 등록 — 미제출 학생의 자료를 교사가 대신 올린다 */}
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
                      onClick={() => { const target = openCell; setOpenCell(null); startProxyUpload(target); }}
                      disabled={uploading || (openCell.submission?.files.length ?? 0) >= MAX_FILES_PER_SUBMISSION}
                    >
                      사진·PDF 대신 올리기
                    </button>
                    <button
                      type="button"
                      className="outline"
                      style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setProxyLinkOpen((open) => !open)}
                      disabled={(openCell.submission?.links.length ?? 0) >= MAX_LINKS_PER_SUBMISSION}
                    >
                      🔗 링크 대신 등록
                    </button>
                  </div>
                </div>

                {proxyLinkOpen && (
                  <div style={{
                    marginBottom: 10, padding: '10px 12px', borderRadius: 12,
                    border: '1px solid #ddd6fe', background: '#faf9ff',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <input
                      value={proxyLinkUrl}
                      onChange={(e) => setProxyLinkUrl(e.target.value)}
                      placeholder="https:// 로 시작하는 주소"
                      maxLength={2000}
                    />
                    <input
                      value={proxyLinkLabel}
                      onChange={(e) => setProxyLinkLabel(e.target.value)}
                      placeholder="이름 (선택)"
                      maxLength={60}
                    />
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: 'auto' }}
                        onClick={addProxyLink}
                        disabled={proxyLinkSaving || proxyLinkUrl.trim().length === 0}
                      >
                        {proxyLinkSaving ? '등록 중...' : '링크 등록'}
                      </button>
                      <button
                        type="button"
                        className="outline"
                        style={{ width: 'auto' }}
                        onClick={() => { setProxyLinkOpen(false); setProxyLinkUrl(''); setProxyLinkLabel(''); }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
                {!openCell.submission || (openCell.submission.files.length === 0 && openCell.submission.links.length === 0) ? (
                  <p className="hint" style={{ margin: 0 }}>제출된 결과물이 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* 사진은 썸네일로 미리 보고, 누르면 원본을 새 탭으로 엽니다 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
                      {openCell.submission.files.map((file) => {
                        const isImage = isPreviewableImage(file.mime_type) && file.url;
                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => openFile(file.id)}
                            title={file.file_name}
                            style={{
                              width: '100%', padding: 0, textAlign: 'left',
                              borderRadius: 10, overflow: 'hidden',
                              border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer',
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
                              <span style={{ display: 'grid', placeItems: 'center', height: 88, fontSize: 28, background: '#eef2ff' }}>📄</span>
                            )}
                            <span style={{
                              display: 'block', padding: '5px 7px', fontSize: 11, color: '#475569',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {file.file_name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {openCell.submission.links.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {openCell.submission.links.map((link) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '8px 10px', borderRadius: 10,
                              border: '1px solid #e2e8f0', background: '#f8fafc',
                              color: '#4f46e5', fontSize: 13, fontWeight: 600,
                              textDecoration: 'none',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            🔗 {link.label || link.url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 질문마다 그 아래에 답을 붙여, 무엇에 답한 것인지 바로 보이게 한다 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(openCell.submission?.answers ?? activityQuestions.map((q) => ({
                  questionId: q.id, question: q.question, answer: '',
                }))).map((row, index) => (
                  <div key={row.questionId} style={{ borderRadius: 12, border: '1px solid #ddd6fe', overflow: 'hidden' }}>
                    <div style={{ padding: '9px 13px', background: '#f5f3ff', borderBottom: '1px solid #ddd6fe' }}>
                      <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 800, color: '#7c6bd6', letterSpacing: '0.02em' }}>
                        성찰 질문 {index + 1}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#312e81', fontWeight: 600 }}>
                        {row.question}
                      </p>
                    </div>
                    <div style={{ padding: '11px 13px' }}>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                        {row.answer.trim() || <span className="hint">작성된 답변이 없습니다.</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: '#374151' }}>피드백 (선택)</p>
                {!openCell.submission ? (
                  <p className="hint" style={{ margin: 0 }}>제출물이 있어야 피드백을 남길 수 있습니다.</p>
                ) : (
                  <>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
                      rows={4}
                      placeholder="학생에게 전할 의견을 적어주세요. 남기지 않아도 됩니다."
                      style={{ width: '100%' }}
                    />
                    <p className="hint" style={{ margin: '4px 0 8px' }}>
                      {feedback.length}/{MAX_FEEDBACK_LENGTH}자 · 피드백을 저장하면 학생은 결과물과 성찰을 고칠 수 없습니다.
                    </p>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: 'auto' }}
                        onClick={saveFeedback}
                        disabled={feedbackSaving || feedback.trim().length === 0}
                      >
                        {feedbackSaving ? '저장 중...' : '피드백 저장'}
                      </button>
                      {openCell.submission.feedback_text && (
                        <button
                          type="button"
                          className="outline"
                          style={{ width: 'auto' }}
                          onClick={removeFeedback}
                          disabled={feedbackSaving}
                        >
                          피드백 삭제
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </section>
  );
}
