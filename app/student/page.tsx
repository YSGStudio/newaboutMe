'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import PageHeader from '@/components/ui/PageHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import SubmitButton from '@/components/ui/SubmitButton';
import Tabs from '@/components/ui/Tabs';
import { formatDateInSeoul } from '@/lib/date';
import { EMOTION_CATEGORIES, EMOTION_META, EmotionType } from '@/types/domain';

type PlanRow = { id: string; title: string; isCompleted: boolean | null };
type PlanAchievementRow = {
  planId: string;
  title: string;
  completed: number;
  totalPossible: number;
  achievementRate: number;
};

type MyFeedRow = {
  id: string;
  emotion_type: EmotionType;
  content: string;
  image_url?: string | null;
  created_at: string;
} | null;

type EmotionDistributionItem = {
  emotionType: EmotionType;
  count: number;
  ratio: number;
};

type EmotionStats = {
  range: { startDate: string; endDate: string };
  totalFeeds: number;
  distribution: EmotionDistributionItem[];
} | null;

type EmotionChartItem = { key: string; label: string; count: number; ratio: number; color: string };

type PlanTitleHistory = { id: string; old_title: string; new_title: string; changed_at: string };

type Classmate = { id: string; name: string; student_number: number };

type ReceivedLetter = {
  id: string;
  title: string;
  is_read: boolean;
  created_at: string;
  sender_id: string;
  sender: Classmate | null;
};

type SentLetter = {
  id: string;
  title: string;
  created_at: string;
  recipient_id: string;
  recipient: Classmate | null;
};

type LetterDetail = {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender: Classmate | null;
  recipient: Classmate | null;
};

type EvalReportSummary = {
  id: string;
  title: string;
  created_at: string;
  eval_report_items: { id: string; grade: string; sort_order: number; rubric_title_snapshot: string }[];
  eval_report_images: { id: string; sort_order: number }[];
  eval_reflections: { id: string }[];
  eval_parent_comments: { id: string }[];
};

type EvalReportDetail = {
  id: string;
  title: string;
  created_at: string;
  eval_report_items: {
    id: string;
    rubric_title_snapshot: string;
    rubric_goal_snapshot: string | null;
    rubric_task_snapshot: string | null;
    rubric_level_high_snapshot: string | null;
    rubric_level_mid_snapshot: string | null;
    rubric_level_low_snapshot: string | null;
    criterion_title_snapshot: string | null;
    grade: 'high' | 'mid' | 'low';
    teacher_feedback: string | null;
    sort_order: number;
  }[];
  eval_report_images: { id: string; sort_order: number }[];
  eval_report_links: { id: string; url: string; label: string | null; sort_order: number }[];
  eval_reflections: { id: string; content: string; created_at: string }[];
  eval_parent_comments: { id: string; content: string; created_at: string }[];
};

const GRADE_LABEL: Record<'high' | 'mid' | 'low', string> = { high: '잘함', mid: '보통', low: '노력' };
const GRADE_COLOR: Record<'high' | 'mid' | 'low', string> = { high: '#16a34a', mid: '#d97706', low: '#dc2626' };

const donutColors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316', '#64748b'];
const otherEmotionColor = '#94a3b8';

const buildEmotionChartItems = (distribution: EmotionDistributionItem[]): EmotionChartItem[] => {
  const visibleItems = distribution.filter((item) => item.count > 0);
  const majorItems = visibleItems.filter((item) => item.ratio >= 5);
  const minorItems = visibleItems.filter((item) => item.ratio < 5);
  const minorCount = minorItems.reduce((sum, item) => sum + item.count, 0);
  const minorRatio = minorItems.reduce((sum, item) => sum + item.ratio, 0);

  const items: EmotionChartItem[] = majorItems.map((item, index) => ({
    key: item.emotionType,
    label: `${EMOTION_META[item.emotionType].categoryLabel} / ${EMOTION_META[item.emotionType].label}`,
    count: item.count,
    ratio: item.ratio,
    color: donutColors[index % donutColors.length]
  }));

  if (minorCount > 0) {
    items.push({ key: 'other', label: '기타', count: minorCount, ratio: minorRatio, color: otherEmotionColor });
  }

  return items.sort((a, b) => b.ratio - a.ratio);
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '요청 실패');
  return json;
};

const getTodayInSeoul = () => formatDateInSeoul(new Date());

export default function StudentPage() {
  const [studentName, setStudentName] = useState('');
  const [planDate, setPlanDate] = useState(getTodayInSeoul);
  const [emotionDate, setEmotionDate] = useState(getTodayInSeoul);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planAchievements, setPlanAchievements] = useState<PlanAchievementRow[]>([]);
  const [myFeed, setMyFeed] = useState<MyFeedRow>(null);
  const [emotionStats, setEmotionStats] = useState<EmotionStats>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'emotion' | 'plan' | 'stats' | 'eval' | 'letters'>('emotion');
  const [evalReports, setEvalReports] = useState<EvalReportSummary[]>([]);
  const [evalReportsLoaded, setEvalReportsLoaded] = useState(false);
  const [evalDetail, setEvalDetail] = useState<EvalReportDetail | null>(null);
  const [evalDetailLoading, setEvalDetailLoading] = useState(false);
  const [loadingEvalId, setLoadingEvalId] = useState('');
  const [reflectionText, setReflectionText] = useState('');
  const [parentText, setParentText] = useState('');
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [parentLoading, setParentLoading] = useState(false);
  const [evalModalMsg, setEvalModalMsg] = useState('');
  const [evalModalError, setEvalModalError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLoadingId, setLightboxLoadingId] = useState('');

  // 편지함 상태
  const [letterBox, setLetterBox] = useState<'received' | 'sent'>('received');
  const [receivedLetters, setReceivedLetters] = useState<ReceivedLetter[]>([]);
  const [sentLetters, setSentLetters] = useState<SentLetter[]>([]);
  const [receivedLoaded, setReceivedLoaded] = useState(false);
  const [sentLoaded, setSentLoaded] = useState(false);
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [classmatesLoaded, setClassmatesLoaded] = useState(false);
  const [letterDetail, setLetterDetail] = useState<LetterDetail | null>(null);
  const [letterDetailLoading, setLetterDetailLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContent, setComposeContent] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [letterMsg, setLetterMsg] = useState('');
  const [emotionCategory, setEmotionCategory] = useState(EMOTION_CATEGORIES[0].key);
  const [emotionType, setEmotionType] = useState<EmotionType>(EMOTION_CATEGORIES[0].emotions[0]);

  const [editingPlanId, setEditingPlanId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);
  const [planHistoryMap, setPlanHistoryMap] = useState<Record<string, PlanTitleHistory[]>>({});
  const [openHistoryPlanId, setOpenHistoryPlanId] = useState('');

  const [loginLoading, setLoginLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [myFeedLoading, setMyFeedLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const today = getTodayInSeoul();
  const isPlanEditable = planDate === today;
  const isEmotionEditable = emotionDate === today;

  const summary = useMemo(() => {
    const completed = plans.filter((plan) => plan.isCompleted === true).length;
    const total = plans.length;
    const rate = total ? Math.round((completed / total) * 100) : 0;
    return { completed, total, rate };
  }, [plans]);

  const emotionOptions = useMemo(
    () => EMOTION_CATEGORIES.find((category) => category.key === emotionCategory)?.emotions ?? [],
    [emotionCategory]
  );

  useEffect(() => {
    if (!emotionOptions.includes(emotionType)) {
      setEmotionType(emotionOptions[0] ?? EMOTION_CATEGORIES[0].emotions[0]);
    }
  }, [emotionOptions, emotionType]);

  useEffect(() => {
    if (!studentName) return;

    let currentDate = getTodayInSeoul();
    const timer = window.setInterval(() => {
      const nextDate = getTodayInSeoul();
      if (nextDate === currentDate) return;

      const shouldRefreshPlanDate = planDate === currentDate;
      const shouldRefreshEmotionDate = emotionDate === currentDate;
      currentDate = nextDate;

      if (shouldRefreshPlanDate) setPlanDate(nextDate);
      if (shouldRefreshEmotionDate) setEmotionDate(nextDate);

      void Promise.all([
        api<{ plans: PlanRow[] }>(`/api/plans/today?date=${shouldRefreshPlanDate ? nextDate : planDate}`).then((data) => setPlans(data.plans)),
        loadPlanAchievements(),
        api<{ feed: MyFeedRow }>(`/api/feeds?date=${shouldRefreshEmotionDate ? nextDate : emotionDate}`).then((data) => setMyFeed(data.feed))
      ]).catch((err) => {
        setError((err as Error).message);
        clearNoticeLater();
      });
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [emotionDate, planDate, studentName]);

  const clearNoticeLater = () => {
    window.setTimeout(() => {
      setMessage('');
      setError('');
    }, 2500);
  };

  const loadPlans = async (date: string = planDate) => {
    const data = await api<{ plans: PlanRow[] }>(`/api/plans/today?date=${date}`);
    setPlans(data.plans);
  };

  const loadPlanAchievements = async () => {
    const data = await api<{ plans: PlanAchievementRow[] }>('/api/stats/student/me/plans');
    setPlanAchievements(data.plans);
  };

  const loadMyFeed = async (date: string = emotionDate) => {
    setMyFeedLoading(true);
    try {
      const data = await api<{ feed: MyFeedRow }>(`/api/feeds?date=${date}`);
      setMyFeed(data.feed);
    } finally {
      setMyFeedLoading(false);
    }
  };

  const loadEmotionStats = async () => {
    setStatsLoading(true);
    try {
      const data = await api<NonNullable<EmotionStats>>('/api/stats/student/me/emotions');
      setEmotionStats(data);
    } finally {
      setStatsLoading(false);
    }
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoginLoading(true);

    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{
        student: { id: string; name: string; studentNumber: number };
        class: { id: string };
      }>('/api/auth/student/login', {
        method: 'POST',
        body: JSON.stringify({
          classCode: String(form.get('classCode')).trim(),
          name: String(form.get('name'))
        })
      });

      setStudentName(data.student.name);
      const loginToday = getTodayInSeoul();
      setPlanDate(loginToday);
      setEmotionDate(loginToday);
      await Promise.all([loadPlans(loginToday), loadPlanAchievements(), loadMyFeed(loginToday), loadEmotionStats()]);
      setMessage('로그인 되었습니다.');
      clearNoticeLater();
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    } finally {
      setLoginLoading(false);
    }
  };

  const onCreatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPlanEditable) {
      setError('지난 날짜의 계획은 수정할 수 없습니다.');
      clearNoticeLater();
      return;
    }
    setPlanLoading(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const title = String(form.get('title'));
    try {
      const data = await api<{ plan: { id: string; title: string } }>('/api/plans', { method: 'POST', body: JSON.stringify({ title }) });
      formEl.reset();
      setPlans((prev) => [...prev, { id: data.plan.id, title: data.plan.title, isCompleted: null }]);
      await loadPlanAchievements();
      setMessage('계획이 추가되었습니다.');
      clearNoticeLater();
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    } finally {
      setPlanLoading(false);
    }
  };

  const togglePlan = async (planId: string, nextState: boolean | null) => {
    if (!isPlanEditable) {
      setError('지난 날짜의 계획은 수정할 수 없습니다.');
      clearNoticeLater();
      return;
    }

    const before = plans;
    setPlans((prev) => prev.map((plan) => (plan.id === planId ? { ...plan, isCompleted: nextState } : plan)));
    try {
      await api(`/api/plans/${planId}/check?date=${planDate}`, {
        method: 'POST',
        body: JSON.stringify({ isCompleted: nextState })
      });
      await loadPlanAchievements();
    } catch (err) {
      setPlans(before);
      setError((err as Error).message);
      clearNoticeLater();
    }
  };

  const deletePlan = async (planId: string) => {
    if (!isPlanEditable) {
      setError('지난 날짜의 계획은 수정할 수 없습니다.');
      clearNoticeLater();
      return;
    }

    const before = plans;
    setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    try {
      await api(`/api/plans/${planId}`, { method: 'DELETE' });
      await loadPlanAchievements();
      setMessage('계획이 삭제되었습니다.');
      clearNoticeLater();
    } catch (err) {
      setPlans(before);
      setError((err as Error).message);
      clearNoticeLater();
    }
  };

  const startEditPlan = (plan: PlanRow) => {
    setEditingPlanId(plan.id);
    setEditingTitle(plan.title);
  };

  const cancelEditPlan = () => {
    setEditingPlanId('');
    setEditingTitle('');
  };

  const updatePlan = async (planId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;
    setEditingLoading(true);
    try {
      const data = await api<{ plan: { id: string; title: string } }>(`/api/plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: trimmed })
      });
      setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, title: data.plan.title } : p)));
      // 이력 캐시 초기화 (다음 열람 시 새로 불러옴)
      setPlanHistoryMap((prev) => { const next = { ...prev }; delete next[planId]; return next; });
      cancelEditPlan();
      setMessage('계획이 수정되었습니다.');
      clearNoticeLater();
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    } finally {
      setEditingLoading(false);
    }
  };

  const toggleHistory = async (planId: string) => {
    if (openHistoryPlanId === planId) {
      setOpenHistoryPlanId('');
      return;
    }
    setOpenHistoryPlanId(planId);
    if (planHistoryMap[planId]) return; // 이미 로드됨
    try {
      const data = await api<{ history: PlanTitleHistory[] }>(`/api/plans/${planId}/history`);
      setPlanHistoryMap((prev) => ({ ...prev, [planId]: data.history }));
    } catch {
      setPlanHistoryMap((prev) => ({ ...prev, [planId]: [] }));
    }
  };

  const onCreateFeed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedLoading(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const content = String(form.get('content'));
    try {
      const data = await api<{
        feed: {
          id: string;
          emotion_type: EmotionType;
          content: string;
          image_url: string | null;
          created_at: string;
        };
      }>('/api/feeds', {
        method: 'POST',
        body: JSON.stringify({ emotionType, content })
      });
      formEl.reset();
      setMyFeed(data.feed);
      await loadEmotionStats();
      setMessage('감정 피드를 작성했습니다.');
      clearNoticeLater();
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    } finally {
      setFeedLoading(false);
    }
  };

  const loadReceived = async () => {
    const d = await api<{ letters: ReceivedLetter[] }>('/api/letters/received');
    setReceivedLetters(d.letters);
    setReceivedLoaded(true);
  };

  const loadSent = async () => {
    const d = await api<{ letters: SentLetter[] }>('/api/letters/sent');
    setSentLetters(d.letters);
    setSentLoaded(true);
  };

  const loadClassmates = async () => {
    const d = await api<{ classmates: Classmate[] }>('/api/letters/classmates');
    setClassmates(d.classmates);
    setClassmatesLoaded(true);
  };

  const openLetterDetail = async (letterId: string) => {
    setLetterDetailLoading(true);
    try {
      const d = await api<{ letter: LetterDetail }>(`/api/letters/${letterId}`);
      setLetterDetail(d.letter);
      // 받은 편지함에서 읽음 처리 반영
      setReceivedLetters((prev) => prev.map((l) => l.id === letterId ? { ...l, is_read: true } : l));
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    } finally {
      setLetterDetailLoading(false);
    }
  };

  const onSendLetter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendLoading(true);
    setComposeError('');
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await api('/api/letters', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: String(form.get('recipientId')),
          title: String(form.get('title')),
          content: composeContent.trim(),
        }),
      });
      formEl.reset();
      setComposeContent('');
      setComposeOpen(false);
      setLetterMsg('편지를 보냈습니다.');
      // 보낸 편지함 캐시 초기화
      setSentLoaded(false);
      window.setTimeout(() => setLetterMsg(''), 2500);
    } catch (err) {
      setComposeError((err as Error).message);
    } finally {
      setSendLoading(false);
    }
  };

  const loadEvalReports = async () => {
    const d = await api<{ reports: EvalReportSummary[] }>('/api/eval/reports/my');
    setEvalReports(d.reports);
    setEvalReportsLoaded(true);
  };

  const openEvalDetail = async (reportId: string) => {
    setEvalDetailLoading(true);
    setLoadingEvalId(reportId);
    setEvalModalMsg('');
    setEvalModalError('');
    try {
      const d = await api<{ report: EvalReportDetail }>(`/api/eval/reports/${reportId}/me`, { cache: 'no-store' });
      setEvalDetail(d.report);
      setReflectionText('');
      setParentText('');
    } catch (err) {
      setEvalDetail({ id: reportId, title: '', created_at: '', eval_report_items: [], eval_report_images: [], eval_report_links: [], eval_reflections: [], eval_parent_comments: [] });
      setEvalModalError('평가 기록을 불러오지 못했습니다. ' + (err as Error).message);
    }
    finally { setEvalDetailLoading(false); setLoadingEvalId(''); }
  };

  const openLightbox = async (reportId: string, imageId: string) => {
    setLightboxLoadingId(imageId);
    try {
      const d = await api<{ url: string }>(`/api/eval/reports/${reportId}/images/${imageId}/view`);
      setLightboxUrl(d.url);
    } catch { /* ignore */ }
    finally { setLightboxLoadingId(''); }
  };

  const clearEvalModalNotice = () => window.setTimeout(() => { setEvalModalMsg(''); setEvalModalError(''); }, 3000);

  const submitReflection = async () => {
    if (!evalDetail || !reflectionText.trim()) return;
    setReflectionLoading(true);
    setEvalModalError('');
    try {
      const d = await api<{ reflection: { id: string; content: string; created_at: string } }>(
        `/api/eval/reports/${evalDetail.id}/reflection`,
        { method: 'POST', body: JSON.stringify({ content: reflectionText.trim() }) }
      );
      setEvalDetail((prev) => prev ? { ...prev, eval_reflections: [d.reflection] } : prev);
      setReflectionText('');
      setEvalModalMsg('성찰일기를 저장했습니다.');
      clearEvalModalNotice();
    } catch (err) {
      setEvalModalError((err as Error).message);
      clearEvalModalNotice();
    }
    finally { setReflectionLoading(false); }
  };

  const submitParentComment = async () => {
    if (!evalDetail || !parentText.trim()) return;
    setParentLoading(true);
    setEvalModalError('');
    try {
      const d = await api<{ parentComment: { id: string; content: string; created_at: string } }>(
        `/api/eval/reports/${evalDetail.id}/parent-comment`,
        { method: 'POST', body: JSON.stringify({ content: parentText.trim() }) }
      );
      setEvalDetail((prev) => prev ? { ...prev, eval_parent_comments: [d.parentComment] } : prev);
      setParentText('');
      setEvalModalMsg('부모님 응원을 저장했습니다.');
      clearEvalModalNotice();
    } catch (err) {
      setEvalModalError((err as Error).message);
      clearEvalModalNotice();
    }
    finally { setParentLoading(false); }
  };

  const onLogout = async () => {
    await api('/api/auth/student/logout', { method: 'POST' });
    setStudentName('');
    setPlanDate(getTodayInSeoul());
    setEmotionDate(getTodayInSeoul());
    setPlans([]);
    setPlanAchievements([]);
    setMyFeed(null);
    setEmotionStats(null);
    setEvalReports([]);
    setEvalReportsLoaded(false);
    setEvalDetail(null);
    setEditingPlanId('');
    setPlanHistoryMap({});
    setOpenHistoryPlanId('');
    setReceivedLetters([]);
    setSentLetters([]);
    setReceivedLoaded(false);
    setSentLoaded(false);
    setClassmates([]);
    setClassmatesLoaded(false);
    setLetterDetail(null);
    setComposeOpen(false);
    setComposeContent('');
    setMessage('로그아웃 되었습니다.');
    clearNoticeLater();
  };

  const onChangeEmotionDate = async (nextDate: string) => {
    setEmotionDate(nextDate);
    try {
      await loadMyFeed(nextDate);
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    }
  };

  const onChangePlanDate = async (nextDate: string) => {
    setPlanDate(nextDate);
    try {
      await loadPlans(nextDate);
    } catch (err) {
      setError((err as Error).message);
      clearNoticeLater();
    }
  };

  const isLoggedIn = Boolean(studentName);

  return (
    <main className="grid" style={{ gap: 16 }}>
      <PageHeader
        title="학생 홈"
        subtitle={isLoggedIn ? `${studentName} 학생, 오늘도 화이팅!` : '학급코드와 이름으로 로그인하세요'}
        right={
          isLoggedIn ? (
            <button className="outline" type="button" onClick={onLogout}>
              로그아웃
            </button>
          ) : null
        }
      />

      <Notice type="success" message={message} />
      <Notice type="error" message={error} />

      {!isLoggedIn && (
        <section className="card">
          <h2>학생 로그인</h2>
          <form className="grid" onSubmit={onLogin}>
            <div>
              <label>학급코드</label>
              <input name="classCode" placeholder="예: 1234" required maxLength={6} inputMode="numeric" pattern="[0-9]{1,6}" />
            </div>
            <div>
              <label>이름</label>
              <input name="name" placeholder="김마음" required />
            </div>
            <SubmitButton loading={loginLoading} idleText="로그인" />
          </form>
        </section>
      )}

      {isLoggedIn && (
        <>
          <section className="card">
            <h3 style={{ marginTop: 0 }}>오늘 요약</h3>
            <div className="grid two">
              <div className="card" style={{ padding: 12 }}>
                <strong>감정 작성</strong>
                <p className="hint">{myFeed ? '오늘 감정 기록 완료' : '오늘 아직 기록 없음'}</p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <strong>계획 달성률</strong>
                <ProgressBar value={summary.rate} label={`${summary.completed}/${summary.total} 완료 (${summary.rate}%)`} />
              </div>
            </div>
          </section>

          <section className="card">
            <Tabs
              items={[
                { key: 'emotion', label: '오늘의 감정' },
                { key: 'plan', label: '오늘의 계획' },
                { key: 'stats', label: '나의 감정통계' },
                { key: 'eval', label: '평가기록' },
                {
                  key: 'letters',
                  label: `편지함${receivedLetters.filter((l) => !l.is_read).length > 0 ? ` (${receivedLetters.filter((l) => !l.is_read).length})` : ''}`,
                },
              ]}
              value={activeTab}
              onChange={(key) => {
                setActiveTab(key as 'emotion' | 'plan' | 'stats' | 'eval' | 'letters');
                if (key === 'stats' && !emotionStats) loadEmotionStats();
                if (key === 'eval' && !evalReportsLoaded) loadEvalReports();
                if (key === 'letters') {
                  if (!receivedLoaded) loadReceived().catch(() => null);
                  if (!classmatesLoaded) loadClassmates().catch(() => null);
                }
              }}
            />
          </section>

          {activeTab === 'emotion' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>오늘의 감정</h2>
                <div style={{ width: 180 }}>
                  <label style={{ marginBottom: 4 }}>날짜 선택</label>
                  <input
                    type="date"
                    value={emotionDate}
                    max={today}
                    onChange={(event) => onChangeEmotionDate(event.target.value)}
                  />
                </div>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                {isEmotionEditable
                  ? '오늘 선택한 감정과 기록은 저장되며, 달력에서 날짜를 골라 다시 볼 수 있습니다.'
                  : '선택한 날짜의 감정 기록은 읽기 전용으로 확인할 수 있습니다.'}
              </p>

              {myFeedLoading ? (
                <div className="card" style={{ padding: 12 }}>
                  <p className="hint">감정 기록을 불러오는 중입니다...</p>
                </div>
              ) : myFeed ? (
                <div className="card" style={{ padding: 14, background: '#f8fbff' }}>
                  <div className="row space-between" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
                    <div className="grid" style={{ gap: 6 }}>
                      {emotionDate !== today ? <strong>{`${emotionDate} 감정 기록`}</strong> : null}
                      <div className="row" style={{ flexWrap: 'wrap' }}>
                        <span className="badge">{EMOTION_META[myFeed.emotion_type].categoryLabel}</span>
                        <span className="badge">{EMOTION_META[myFeed.emotion_type].label}</span>
                      </div>
                    </div>
                    <span className="hint">{new Date(myFeed.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{myFeed.content}</p>
                </div>
              ) : (
                <EmptyState
                  title="저장된 감정 기록이 없습니다"
                  description={
                    isEmotionEditable
                      ? '아래에서 오늘의 감정과 한 줄 기록을 작성해보세요.'
                      : '선택한 날짜에는 저장된 감정 기록이 없습니다.'
                  }
                />
              )}

              {isEmotionEditable && !myFeed && (
                <form className="grid" onSubmit={onCreateFeed} style={{ marginTop: 16 }}>
                  <div>
                    <label>감정 범주</label>
                    <select value={emotionCategory} onChange={(event) => setEmotionCategory(event.target.value as (typeof EMOTION_CATEGORIES)[number]['key'])}>
                      {EMOTION_CATEGORIES.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>세부 감정</label>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      {emotionOptions.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className={emotionType === key ? 'ghost' : 'outline'}
                          style={{ width: 'auto', minHeight: 36, padding: '6px 12px' }}
                          onClick={() => setEmotionType(key as EmotionType)}
                        >
                          {EMOTION_META[key].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label>한 줄 기록 (100자)</label>
                    <textarea name="content" maxLength={100} required />
                  </div>
                  <SubmitButton loading={feedLoading} idleText="피드 작성" />
                </form>
              )}
            </section>
          )}

          {activeTab === 'plan' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>오늘의 계획</h2>
                <div style={{ width: 180 }}>
                  <label style={{ marginBottom: 4 }}>날짜 선택</label>
                  <input
                    type="date"
                    value={planDate}
                    max={today}
                    onChange={(event) => onChangePlanDate(event.target.value)}
                  />
                </div>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                {isPlanEditable ? '오늘 계획은 추가, 체크, 삭제가 가능합니다.' : '과거 날짜의 계획은 조회만 가능하며 수정할 수 없습니다.'}
              </p>
              <div className="grid two" style={{ marginBottom: 12 }}>
                {planAchievements.length === 0 ? (
                  <EmptyState title="실천률 데이터가 없습니다" description="계획을 추가하면 누적 실천률이 표시됩니다." />
                ) : (
                  planAchievements.map((item) => (
                    <div key={item.planId} className="card" style={{ padding: 10 }}>
                      <div className="row space-between" style={{ marginBottom: 4 }}>
                        <strong style={{ fontSize: 14 }}>{item.title}</strong>
                        <span className="badge">{item.achievementRate}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${item.achievementRate}%` }} />
                      </div>
                      <p className="hint">
                        이번 달 누적 {item.completed}/{item.totalPossible}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <form className="row" onSubmit={onCreatePlan}>
                <input name="title" placeholder="예: 책 30분 읽기" required disabled={!isPlanEditable} />
                <div style={{ width: 140 }}>
                  <SubmitButton loading={planLoading} idleText="추가" disabled={!isPlanEditable} />
                </div>
              </form>

              <div className="grid" style={{ marginTop: 12 }}>
                {plans.length === 0 ? (
                  <EmptyState
                    title="등록된 계획이 없습니다"
                    description={isPlanEditable ? '오늘 계획을 하나 추가해보세요.' : '선택한 날짜에 확인할 계획 데이터가 없습니다.'}
                  />
                ) : (
                  plans.map((plan) => {
                    const isEditing = editingPlanId === plan.id;
                    const isHistoryOpen = openHistoryPlanId === plan.id;
                    const history = planHistoryMap[plan.id];
                    return (
                      <div key={plan.id} className="card" style={{ padding: '10px 12px' }}>
                        {/* 편집 모드 */}
                        {isEditing ? (
                          <div className="row" style={{ gap: 6 }}>
                            <input
                              value={editingTitle}
                              maxLength={50}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              style={{ flex: 1, minHeight: 36 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="ghost"
                              style={{ width: 'auto', padding: '6px 12px', flexShrink: 0 }}
                              disabled={editingLoading || !editingTitle.trim()}
                              onClick={() => updatePlan(plan.id)}
                            >
                              {editingLoading ? '저장 중...' : '저장'}
                            </button>
                            <button
                              type="button"
                              className="outline"
                              style={{ width: 'auto', padding: '6px 12px', flexShrink: 0 }}
                              onClick={cancelEditPlan}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          /* 일반 모드: 제목 + 완료/미완료/수정/이력/삭제 한 줄 */
                          <div className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                            <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {plan.title}
                            </span>
                            <button
                              type="button"
                              className={plan.isCompleted === true ? 'ghost' : 'outline'}
                              style={{ width: 'auto', padding: '6px 10px', flexShrink: 0, fontSize: 13 }}
                              disabled={!isPlanEditable}
                              onClick={() => togglePlan(plan.id, plan.isCompleted === true ? null : true)}
                            >
                              완료
                            </button>
                            <button
                              type="button"
                              className={plan.isCompleted === false ? 'ghost' : 'outline'}
                              style={{ width: 'auto', padding: '6px 10px', flexShrink: 0, fontSize: 13 }}
                              disabled={!isPlanEditable}
                              onClick={() => togglePlan(plan.id, plan.isCompleted === false ? null : false)}
                            >
                              미완료
                            </button>
                            {isPlanEditable && (
                              <button
                                type="button"
                                className="outline"
                                style={{ width: 'auto', padding: '6px 10px', flexShrink: 0, fontSize: 13 }}
                                onClick={() => startEditPlan(plan)}
                              >
                                수정
                              </button>
                            )}
                            <button
                              type="button"
                              className="outline"
                              style={{ width: 'auto', padding: '6px 10px', flexShrink: 0, fontSize: 13 }}
                              onClick={() => toggleHistory(plan.id)}
                            >
                              {isHistoryOpen ? '이력▲' : '이력▼'}
                            </button>
                            {isPlanEditable && (
                              <button
                                type="button"
                                className="outline"
                                style={{ width: 'auto', padding: '6px 10px', flexShrink: 0, fontSize: 13 }}
                                onClick={() => deletePlan(plan.id)}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        )}

                        {/* 변경 이력 */}
                        {isHistoryOpen && (
                          <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                            <p className="hint" style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600 }}>변경 이력</p>
                            {!history ? (
                              <p className="hint" style={{ fontSize: 12 }}>불러오는 중...</p>
                            ) : history.length === 0 ? (
                              <p className="hint" style={{ fontSize: 12 }}>변경 이력이 없습니다.</p>
                            ) : (
                              <div className="grid" style={{ gap: 4 }}>
                                {history.map((h) => (
                                  <div key={h.id} style={{ fontSize: 12, color: '#64748b' }}>
                                    <span style={{ color: '#dc2626' }}>{h.old_title}</span>
                                    {' → '}
                                    <span style={{ color: '#16a34a' }}>{h.new_title}</span>
                                    <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                                      {new Date(h.changed_at).toLocaleDateString('ko-KR')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeTab === 'stats' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>나의 감정통계</h2>
                <button
                  type="button"
                  className="outline"
                  style={{ width: 'auto' }}
                  onClick={loadEmotionStats}
                  disabled={statsLoading}
                >
                  {statsLoading ? '불러오는 중...' : '새로고침'}
                </button>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                {emotionStats ? `${emotionStats.range.startDate} ~ ${emotionStats.range.endDate} 이번 달 감정 기록` : ''}
              </p>

              {statsLoading ? (
                <p className="hint">감정 통계를 불러오는 중입니다...</p>
              ) : !emotionStats || emotionStats.totalFeeds === 0 ? (
                <EmptyState title="감정 기록이 없습니다" description="이번 달 감정을 기록하면 통계가 표시됩니다." />
              ) : (() => {
                const chartItems = buildEmotionChartItems(emotionStats.distribution);
                const segments = chartItems.map((item) => `${item.color} ${item.ratio}%`).join(', ');
                return (
                  <div className="grid" style={{ gap: 18, justifyItems: 'center', textAlign: 'center' }}>
                    <div
                      style={{
                        width: 260,
                        height: 260,
                        borderRadius: '50%',
                        background: `conic-gradient(${segments})`,
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 52,
                          borderRadius: '50%',
                          background: 'white',
                          display: 'grid',
                          placeItems: 'center',
                          textAlign: 'center',
                          color: '#64748b'
                        }}
                      >
                        <div>
                          <strong style={{ display: 'block', fontSize: 28, lineHeight: 1.1, color: '#0f172a' }}>
                            {emotionStats.totalFeeds}
                          </strong>
                          <span style={{ fontSize: 13 }}>총 감정 기록</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid" style={{ gap: 8, width: '100%', maxWidth: 460 }}>
                      {chartItems.map((item) => (
                        <div
                          key={item.key}
                          className="row space-between"
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, textAlign: 'left' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: item.color,
                                flexShrink: 0
                              }}
                            />
                            <span style={{ color: '#334155' }}>{item.label}</span>
                          </span>
                          <strong style={{ color: '#0f172a', flexShrink: 0 }}>{item.ratio}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {activeTab === 'letters' && (
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>편지함</h2>
                <button
                  type="button"
                  className="ghost"
                  style={{ width: 'auto', padding: '8px 18px' }}
                  onClick={() => {
                    if (!classmatesLoaded) loadClassmates().catch(() => null);
                    setComposeOpen(true);
                    setComposeError('');
                  }}
                >
                  ✉ 편지 쓰기
                </button>
              </div>

              {letterMsg && (
                <p style={{ margin: '0 0 12px', padding: '8px 12px', background: '#dcfce7', color: '#16a34a', borderRadius: 8, fontSize: 13 }}>
                  {letterMsg}
                </p>
              )}

              {/* 받은편지함 / 보낸편지함 전환 */}
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className={letterBox === 'received' ? 'ghost' : 'outline'}
                  style={{ width: 'auto', padding: '6px 16px' }}
                  onClick={() => {
                    setLetterBox('received');
                    if (!receivedLoaded) loadReceived().catch(() => null);
                  }}
                >
                  받은편지함
                  {receivedLetters.filter((l) => !l.is_read).length > 0 && (
                    <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 99, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
                      {receivedLetters.filter((l) => !l.is_read).length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={letterBox === 'sent' ? 'ghost' : 'outline'}
                  style={{ width: 'auto', padding: '6px 16px' }}
                  onClick={() => {
                    setLetterBox('sent');
                    if (!sentLoaded) loadSent().catch(() => null);
                  }}
                >
                  보낸편지함
                </button>
              </div>

              {/* 받은편지함 목록 */}
              {letterBox === 'received' && (
                !receivedLoaded ? (
                  <p className="hint">불러오는 중...</p>
                ) : receivedLetters.length === 0 ? (
                  <EmptyState title="받은 편지가 없습니다" description="학급 친구가 편지를 보내면 여기에 표시됩니다." />
                ) : (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    {receivedLetters.map((letter, idx) => (
                      <button
                        key={letter.id}
                        type="button"
                        onClick={() => openLetterDetail(letter.id)}
                        disabled={letterDetailLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '13px 16px', width: '100%', textAlign: 'left',
                          background: letter.is_read ? '#fff' : '#eff6ff',
                          borderBottom: idx < receivedLetters.length - 1 ? '1px solid #f1f5f9' : 'none',
                          border: 'none', cursor: letterDetailLoading ? 'default' : 'pointer',
                        }}
                      >
                        {!letter.is_read && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                        )}
                        <span style={{ flex: 1, fontWeight: letter.is_read ? 400 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>
                          {letter.title}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                          {letter.sender?.name ?? '알 수 없음'}
                        </span>
                        <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                          {new Date(letter.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}

              {/* 보낸편지함 목록 */}
              {letterBox === 'sent' && (
                !sentLoaded ? (
                  <p className="hint">불러오는 중...</p>
                ) : sentLetters.length === 0 ? (
                  <EmptyState title="보낸 편지가 없습니다" description="편지 쓰기를 눌러 친구에게 편지를 보내보세요." />
                ) : (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    {sentLetters.map((letter, idx) => (
                      <button
                        key={letter.id}
                        type="button"
                        onClick={() => openLetterDetail(letter.id)}
                        disabled={letterDetailLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '13px 16px', width: '100%', textAlign: 'left',
                          background: '#fff',
                          borderBottom: idx < sentLetters.length - 1 ? '1px solid #f1f5f9' : 'none',
                          border: 'none', cursor: letterDetailLoading ? 'default' : 'pointer',
                        }}
                      >
                        <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>
                          {letter.title}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                          → {letter.recipient?.name ?? '알 수 없음'}
                        </span>
                        <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                          {new Date(letter.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </section>
          )}

          {activeTab === 'eval' && (
            <section className="card">
              <h2 style={{ margin: '0 0 12px' }}>평가기록</h2>
              {evalReports.length === 0 ? (
                <p className="hint">아직 받은 평가가 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  {evalReports.map((r) => {
                    const sortedItems = [...(r.eval_report_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                    const topColor = GRADE_COLOR[sortedItems[0]?.grade as 'high' | 'mid' | 'low'] ?? '#3b82f6';
                    const cardTitle = sortedItems[0]?.rubric_title_snapshot ?? r.title;
                    const isLoading = loadingEvalId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => openEvalDetail(r.id)}
                        disabled={evalDetailLoading}
                        style={{
                          width: 112,
                          minHeight: 158,
                          borderRadius: 14,
                          border: 'none',
                          background: '#fff',
                          padding: 0,
                          cursor: evalDetailLoading ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          boxShadow: isLoading
                            ? `0 0 0 3px ${topColor}, 0 6px 20px ${topColor}50`
                            : '0 2px 10px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
                          opacity: evalDetailLoading && !isLoading ? 0.45 : 1,
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                          textAlign: 'left',
                        }}
                      >
                        {/* 카드 상단 컬러 영역 */}
                        <div style={{
                          height: 64,
                          background: `linear-gradient(135deg, ${topColor}, ${topColor}aa)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          position: 'relative',
                        }}>
                          {isLoading ? (
                            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>불러오는 중…</span>
                          ) : (
                            <>
                              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                                <rect x="5" y="2" width="11" height="20" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                                <rect x="7" y="2" width="9" height="20" rx="1.5" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.85)" strokeWidth="1"/>
                                <line x1="9" y1="7.5" x2="14" y2="7.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1"/>
                                <line x1="9" y1="10.5" x2="14" y2="10.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1"/>
                                <line x1="9" y1="13.5" x2="12" y2="13.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1"/>
                              </svg>
                              {/* 등급 뱃지들 */}
                              <div style={{ position: 'absolute', top: 6, right: 7, display: 'flex', gap: 3 }}>
                                {sortedItems.map((it, i) => (
                                  <span key={i} style={{
                                    fontSize: 9, fontWeight: 800,
                                    color: '#fff',
                                    background: 'rgba(0,0,0,0.22)',
                                    borderRadius: 4,
                                    padding: '1px 4px',
                                    lineHeight: 1.4,
                                  }}>{GRADE_LABEL[it.grade as 'high' | 'mid' | 'low']}</span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        {/* 카드 하단 내용 */}
                        {!isLoading && (
                          <div style={{ flex: 1, padding: '9px 10px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: 12, wordBreak: 'keep-all', color: '#0f172a', lineHeight: 1.4 }}>
                              {cardTitle}
                            </strong>
                            <div>
                              <p className="hint" style={{ margin: '5px 0 2px', fontSize: 10 }}>
                                {new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                              </p>
                              <p style={{ margin: 0, fontSize: 12, lineHeight: 1 }}>
                                {r.eval_reflections?.length ? '✏️' : ''}
                                {r.eval_parent_comments?.length ? '💌' : ''}
                                {r.eval_report_images?.length ? '🖼️' : ''}
                              </p>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* 평가 상세 모달 */}
      {evalDetail && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setEvalDetail(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div style={{ width: 'min(600px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

            {/* 헤더 */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div className="row space-between">
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{new Date(evalDetail.created_at).toLocaleDateString('ko-KR')}</p>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{evalDetail.title}</h3>
                </div>
                <button type="button" className="outline" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setEvalDetail(null)}>닫기</button>
              </div>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 평가 항목 */}
              <section>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#374151', letterSpacing: '0.03em' }}>평가 결과</p>
                {(() => {
                  const sorted = [...evalDetail.eval_report_items].sort((a, b) => a.sort_order - b.sort_order);
                  // rubric_title_snapshot 기준으로 그룹핑 (순서 유지)
                  const groups: { rubricTitle: string; items: typeof sorted }[] = [];
                  for (const item of sorted) {
                    const last = groups[groups.length - 1];
                    if (last && last.rubricTitle === item.rubric_title_snapshot) {
                      last.items.push(item);
                    } else {
                      groups.push({ rubricTitle: item.rubric_title_snapshot, items: [item] });
                    }
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {groups.map((group) => (
                        <div key={group.rubricTitle} style={{ border: '1.5px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                          {/* 기준명 헤더 — 그룹당 1번만 */}
                          <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{group.rubricTitle}</p>
                          </div>

                          {/* 평가기준 항목들 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {group.items.map((item, itemIdx) => {
                              const levels: { key: 'high' | 'mid' | 'low'; label: string; desc: string | null; bg: string; color: string }[] = [
                                { key: 'high', label: '잘함', desc: item.rubric_level_high_snapshot, bg: '#f0fdf4', color: '#16a34a' },
                                { key: 'mid',  label: '보통', desc: item.rubric_level_mid_snapshot,  bg: '#fefce8', color: '#d97706' },
                                { key: 'low',  label: '노력', desc: item.rubric_level_low_snapshot,  bg: '#fff1f2', color: '#dc2626' },
                              ];
                              const hasLevels = levels.some((l) => l.desc);
                              return (
                                <div key={item.id} style={{ borderTop: itemIdx > 0 ? '1px solid #f1f5f9' : undefined }}>
                                  {/* 평가기준명 + 등급 */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: GRADE_COLOR[item.grade] + '0e' }}>
                                    {item.criterion_title_snapshot && (
                                      <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{item.criterion_title_snapshot}</span>
                                    )}
                                    <span style={{ fontWeight: 800, fontSize: 13, color: GRADE_COLOR[item.grade], background: GRADE_COLOR[item.grade] + '22', padding: '3px 12px', borderRadius: 20, flexShrink: 0, marginLeft: 'auto' }}>
                                      {GRADE_LABEL[item.grade]}
                                    </span>
                                  </div>

                                  {/* 수준별 설명 */}
                                  {hasLevels && (
                                    <div style={{ padding: '10px 16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {levels.map((lv) => {
                                        const isMyLevel = item.grade === lv.key;
                                        return (
                                          <div
                                            key={lv.key}
                                            style={{
                                              display: 'flex', alignItems: 'flex-start', gap: 8,
                                              background: isMyLevel ? lv.bg : '#fff',
                                              border: `${isMyLevel ? '2px' : '1px'} solid ${isMyLevel ? lv.color : '#e5e7eb'}`,
                                              borderRadius: 8, padding: '7px 10px',
                                            }}
                                          >
                                            <span style={{
                                              fontSize: 11, fontWeight: 800,
                                              color: isMyLevel ? '#fff' : lv.color,
                                              background: isMyLevel ? lv.color : lv.color + '18',
                                              borderRadius: 6, padding: '2px 7px', flexShrink: 0, lineHeight: 1.6,
                                            }}>{lv.label}</span>
                                            <span style={{ fontSize: 13, color: isMyLevel ? '#111827' : '#6b7280', lineHeight: 1.5, flex: 1 }}>
                                              {lv.desc || '—'}
                                            </span>
                                            {isMyLevel && (
                                              <span style={{ fontSize: 11, fontWeight: 700, color: lv.color, flexShrink: 0 }}>← 내 수준</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* 교사 피드백 */}
                                  {item.teacher_feedback && (
                                    <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                                      <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>선생님 피드백</p>
                                      <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{item.teacher_feedback}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>

              {/* 평가 자료 이미지 */}
              {evalDetail.eval_report_images.length > 0 && (
                <section>
                  <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#374151' }}>평가 자료</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[...evalDetail.eval_report_images].sort((a, b) => a.sort_order - b.sort_order).map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => openLightbox(evalDetail.id, img.id)}
                        disabled={lightboxLoadingId === img.id}
                        style={{ width: 72, height: 72, padding: 0, border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#f8fafc', flexShrink: 0, cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{lightboxLoadingId === img.id ? '...' : `자료 ${img.sort_order + 1}`}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* 웹 링크 */}
              {evalDetail.eval_report_links?.length > 0 && (
                <section>
                  <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#374151' }}>참고 자료</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...evalDetail.eval_report_links].sort((a, b) => a.sort_order - b.sort_order).map((lk) => (
                      <a
                        key={lk.id}
                        href={lk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                      >
                        <span>{lk.label || lk.url}</span>
                        <span style={{ fontSize: 12, color: '#60a5fa', flexShrink: 0, marginLeft: 8 }}>↗ 열기</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* 알림 */}
              {evalModalMsg && <p style={{ margin: 0, padding: '8px 12px', background: '#dcfce7', color: '#16a34a', borderRadius: 8, fontSize: 13 }}>{evalModalMsg}</p>}
              {evalModalError && <p style={{ margin: 0, padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>{evalModalError}</p>}

              {/* 성찰일기 */}
              <section style={{ background: '#f8fbff', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#1e40af' }}>✏️ 나의 성찰일기</p>
                {evalDetail.eval_reflections?.[0] ? (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#374151' }}>{evalDetail.eval_reflections[0].content}</p>
                ) : (
                  <>
                    <textarea
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      maxLength={500}
                      placeholder="이 평가를 받고 느낀 점, 앞으로의 다짐을 써보세요. (최대 500자, 작성 후 수정 불가)"
                      style={{ minHeight: 96, resize: 'vertical', background: '#fff' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span className="hint" style={{ fontSize: 12 }}>{reflectionText.length}/500</span>
                      <button
                        type="button"
                        className="ghost"
                        style={{ width: 'auto', padding: '6px 18px' }}
                        onClick={submitReflection}
                        disabled={reflectionLoading || !reflectionText.trim()}
                      >
                        {reflectionLoading ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </>
                )}
              </section>

              {/* 부모님 응원 */}
              <section style={{ background: '#fffbeb', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#92400e' }}>💌 부모님 응원 / 격려</p>
                {evalDetail.eval_parent_comments?.[0] ? (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#374151' }}>{evalDetail.eval_parent_comments[0].content}</p>
                ) : (
                  <>
                    <textarea
                      value={parentText}
                      onChange={(e) => setParentText(e.target.value)}
                      maxLength={300}
                      placeholder="자녀에게 응원 메시지를 남겨주세요. (최대 300자, 작성 후 수정 불가)"
                      style={{ minHeight: 80, resize: 'vertical', background: '#fff' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span className="hint" style={{ fontSize: 12 }}>{parentText.length}/300</span>
                      <button
                        type="button"
                        className="outline"
                        style={{ width: 'auto', padding: '6px 18px' }}
                        onClick={submitParentComment}
                        disabled={parentLoading || !parentText.trim()}
                      >
                        {parentLoading ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </>
                )}
              </section>

            </div>
          </div>
        </div>
      )}

      {/* 편지 상세 모달 */}
      {letterDetail && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setLetterDetail(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div style={{ width: 'min(480px, 96vw)', background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
              <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8' }}>
                    {letterDetail.sender?.name ?? '?'} → {letterDetail.recipient?.name ?? '?'}
                    {' · '}
                    {new Date(letterDetail.created_at).toLocaleDateString('ko-KR')}
                  </p>
                  <h3 style={{ margin: 0, fontSize: 17, wordBreak: 'break-all' }}>{letterDetail.title}</h3>
                </div>
                <button type="button" className="outline" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setLetterDetail(null)}>닫기</button>
              </div>
            </div>
            <div style={{ padding: '20px 20px 24px' }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.9, color: '#374151', fontSize: 15 }}>{letterDetail.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* 편지 쓰기 모달 */}
      {composeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) { setComposeOpen(false); setComposeError(''); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}
        >
          <div style={{ width: 'min(480px, 96vw)', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div className="row space-between" style={{ marginBottom: 18 }}>
              <h3 style={{ margin: 0 }}>✉ 편지 쓰기</h3>
              <button type="button" className="outline" style={{ width: 'auto' }} onClick={() => { setComposeOpen(false); setComposeError(''); }}>닫기</button>
            </div>
            <form className="grid" style={{ gap: 12 }} onSubmit={onSendLetter}>
              <div>
                <label>받는 사람</label>
                <select name="recipientId" required>
                  <option value="">선택하세요</option>
                  {classmates.map((s) => (
                    <option key={s.id} value={s.id}>{s.student_number}번 {s.name}</option>
                  ))}
                </select>
                {!classmatesLoaded && <p className="hint" style={{ margin: '4px 0 0', fontSize: 12 }}>학급 정보 불러오는 중...</p>}
              </div>
              <div>
                <label>제목 (50자)</label>
                <input name="title" maxLength={50} required />
              </div>
              <div>
                <label>내용 (1000자)</label>
                <textarea
                  name="content"
                  maxLength={1000}
                  required
                  style={{ minHeight: 130, resize: 'vertical' }}
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                />
                <p className="hint" style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'right' }}>{composeContent.length}/1000</p>
              </div>
              {composeError && (
                <p style={{ margin: 0, padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>{composeError}</p>
              )}
              <SubmitButton loading={sendLoading} idleText="보내기" />
            </form>
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'grid', placeItems: 'center', cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="평가 자료"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
          />
          <p style={{ position: 'absolute', bottom: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>클릭하여 닫기</p>
        </div>
      )}
    </main>
  );
}
