'use client';

/**
 * LearningCriteriaImport — 배움성찰 평가요소를 별빛보드 기준으로 불러오기(복사)
 * 내 모든 학급의 배움성찰 활동 중 평가요소가 있는 것을 고르면, 그 활동의 평가요소가 기준 목록에 새로 생깁니다.
 * attachToBoardId가 있으면 만든 기준을 그 작업장에도 바로 붙입니다. 복사본은 원래 활동과 이어지지 않습니다.
 */
import { useState } from 'react';
import { useLoad } from '@/components/group-project/ui';
import { json, useSb } from './context';

type Source = { id: string; className: string; subject: string; unit: string; title: string; criteria: { name: string }[] };

export default function LearningCriteriaImport({ attachToBoardId, onDone }: { attachToBoardId?: string; onDone?: () => void }) {
  const { api } = useSb();
  const { data } = useLoad(() => api<{ activities: Source[] }>('/learning-criteria'), [api]);
  const [pick, setPick] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sources = data?.activities ?? [];
  const picked = sources.find((s) => s.id === pick);

  if (data && sources.length === 0) return <p className="sb-meta">불러올 배움성찰 평가요소가 없습니다.</p>;

  return (
    <form
      className="sb-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pick) return;
        setPending(true);
        try {
          const res = await api<{ created: number }>('/learning-criteria', json('POST', { activityId: pick, attachToBoardId }));
          setMessage(`평가요소 ${res.created}개를 기준으로 불러왔습니다.`);
          setError('');
          setPick('');
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
          setMessage('');
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="sb-inline-form">
        <select aria-label="불러올 배움성찰 활동" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">배움성찰 활동 고르기</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.className} · {s.subject} · {[s.unit, s.title].filter(Boolean).join(' ')} ({s.criteria.length}개)
            </option>
          ))}
        </select>
        <button className="sb-btn ghost" disabled={!pick || pending}>
          {attachToBoardId ? '불러와서 붙이기' : '불러오기'}
        </button>
      </div>
      {picked && <p className="hint">{picked.criteria.map((c) => c.name).join(' · ')}</p>}
      {message && <p className="sb-meta">{message}</p>}
      {error && (
        <p role="alert" className="sb-error">
          {error}
        </p>
      )}
    </form>
  );
}
