'use client';

/**
 * StudentSummary — 교사의 학생별 보기(원본 boards/[boardId]/students/page.tsx + PublishAll)
 * 학생 × 섹션별 자기 카드 수, 개인 보드 카드 수(누르면 그 보드), 평가 상태(누르면 평가 화면)와 보드 전체 평가 공개/취소.
 */
import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import { useLoad } from '@/components/group-project/ui';
import { json, useSb } from './context';

type Summary = {
  columns: { id: string; name: string; color: string }[];
  has_criteria: boolean;
  students: {
    id: string;
    name: string;
    student_number: number;
    counts: Record<string, number>;
    personal_board_id: string | null;
    personal_count: number | null;
    personal_counts: { name: string; count: number }[] | null;
    evaluation_status: 'none' | 'draft' | 'published';
  }[];
};

const STATUS: Record<Summary['students'][number]['evaluation_status'], string> = { none: '미평가', draft: '작성 중', published: '공개됨' };

export default function StudentSummary({ projectId, boardId }: { projectId: string; boardId: string }) {
  const { api, go } = useSb();
  const [filter, setFilter] = useState<'all' | 'pending' | 'published'>('all');
  const { data, error, reload } = useLoad(() => api<{ board: { id: string; title: string }; summary: Summary }>(`/boards/${boardId}/students`), [api, boardId]);
  if (!data) return error ? <Notice type="error" message={error} /> : <p className="hint">불러오는 중...</p>;
  const s = data.summary;
  const hasPersonal = s.students.some((x) => x.personal_board_id);
  const published = s.students.filter((student) => student.evaluation_status === 'published').length;
  const students = s.students.filter((student) => !s.has_criteria || filter === 'all' || (student.evaluation_status === 'published') === (filter === 'published'));
  return (
    <main className="sb-summary">
      <header className="sb-space-header sb-summary-head">
        <div>
          <h2 className="sb-page-heading">학생별 현황</h2>
          <p>{data.board.title}</p>
        </div>
        <button type="button" className="sb-btn-dark" onClick={() => go({ name: 'board', projectId, boardId })}>← 작업장</button>
      </header>
      {s.has_criteria && (
        <div className="sb-row-wrap sb-summary-filters" role="group" aria-label="평가 상태">
          <button type="button" className="sb-filter-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>전체 {s.students.length}명</button>
          <button type="button" className="sb-filter-chip" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>미공개 {s.students.length - published}명</button>
          <button type="button" className="sb-filter-chip" aria-pressed={filter === 'published'} onClick={() => setFilter('published')}>공개 {published}명</button>
        </div>
      )}
      {s.has_criteria && <PublishAll boardId={boardId} onDone={reload} />}
      <div className="card sb-table-scroll">
        <table className="table sb-summary-table" data-testid="summary-table">
          <thead>
            <tr>
              <th>학생</th>
              {s.columns.map((c) => (
                <th key={c.id}>
                  <span className="sb-color-dot" style={{ background: c.color }} aria-hidden="true" />
                  {c.name}
                </th>
              ))}
              {hasPersonal && <th>개인 보드 카드</th>}
              {s.has_criteria && <th>평가</th>}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={1 + s.columns.length + Number(hasPersonal) + Number(s.has_criteria)}>표시할 학생이 없어요.</td></tr>}
            {students.map((st) => (
              <tr key={st.id} data-testid={`summary-${st.student_number}`}>
                <td>
                  {st.name} <span className="sb-meta">{st.student_number}번</span>
                </td>
                {s.columns.map((c) => (
                  <td key={c.id} className="sb-num" data-testid="count-cell">
                    {st.counts[c.id] ?? 0}
                  </td>
                ))}
                {hasPersonal && (
                  <td>
                    {st.personal_board_id ? (
                      <button type="button" className="sb-link" data-testid="personal-count" onClick={() => go({ name: 'board', projectId, boardId: st.personal_board_id! })}>
                        {st.personal_count}개
                      </button>
                    ) : (
                      '—'
                    )}
                    {st.personal_counts && st.personal_counts.length > 0 && (
                      <span className="sb-meta"> {st.personal_counts.map((p) => `${p.name} ${p.count}`).join(' · ')}</span>
                    )}
                  </td>
                )}
                {s.has_criteria && (
                  <td>
                    <button type="button" className="sb-btn ghost is-small" data-testid="eval-status" onClick={() => go({ name: 'evaluate', projectId, boardId, studentId: st.id })}>
                      <span className="sb-eval-status" data-state={st.evaluation_status}>{STATUS[st.evaluation_status]}</span>
                      {st.evaluation_status === 'none' ? '평가하기' : '평가 열기'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function PublishAll({ boardId, onDone }: { boardId: string; onDone: () => void }) {
  const { api } = useSb();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async (published: boolean) => {
    setPending(true);
    try {
      const r = await api<{ count: number }>(`/boards/${boardId}/evaluations`, json('POST', { published }));
      setMsg(`${r.count ?? 0}건을 ${published ? '공개' : '공개 취소'}했습니다.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setPending(false);
      onDone();
    }
  };
  return (
    <div className="sb-row-wrap sb-publish-all">
      <button type="button" className="sb-btn" disabled={pending} onClick={() => go(true)}>
        보드 전체 평가 공개
      </button>
      <button type="button" className="sb-btn ghost" disabled={pending} onClick={() => go(false)}>
        전체 공개 취소
      </button>
      {msg && <span className="sb-meta">{msg}</span>}
    </div>
  );
}
