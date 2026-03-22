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
  const [activeTab, setActiveTab] = useState<'emotion' | 'plan' | 'stats'>('emotion');
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

  const onLogout = async () => {
    await api('/api/auth/student/logout', { method: 'POST' });
    setStudentName('');
    setPlanDate(getTodayInSeoul());
    setEmotionDate(getTodayInSeoul());
    setPlans([]);
    setPlanAchievements([]);
    setMyFeed(null);
    setEmotionStats(null);
    setEditingPlanId('');
    setPlanHistoryMap({});
    setOpenHistoryPlanId('');
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
                { key: 'stats', label: '나의 감정통계' }
              ]}
              value={activeTab}
              onChange={(key) => {
                setActiveTab(key as 'emotion' | 'plan' | 'stats');
                if (key === 'stats' && !emotionStats) loadEmotionStats();
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
                      <div key={plan.id} className="card" style={{ padding: 12 }}>
                        {/* 제목 영역 */}
                        {isEditing ? (
                          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                            <input
                              value={editingTitle}
                              maxLength={50}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              style={{ flex: 1 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="ghost"
                              style={{ width: 'auto', padding: '8px 14px' }}
                              disabled={editingLoading || !editingTitle.trim()}
                              onClick={() => updatePlan(plan.id)}
                            >
                              {editingLoading ? '저장 중...' : '저장'}
                            </button>
                            <button
                              type="button"
                              className="outline"
                              style={{ width: 'auto', padding: '8px 14px' }}
                              onClick={cancelEditPlan}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="row space-between" style={{ marginBottom: 10 }}>
                            <span style={{ fontWeight: 500 }}>{plan.title}</span>
                            <div className="row" style={{ gap: 4 }}>
                              {isPlanEditable && (
                                <button
                                  type="button"
                                  className="outline"
                                  style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => startEditPlan(plan)}
                                >
                                  수정
                                </button>
                              )}
                              <button
                                type="button"
                                className="outline"
                                style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                                onClick={() => toggleHistory(plan.id)}
                              >
                                {isHistoryOpen ? '이력 닫기' : '변경 이력'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 체크 + 삭제 버튼 */}
                        <div className="row">
                          <button
                            type="button"
                            className={plan.isCompleted === true ? 'ghost' : 'outline'}
                            style={{ flex: 1, minHeight: 40, padding: '8px 10px' }}
                            disabled={!isPlanEditable}
                            onClick={() => togglePlan(plan.id, plan.isCompleted === true ? null : true)}
                          >
                            완료
                          </button>
                          <button
                            type="button"
                            className={plan.isCompleted === false ? 'ghost' : 'outline'}
                            style={{ flex: 1, minHeight: 40, padding: '8px 10px' }}
                            disabled={!isPlanEditable}
                            onClick={() => togglePlan(plan.id, plan.isCompleted === false ? null : false)}
                          >
                            미완료
                          </button>
                          <button
                            type="button"
                            className="outline"
                            style={{ width: 72, minHeight: 40, padding: '8px 10px' }}
                            disabled={!isPlanEditable}
                            onClick={() => deletePlan(plan.id)}
                          >
                            삭제
                          </button>
                        </div>

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
        </>
      )}
    </main>
  );
}
