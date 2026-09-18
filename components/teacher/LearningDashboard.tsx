'use client';

/**
 * LearningDashboard — 교사 "배움성찰" 탭.
 *
 * 왼쪽에서 활동을 만들고 고르면, 오른쪽에 학급 전체 학생이 카드로 깔립니다.
 * 카드 색이 상태(미제출·제출 완료·평가 대기·피드백 완료)를 나타내되, 색만으로 구분하지 않도록
 * 카드마다 상태 라벨을 함께 씁니다.
 *
 * 교사는 활동마다 평가요소(문장 + 잘함/보통/노력요함 기준)를 적습니다. 교사가 적은 평가요소 문장이
 * 학생 화면에서는 그대로 성찰 질문이 됩니다. 제출물마다 요소별 등급을 매기고, 모두 매기면 피드백 완료가 됩니다.
 * 이 방식 전에 만든 활동의 일반 성찰 질문은 수정할 때 "기존 성찰 질문"으로 그대로 남습니다.
 * 서술 피드백은 선택 사항입니다. 쓰지 않은 학생에게 미완료 경고를 표시하지 않습니다.
 * 상태 판정과 파일 규칙은 lib/learning.ts 한 곳에서 가져옵니다.
 */
import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import RefreshButton from '@/components/ui/RefreshButton';
import { useConfirm } from '@/components/ui/useConfirm';
import { SUBJECT_LIST, SUBJECT_COLOR, DEFAULT_SUBJECT_COLOR } from '@/lib/subjects';
import { api } from '@/lib/api-client';
import { shrinkImageForUpload } from '@/lib/image-upload';
import {
  LearningStatus,
  TEACHER_STATUS_LABEL,
  TEACHER_IN_PROGRESS_LABEL,
  STATUS_COLOR,
  IN_PROGRESS_COLOR,
  MAX_FEEDBACK_LENGTH,
  MAX_FILES_PER_SUBMISSION,
  MAX_FILE_BYTES,
  MAX_QUESTIONS_PER_ACTIVITY,
  MAX_LINKS_PER_SUBMISSION,
  checkLearningFile,
  checkLearningLink,
  isPreviewableImage,
  isCriterionQuestion,
  GRADE_LABEL,
  GRADE_COLOR,
  MAX_CRITERION_TITLE_LENGTH,
  MAX_LEVEL_LENGTH,
  type Grade,
} from '@/lib/learning';
import { GradePicker } from '@/components/learning/GradeParts';

// ── Types ──────────────────────────────────────────────────────────

type Question = {
  id: string;
  question: string;
  sort_order: number;
  criterion_title: string | null;
  level_high: string | null;
  level_mid: string | null;
  level_low: string | null;
};

type Activity = {
  id: string;
  subject: string;
  unit: string;
  title: string;
  created_at: string;
  learning_activity_questions: Question[];
  submittedCount: number;
  gradingCount: number;
  reviewedCount: number;
  /** 교사 등급이 생겨 평가요소를 바꿀 수 없는 활동 */
  gradingStarted: boolean;
};

type SubmissionFile = { id: string; file_name: string; mime_type: string; sort_order: number; url: string | null };
type SubmissionLink = { id: string; url: string; label: string | null; sort_order: number };
type AnswerCriterion = {
  title: string;
  levelHigh: string | null;
  levelMid: string | null;
  levelLow: string | null;
  teacherGrade: Grade | null;
  teacherComment: string | null;
};
type AnswerRow = { questionId: string; question: string; answer: string; criterion: AnswerCriterion | null };

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
  /** 미제출이지만 답·결과물 중 하나라도 남겼는지 */
  inProgress?: boolean;
  submission: Submission | null;
};

/** 활동을 펼쳐 학생 카드를 보고 있는 동안 제출 현황을 다시 읽는 주기 */
const POLL_INTERVAL_MS = 15_000;

/**
 * 학생 카드에서 활동 카드의 집계를 다시 센다.
 * 서버(app/api/learning/activities/route.ts)와 같은 셈법이라야 새로고침 결과와 어긋나지 않는다.
 * submitted = 제출 + 평가 대기 + 피드백 완료, grading = 평가 대기, reviewed = 피드백 완료.
 */
const countCells = (students: StudentCell[]) => ({
  submittedCount: students.filter((cell) => cell.status !== 'none').length,
  gradingCount: students.filter((cell) => cell.status === 'grading').length,
  reviewedCount: students.filter((cell) => cell.status === 'reviewed').length,
});

/**
 * 폼의 평가요소 한 줄. 교사가 적은 문장(text)이 평가요소 이름이자 학생에게 보이는 성찰 질문이다.
 * legacy는 이 방식 전에 만든 일반 성찰 질문 — 수정할 때 평가요소로 바꾸지 않고 그대로 둔다.
 */
type FormItem = { text: string; levelHigh: string; levelMid: string; levelLow: string; legacy: boolean };

const EMPTY_ITEM: FormItem = { text: '', levelHigh: '', levelMid: '', levelLow: '', legacy: false };

const EMPTY_FORM = {
  subject: SUBJECT_LIST[0] as string,
  unit: '',
  title: '',
  // 처음에는 빈 평가요소 하나로 시작하고, 교사가 "평가요소 추가"로 늘린다.
  items: [EMPTY_ITEM] as FormItem[],
};

/** 저장된 질문을 폼 값으로 바꾼다 — 수정·지난 활동 불러오기에서 쓴다. */
const toFormItems = (questions: Question[]): FormItem[] =>
  [...questions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((q) => ({
      text: q.question,
      levelHigh: q.level_high ?? '',
      levelMid: q.level_mid ?? '',
      levelLow: q.level_low ?? '',
      legacy: !isCriterionQuestion(q),
    }));

/** 폼 값을 API 입력으로 바꾼다. 평가요소는 문장 하나를 질문과 요소 이름에 함께 쓴다. */
const toQuestionPayload = (items: FormItem[]) =>
  items.map((item) => (item.legacy
    ? { question: item.text, criterion: null }
    : {
        question: item.text,
        criterion: { title: item.text, levelHigh: item.levelHigh, levelMid: item.levelMid, levelLow: item.levelLow },
      }));

const LEVEL_FIELDS = [
  { key: 'levelHigh', grade: 'high' },
  { key: 'levelMid', grade: 'mid' },
  { key: 'levelLow', grade: 'low' },
] as const;

type GradeDraft = Record<string, { grade: Grade | null; comment: string }>;

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
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>({});
  const [gradesSaving, setGradesSaving] = useState(false);
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
    || saving || feedbackSaving || gradesSaving || uploading || proxyLinkSaving;
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
    const { items, ...rest } = form;
    const payload = { ...rest, reflectionQuestions: toQuestionPayload(items) };
    try {
      if (editingId) {
        await api(`/api/learning/activities/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setMessage('활동을 수정했습니다.');
      } else {
        await api('/api/learning/activities', { method: 'POST', body: JSON.stringify({ ...payload, classId }) });
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
      items: toFormItems(activity.learning_activity_questions),
    });
    setFormOpen(true);
  };

  /** 평가요소 한 줄을 바꾼다 — 폼의 평가요소 카드들이 같이 쓴다. */
  const updateItem = (index: number, patch: Partial<FormItem>) => setForm((f) => ({
    ...f,
    items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
  }));

  /** 같은 학급의 지난 활동에서 평가요소를 복사해 온다(원본과 연결되지 않는 복사본). */
  const importQuestions = (activityId: string) => {
    const source = activities.find((a) => a.id === activityId);
    if (!source) return;
    setForm((f) => ({ ...f, items: toFormItems(source.learning_activity_questions) }));
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
    const draft: GradeDraft = {};
    (cell.submission?.answers ?? []).forEach((row) => {
      if (row.criterion) draft[row.questionId] = { grade: row.criterion.teacherGrade, comment: row.criterion.teacherComment ?? '' };
    });
    setGradeDraft(draft);
    setModalError('');
    setProxyLinkOpen(false);
    setProxyLinkUrl('');
    setProxyLinkLabel('');
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

  /** 요소별 등급과 최종 피드백을 한 번의 동작으로 저장한다. 과거 요소별 코멘트는 그대로 보존한다. */
  const saveEvaluation = async () => {
    if (!openCell?.submission) return;
    setGradesSaving(true);
    setModalError('');
    try {
      await api(`/api/learning/submissions/${openCell.submission.id}/grades`, {
        method: 'PUT',
        body: JSON.stringify({
          grades: Object.entries(gradeDraft).map(([questionId, item]) => ({
            questionId,
            grade: item.grade,
            comment: item.comment.trim() || null,
          })),
        }),
      });
      await api(`/api/learning/submissions/${openCell.submission.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      });
      await loadCells(selectedId);
      await loadActivities();
      setOpenCell(null);
      setMessage('등급과 최종 피드백을 저장했습니다.');
      notifyLater();
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setGradesSaving(false);
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

  const uploadProxyFile = async (rawFile: File) => {
    if (!proxyTarget || !selectedId) return;
    const currentCount = proxyTarget.submission?.files.length ?? 0;

    setUploading(true);
    setError('');
    try {
      // 휴대폰 사진은 한 장이 용량 한도를 넘기 쉬우므로 검사 전에 줄인다.
      const file = await shrinkImageForUpload(rawFile, MAX_FILE_BYTES);

      const rejection = checkLearningFile({ type: file.type, size: file.size }, currentCount);
      if (rejection) {
        setError(rejection);
        return;
      }

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
  const editingActivity = activities.find((a) => a.id === editingId) ?? null;
  // 평가가 시작된 활동은 질문·평가요소를 잠근다(라우트도 409로 막는다).
  const questionsLocked = Boolean(
    editingActivity?.gradingStarted && editingActivity.learning_activity_questions.some(isCriterionQuestion),
  );
  const importSources = activities.filter((a) => a.id !== editingId && a.learning_activity_questions.length > 0);

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
        <div><span aria-hidden="true">💬</span><small>선택 활동 평가 대기·완료</small><strong>{selected ? `${selected.gradingCount} · ${selected.reviewedCount}` : '—'}</strong></div>
      </div>

      <div className="notice info learning-dashboard-guide">
        활동을 열면 학생이 결과물과 성찰을 남깁니다. 교사가 적은 평가요소는 학생에게 성찰 질문으로 보이고, 교사는 요소별 등급을 남깁니다. 서술 피드백은 필요한 학생에게만 선택적으로 남길 수 있습니다.
      </div>

      {/* 활동 생성·수정 폼 */}
      {formOpen && (
        <form className="student-add-form learning-activity-form" onSubmit={submitForm}>
          <div className="learning-form-heading">
            <span aria-hidden="true">✦</span>
            <div><strong>{editingId ? '활동 수정' : '새 배움 활동'}</strong><p>학생에게 제시할 활동과 평가요소를 입력합니다. 평가요소 문장은 학생에게 성찰 질문으로 보입니다.</p></div>
          </div>
          <div className="learning-form-section">
            <div className="learning-form-section-heading">
              <span aria-hidden="true">1</span>
              <div><strong>활동 기본 정보</strong><p>학생이 활동을 쉽게 찾을 수 있도록 과목과 제목을 입력합니다.</p></div>
            </div>
            <div className="grid two learning-form-basics">
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
          </div>
          {/* 평가요소 — 교사가 적은 문장이 학생에게는 그대로 성찰 질문이 된다 */}
          <div className="learning-form-section">
            <div className="learning-form-section-heading learning-form-section-heading-actions">
              <span aria-hidden="true">2</span>
              <div><strong>평가요소</strong><p>학생에게는 성찰 질문으로 표시됩니다. ({form.items.length}/{MAX_QUESTIONS_PER_ACTIVITY})</p></div>
              <div className="row" style={{ gap: 6 }}>
                {importSources.length > 0 && !questionsLocked && (
                  <select
                    value=""
                    onChange={(e) => importQuestions(e.target.value)}
                    aria-label="지난 활동에서 평가요소 불러오기"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                  >
                    <option value="">지난 활동에서 불러오기</option>
                    {importSources.map((a) => (
                      <option key={a.id} value={a.id}>{a.subject} · {a.title}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="outline"
                  style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))}
                  disabled={questionsLocked || form.items.length >= MAX_QUESTIONS_PER_ACTIVITY}
                >
                  + 평가요소 추가
                </button>
              </div>
            </div>

            <p className="hint" style={{ margin: '0 0 6px' }}>
              학생에게는 평가요소 문장이 그대로 성찰 질문으로 보입니다. 학생이 읽고 답할 수 있는 문장으로 적어주세요.
            </p>

            {questionsLocked && (
              <p className="hint" style={{ margin: '0 0 6px', color: '#b45309' }}>
                이미 평가가 시작된 활동은 평가요소를 바꿀 수 없습니다.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.items.map((item, index) => (
                <fieldset
                  key={index}
                  disabled={questionsLocked}
                  className={`learning-question-card${item.legacy ? '' : ' is-criterion'}`}
                  style={{ margin: 0, minWidth: 0 }}
                >
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                      display: 'grid', placeItems: 'center',
                      background: '#ede9fe', color: '#6d5bc5', fontSize: 11, fontWeight: 800,
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.legacy ? '#64748b' : '#6d5bc5' }}>
                      {item.legacy ? '기존 성찰 질문 (평가요소 아님)' : '평가요소'}
                    </span>
                    {/* 하나뿐일 땐 지울 수 없다 — 질문 없는 활동은 만들 수 없기 때문 */}
                    <button
                      type="button"
                      className="outline"
                      style={{ width: 'auto', flexShrink: 0, marginLeft: 'auto', fontSize: 12, padding: '4px 9px' }}
                      onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}
                      disabled={form.items.length <= 1}
                      aria-label={`${index + 1}번 평가요소 삭제`}
                    >
                      삭제
                    </button>
                  </div>

                  <input
                    value={item.text}
                    onChange={(e) => updateItem(index, { text: e.target.value })}
                    placeholder={item.legacy ? '예: 이번 활동에서 잘한 점은 무엇인가요?' : '예: 소수의 나눗셈을 정확히 계산했나요?'}
                    maxLength={item.legacy ? 200 : MAX_CRITERION_TITLE_LENGTH}
                    aria-label={`${index + 1}번 ${item.legacy ? '성찰 질문' : '평가요소'}`}
                  />

                  {!item.legacy && (
                    <div className="learning-criterion-levels">
                      {LEVEL_FIELDS.map(({ key, grade }) => (
                        <label
                          key={key}
                          className="learning-criterion-level"
                          style={{
                            '--grade-color': GRADE_COLOR[grade].text,
                            '--grade-soft': GRADE_COLOR[grade].bg,
                          } as CSSProperties}
                        >
                          <span className="learning-criterion-level-badge">{GRADE_LABEL[grade]} 기준</span>
                          <input
                            value={item[key]}
                            onChange={(e) => updateItem(index, { [key]: e.target.value })}
                            placeholder="선택"
                            maxLength={MAX_LEVEL_LENGTH}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              ))}
            </div>

            {editingId && !questionsLocked && (
              <p className="hint" style={{ margin: '6px 0 0', color: '#b45309' }}>
                평가요소를 수정하면 학생이 이미 쓴 답변이 함께 지워집니다.
              </p>
            )}
          </div>
          <div className="learning-form-submit">
            <p><span aria-hidden="true">✦</span> 입력한 내용은 학생의 배움성찰 화면에 바로 표시됩니다.</p>
            <button type="submit" disabled={saving}>
              {saving ? '저장 중...' : editingId ? '활동 수정' : '활동 만들기'}
            </button>
          </div>
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
          description="새 활동 만들기를 눌러 과목·단원·활동명·평가요소를 등록하세요."
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
                      {activity.learning_activity_questions.some(isCriterionQuestion) && (
                        <span><small>평가 대기</small><strong>{activity.gradingCount}</strong></span>
                      )}
                      <span><small>완료</small><strong>{activity.reviewedCount}</strong></span>
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
                          const tone = cell.inProgress ? IN_PROGRESS_COLOR : STATUS_COLOR[cell.status];
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
                                {cell.inProgress ? TEACHER_IN_PROGRESS_LABEL : TEACHER_STATUS_LABEL[cell.status]}
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
                {(openCell.submission?.answers ?? activityQuestions.map((q): AnswerRow => ({
                  questionId: q.id, question: q.question, answer: '', criterion: null,
                }))).map((row, index) => (
                  <div key={row.questionId} style={{ borderRadius: 12, border: '1px solid #ddd6fe', overflow: 'hidden' }}>
                    <div style={{ padding: '9px 13px', background: '#f5f3ff', borderBottom: '1px solid #ddd6fe' }}>
                      <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 800, color: '#7c6bd6', letterSpacing: '0.02em' }}>
                        {row.criterion ? '평가요소' : '성찰 질문'} {index + 1}
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

              {Object.keys(gradeDraft).length > 0 && openCell.submission && openCell.status !== 'none' && (
                <section className="learning-teacher-review-section" aria-label="교사 평가">
                  <div className="learning-teacher-review-heading">
                    <span aria-hidden="true">✦</span>
                    <div><strong>교사 평가</strong><p>학생의 자기점검을 확인한 뒤 평가요소별 등급을 선택합니다.</p></div>
                  </div>
                  <div className="learning-teacher-review-list">
                    {(openCell.submission.answers ?? []).filter((row) => row.criterion).map((row, index) => (
                      <div key={row.questionId} className="learning-teacher-evaluation">
                        <div className="learning-teacher-evaluation-heading">
                          <strong>{index + 1}. {row.criterion!.title}</strong>
                          <span>잘함·보통·노력요함 중 하나를 선택하세요.</span>
                        </div>
                        <GradePicker
                          value={gradeDraft[row.questionId]?.grade ?? null}
                          onChange={(grade) => setGradeDraft((d) => ({
                            ...d,
                            [row.questionId]: { comment: d[row.questionId]?.comment ?? '', grade },
                          }))}
                          labels={GRADE_LABEL}
                          levels={{ high: row.criterion!.levelHigh, mid: row.criterion!.levelMid, low: row.criterion!.levelLow }}
                          ariaLabel={`${row.criterion!.title} 교사 등급`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {Object.keys(gradeDraft).length > 0 && openCell.submission && openCell.status === 'none' && (
                <p className="hint" style={{ margin: 0 }}>제출이 끝나면 요소별 평가를 할 수 있습니다.</p>
              )}
              <div className="learning-teacher-feedback">
                <div className="learning-teacher-feedback-heading">
                  <strong>종합 피드백</strong>
                  <span>등급 평가를 마친 뒤 학생에게 전할 최종 의견을 입력합니다.</span>
                </div>
                {!openCell.submission ? (
                  <p className="hint" style={{ margin: 0 }}>제출물이 있어야 피드백을 남길 수 있습니다.</p>
                ) : (
                  <>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
                      rows={4}
                      placeholder="등급 평가를 종합해 학생에게 전할 최종 피드백을 적어주세요."
                      style={{ width: '100%' }}
                    />
                    <p className="hint" style={{ margin: '4px 0 8px' }}>
                      {feedback.length}/{MAX_FEEDBACK_LENGTH}자 · 모든 등급과 최종 피드백을 함께 저장합니다.
                    </p>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: 'auto' }}
                        onClick={saveEvaluation}
                        disabled={
                          gradesSaving
                          || feedbackSaving
                          || feedback.trim().length === 0
                          || Object.values(gradeDraft).some((item) => !item.grade)
                        }
                      >
                        {gradesSaving ? '전체 저장 중...' : '등급과 최종 피드백 저장'}
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
