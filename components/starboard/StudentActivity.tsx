'use client';

import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import { useLoad } from '@/components/group-project/ui';
import { useSb } from './context';
import StudentIdentity from './StudentIdentity';

type Student = { id: string; name: string; student_number: number };
type PeerReview = { reviewer_student_id: string; target_student_id: string; stars: Record<string, number> };
type ActivityData = { board: { title: string }; summary: { students: Student[] }; reviews: PeerReview[] };

const MODES = [
  ['table', '평가표'],
  ['chart', '학생별 합계'],
] as const;

export default function StudentActivity({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const { api } = useSb();
  const [mode, setMode] = useState<(typeof MODES)[number][0]>('table');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('number');
  const { data, error } = useLoad(() => api<ActivityData>(`/boards/${boardId}/students`), [api, boardId]);
  if (!data) return error ? <Notice type="error" message={error} /> : <p className="hint">불러오는 중...</p>;
  const { board: { title }, summary: { students }, reviews } = data;
  const roster = [...students].sort((a, b) => a.student_number - b.student_number || a.name.localeCompare(b.name, 'ko'));
  const scoresByStudent = new Map(roster.map((student) => [student.id, new Map<string, number>()]));
  const submissionsByStudent = new Map(roster.map((student) => [student.id, 0]));
  for (const review of reviews) {
    const received = scoresByStudent.get(review.target_student_id);
    if (!received || !submissionsByStudent.has(review.reviewer_student_id) || review.reviewer_student_id === review.target_student_id) continue;
    const stars = Object.values(review.stars ?? {}).filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
    if (stars.length === 0) continue;
    received.set(review.reviewer_student_id, stars.reduce((sum, score) => sum + score, 0) / stars.length);
    submissionsByStudent.set(review.reviewer_student_id, (submissionsByStudent.get(review.reviewer_student_id) ?? 0) + 1);
  }
  const activity = roster.map((student) => {
    const scores = Array.from(scoresByStudent.get(student.id)?.values() ?? []);
    return {
      ...student,
      total: submissionsByStudent.get(student.id) ?? 0,
      average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    };
  });
  const total = activity.reduce((sum, student) => sum + student.total, 0);
  const active = activity.filter((student) => student.total > 0).length;
  const largestTotal = Math.max(1, ...activity.map((student) => student.total));
  const keyword = search.trim().toLowerCase();
  const shown = activity.filter((student) => student.name.toLowerCase().includes(keyword) || String(student.student_number).includes(keyword));
  if (sort === 'desc') shown.sort((a, b) => b.total - a.total);
  if (sort === 'asc') shown.sort((a, b) => a.total - b.total);
  const stats = [
    ['전체 학생', roster.length, '명', '학급 전체 인원'],
    ['참여 학생', active, '명', `참여율 ${roster.length ? Math.round(active / roster.length * 100) : 0}%`],
    ['총 상호작용', total, '회', '제출된 동료평가'],
    ['평균 활동', (total / (roster.length || 1)).toFixed(1), '회', '학생 1인당 평균'],
  ];

  return (
    <main className="sb-activity">
      <header className="sb-activity-header">
        <div>
          <h2>학생별 활동 현황</h2>
          <p>{title}</p>
        </div>
        <button type="button" className="sb-btn-dark" onClick={onClose}>← 작업장</button>
      </header>
      <section className="sb-activity-stats" aria-label="활동 통계">
        {stats.map(([label, value, unit, description]) => (
          <article key={label} className="sb-activity-stat">
            <p>{label}</p>
            <div><strong>{value}</strong> {unit}</div>
            <small>{description}</small>
          </article>
        ))}
      </section>
      <section className="sb-activity-panel" aria-labelledby="sb-activity-heading">
        <div className="sb-activity-toolbar">
          <div>
            <h3 id="sb-activity-heading">동료평가 결과</h3>
            <p>{mode === 'table'
              ? '행은 평가받은 학생, 열은 평가한 학생입니다. 각 칸은 평가 항목의 평균(5점 만점)이고, 오른쪽은 받은 점수의 평균입니다. —는 본인 또는 미제출입니다.'
              : '학생이 동료평가를 제출한 상대 학생 수를 표시합니다.'}</p>
          </div>
        </div>
        <div className="sb-activity-toolbar sb-activity-controls">
          <div className="sb-activity-modes" role="group" aria-label="활동 보기">
            {MODES.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>
            ))}
          </div>
          <div className="sb-activity-filters">
            <input type="search" aria-label="학생 이름 또는 번호 검색" placeholder="학생 이름 또는 번호 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="학생 정렬" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="number">번호순</option>
              <option value="desc">활동 많은 순</option>
              <option value="asc">활동 적은 순</option>
            </select>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="hint" role="status">{roster.length ? '검색 결과가 없어요.' : '표시할 학생이 없어요.'}</p>
        ) : mode === 'chart' ? (
          <ul className="sb-activity-chart">
            {shown.map((student) => (
              <li key={student.id}>
                <StudentIdentity name={student.name} number={student.student_number} />
                <div className="sb-activity-track" aria-hidden="true"><div style={{ width: `${student.total / largestTotal * 100}%` }} /></div>
                <strong>{student.total}회</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="sb-activity-scroll" tabIndex={0} role="region" aria-label="학생별 동료평가 점수">
            <table className="sb-activity-matrix">
              <thead>
                <tr>
                  <th scope="col">평가받은 학생</th>
                  {roster.map((student) => (
                    <th key={student.id} scope="col"><small>{student.student_number}번</small>{student.name}</th>
                  ))}
                  <th scope="col" className="sb-activity-total">평균</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((student) => (
                  <tr key={student.id}>
                    <th scope="row"><StudentIdentity name={student.name} number={student.student_number} /></th>
                    {roster.map((reviewer) => {
                      const score = scoresByStudent.get(student.id)?.get(reviewer.id);
                      const label = student.id === reviewer.id ? '본인' : '미제출';
                      return (
                        <td key={reviewer.id}>
                          <span className="sb-activity-cell">
                            {score == null ? <span aria-label={label}>—</span> : score.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="sb-activity-total">{student.average?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
