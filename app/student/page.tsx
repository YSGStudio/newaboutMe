'use client';

import { FormEvent, useMemo, useState } from 'react';
import { EMOTION_META, REACTION_META, EmotionType, ReactionType } from '@/types/domain';

type PlanRow = { id: string; title: string; isCompleted: boolean };

type FeedRow = {
  id: string;
  emotion_type: EmotionType;
  content: string;
  created_at: string;
  students: { id: string; name: string; student_number: number };
  feed_reactions: { id: string; reaction_type: ReactionType; student_id: string }[];
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

export default function StudentPage() {
  const [classId, setClassId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    const completed = plans.filter((plan) => plan.isCompleted).length;
    const total = plans.length;
    const rate = total ? Math.round((completed / total) * 100) : 0;
    return { completed, total, rate };
  }, [plans]);

  const loadPlans = async () => {
    const data = await api<{ plans: PlanRow[] }>('/api/plans/today');
    setPlans(data.plans);
  };

  const loadFeeds = async (targetClassId: string) => {
    const data = await api<{ feeds: FeedRow[] }>(`/api/feeds/class/${targetClassId}`);
    setFeeds(data.feeds);
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{
        student: { name: string };
        class: { id: string };
      }>('/api/auth/student/login', {
        method: 'POST',
        body: JSON.stringify({
          classCode: String(form.get('classCode')).toUpperCase(),
          studentNumber: Number(form.get('studentNumber')),
          pinCode: String(form.get('pinCode'))
        })
      });

      setClassId(data.class.id);
      setStudentName(data.student.name);
      await Promise.all([loadPlans(), loadFeeds(data.class.id)]);
      setMessage('로그인 되었습니다.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onCreatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await api('/api/plans', { method: 'POST', body: JSON.stringify({ title: String(form.get('title')) }) });
      formEl.reset();
      await loadPlans();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const togglePlan = async (planId: string, nextState: boolean) => {
    try {
      await api(`/api/plans/${planId}/check`, {
        method: 'POST',
        body: JSON.stringify({ isCompleted: nextState })
      });
      await loadPlans();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onCreateFeed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await api('/api/feeds', {
        method: 'POST',
        body: JSON.stringify({
          emotionType: String(form.get('emotionType')),
          content: String(form.get('content'))
        })
      });
      formEl.reset();
      if (classId) await loadFeeds(classId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reactFeed = async (feedId: string, reactionType: ReactionType) => {
    try {
      await api(`/api/feeds/${feedId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ reactionType })
      });
      if (classId) await loadFeeds(classId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onLogout = async () => {
    await api('/api/auth/student/logout', { method: 'POST' });
    setClassId('');
    setStudentName('');
    setPlans([]);
    setFeeds([]);
    setMessage('로그아웃 되었습니다.');
  };

  return (
    <main className="grid" style={{ gap: 18 }}>
      <section className="card">
        <h1>학생 홈 (MVP)</h1>
        <p className="hint">학급코드 + 출석번호 + PIN으로 로그인하세요.</p>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>학생 로그인</h2>
          <form className="grid" onSubmit={onLogin}>
            <div>
              <label>학급코드</label>
              <input name="classCode" placeholder="ABC123" required maxLength={6} />
            </div>
            <div>
              <label>출석번호</label>
              <input name="studentNumber" type="number" min={1} max={99} required />
            </div>
            <div>
              <label>PIN (4자리)</label>
              <input name="pinCode" pattern="\d{4}" required />
            </div>
            <button type="submit">로그인</button>
          </form>
          {studentName && <p className="success">환영합니다, {studentName} 학생!</p>}
          {message && <p className="hint">{message}</p>}
          {error && <p className="error">{error}</p>}
          {studentName && (
            <button className="outline" onClick={onLogout} type="button" style={{ marginTop: 8 }}>
              로그아웃
            </button>
          )}
        </article>

        <article className="card">
          <h2>오늘의 계획</h2>
          <form className="row" onSubmit={onCreatePlan}>
            <input name="title" placeholder="예: 책 30분 읽기" required />
            <button type="submit" style={{ width: 120 }}>
              추가
            </button>
          </form>
          <p className="hint" style={{ marginTop: 10 }}>
            달성률: {summary.completed}/{summary.total} ({summary.rate}%)
          </p>
          <div className="grid" style={{ marginTop: 10 }}>
            {plans.map((plan) => (
              <label key={plan.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{plan.title}</span>
                <input
                  style={{ width: 18, height: 18 }}
                  type="checkbox"
                  checked={plan.isCompleted}
                  onChange={(event) => togglePlan(plan.id, event.target.checked)}
                />
              </label>
            ))}
            {plans.length === 0 && <p className="hint">등록된 계획이 없습니다.</p>}
          </div>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>오늘의 감정 작성</h2>
          <form className="grid" onSubmit={onCreateFeed}>
            <div>
              <label>감정 이모지</label>
              <select name="emotionType" defaultValue="joy">
                {Object.entries(EMOTION_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.emoji} {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>한 줄 기록 (100자)</label>
              <textarea name="content" maxLength={100} required />
            </div>
            <button type="submit">피드 작성</button>
          </form>
        </article>

        <article className="card">
          <h2>감정 타임라인</h2>
          <div className="grid">
            {feeds.map((feed) => (
              <div key={feed.id} className="card" style={{ padding: 12 }}>
                <div className="row space-between">
                  <strong>
                    {EMOTION_META[feed.emotion_type].emoji} {feed.students.student_number}번 {feed.students.name}
                  </strong>
                  <span className="hint" style={{ margin: 0 }}>
                    {new Date(feed.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                <p>{feed.content}</p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {(Object.keys(REACTION_META) as ReactionType[]).map((reactionKey) => {
                    const count = feed.feed_reactions.filter((item) => item.reaction_type === reactionKey).length;
                    return (
                      <button
                        key={reactionKey}
                        type="button"
                        className="ghost"
                        style={{ width: 'auto' }}
                        onClick={() => reactFeed(feed.id, reactionKey)}
                      >
                        {REACTION_META[reactionKey].emoji} {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {feeds.length === 0 && <p className="hint">피드가 없습니다.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
