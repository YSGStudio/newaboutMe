'use client';

/**
 * VoyageDashboard — 교사용 "항해"(스타 보이저) 관리 화면
 * 학급 전체 학생의 연료·현재 기항지·연속일 현황을 표로 보여주고,
 * 교사가 특정 학생에게 연료를 수동으로 지급/회수(사유 필수)할 수 있습니다.
 * 서버 API: /api/teacher/voyage (담임교사가 자기 학급에 대해서만 접근).
 * (학생이 실제로 연료를 모으고 항해하는 화면은 components/student/VoyageContent.)
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import RefreshButton from '@/components/ui/RefreshButton';

type Star = { level: number; name: string; emoji: string; fuel_threshold: number };
type StudentVoyage = {
  id: string;
  name: string;
  student_number: number;
  voyage_state: {
    total_fuel: number;
    current_star: number;
    ship_tier: number;
    streak_days: number;
    last_active_on: string | null;
  } | Array<{
    total_fuel: number;
    current_star: number;
    ship_tier: number;
    streak_days: number;
    last_active_on: string | null;
  }> | null;
};

const stateOf = (student: StudentVoyage) => {
  const raw = Array.isArray(student.voyage_state) ? student.voyage_state[0] : student.voyage_state;
  return raw ?? { total_fuel: 0, current_star: 0, ship_tier: 1, streak_days: 0, last_active_on: null };
};

export default function VoyageDashboard({ classId }: { classId: string }) {
  const [students, setStudents] = useState<StudentVoyage[]>([]);
  const [stars, setStars] = useState<Star[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/teacher/voyage?classId=${classId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '항해 현황을 불러오지 못했습니다.');
      setStudents(json.students ?? []);
      setStars(json.stars ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const grant = async (event: FormEvent<HTMLFormElement>, student: StudentVoyage) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const note = String(form.get('note') ?? '');
    setBusyId(student.id);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/teacher/voyage/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, amount, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : '연료를 조정하지 못했습니다.');
      setMessage(`${student.name} 학생의 연료를 ${amount > 0 ? `${amount}만큼 지급` : `${Math.abs(amount)}만큼 회수`}했습니다.`);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId('');
    }
  };

  if (!classId) return <EmptyState title="학급을 먼저 선택하세요" description="헤더에서 학급을 선택하면 항해 현황을 볼 수 있습니다." />;

  return (
    <section className="voyage-teacher">
      <div className="row space-between voyage-teacher-heading">
        <div><p>STAR VOYAGER CONTROL</p><h2>학급 우주여행 관제소</h2><span>학생들의 항해를 응원하고 특별 활동 연료를 관리합니다.</span></div>
        <RefreshButton onClick={load} loading={loading} />
      </div>
      <Notice type="success" message={message} />
      <Notice type="error" message={error} />

      {loading && students.length === 0 ? <p className="hint">우주선 신호를 찾는 중...</p> : students.length === 0 ? (
        <EmptyState title="등록된 학생이 없습니다" description="학생을 등록하면 우주여행을 시작할 수 있습니다." />
      ) : (
        <div className="voyage-teacher-grid">
          {students.map((student) => {
            const state = stateOf(student);
            const currentStar = stars.find((star) => star.level === state.current_star);
            const nextStar = stars.find((star) => star.fuel_threshold > state.total_fuel);
            const percent = nextStar ? Math.min(100, (state.total_fuel / nextStar.fuel_threshold) * 100) : 100;
            return (
              <article key={student.id} className="voyage-student-card">
                <div className="row space-between">
                  <div><small>{student.student_number}번 탐험가</small><h3>{student.name}</h3></div>
                  <span className="voyage-student-ship">🚀</span>
                </div>
                <div className="voyage-student-stats">
                  <span>⛽ <strong>{state.total_fuel}</strong></span>
                  <span>🔥 {state.streak_days}일</span>
                  <span>{currentStar ? `${currentStar.emoji} ${currentStar.name}` : '🌍 지구'}</span>
                </div>
                <div className="voyage-mini-gauge"><div style={{ width: `${percent}%` }} /></div>
                <p>{nextStar ? `${nextStar.name}까지 ${nextStar.fuel_threshold - state.total_fuel} 연료` : '최종 목적지 도착!'}</p>
                <form onSubmit={(event) => grant(event, student)} className="voyage-grant-form">
                  <input name="amount" type="number" min="-100" max="100" placeholder="+/- 연료" required />
                  <input name="note" minLength={2} maxLength={100} placeholder="지급·회수 사유" required />
                  <button type="submit" disabled={busyId === student.id}>{busyId === student.id ? '처리 중' : '적용'}</button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

