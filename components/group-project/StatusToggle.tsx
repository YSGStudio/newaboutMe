'use client';

/**
 * StatusToggle — 작업 전/작업 중/작업 완료 3단 토글
 * 담당자·작성 권한자·담임만 바꿀 수 있고, 권한이 없으면 비활성으로 보입니다(라우트에서도 다시 막습니다).
 */
import { useState } from 'react';
import type { TaskStatus } from '@/lib/group-project/dates';
import { STATUS_LABEL, STATUSES } from '@/lib/group-project/status';
import { useGp } from './context';

type Props = { taskId: string; status: TaskStatus; canChange: boolean; onChanged?: () => void };

export default function StatusToggle({ taskId, status, canChange, onChanged }: Props) {
  const { api } = useGp();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function change(next: TaskStatus) {
    const prev = current;
    setCurrent(next);
    setError('');
    setBusy(true);
    try {
      await api(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      onChanged?.();
    } catch (e) {
      setCurrent(prev);
      setError(e instanceof Error ? e.message : '바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="상태" className="gp-status-toggle">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={current === s}
            disabled={!canChange || busy}
            className={current === s ? `is-${s} is-active` : ''}
            onClick={() => change(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {error && <p className="gp-error-text">{error}</p>}
    </div>
  );
}
