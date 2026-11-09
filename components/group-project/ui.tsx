'use client';

/**
 * 모둠 프로젝트 화면 공용 조각 — 불러오기 훅, 저장 훅, 입력 칸, 상태 배지, 뒤로 가기 버튼
 */
import { DependencyList, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Notice from '@/components/ui/Notice';
import { STATUS_LABEL } from '@/lib/group-project/status';
import type { TaskStatus } from '@/lib/group-project/dates';

/** 화면이 바뀌는 동안 늦게 도착한 이전 응답은 버린다. */
export function useLoad<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const next = await loader();
      if (id !== seq.current) return;
      setData(next);
      setError('');
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : '불러오지 못했어요.');
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

/** 저장·삭제 버튼 하나의 진행 상태와 결과 문구. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const run = useCallback(async (work: () => Promise<string | void>): Promise<boolean> => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const done = await work();
      if (done) setMessage(done);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const feedback = (
    <>
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
    </>
  );

  return { busy, error, message, run, feedback, setError };
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="gp-field">
      <label>
        {label}
        {children}
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`gp-status is-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function OverdueBadge() {
  return <span className="gp-status is-overdue">기한 지남</span>;
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ghost gp-btn gp-back" onClick={onClick}>
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}

export function Loading() {
  return <p className="hint">불러오는 중...</p>;
}

/** 첫 로드 실패와 빈 화면을 한곳에서 처리한다. */
export function LoadGate({ loading, error, hasData, children }: { loading: boolean; error: string; hasData: boolean; children: ReactNode }) {
  if (error && !hasData) return <Notice type="error" message={error} />;
  if (!hasData) return loading ? <Loading /> : null;
  return (
    <>
      <Notice type="error" message={error} />
      {children}
    </>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="gp-section-title">
      <h3>{children}</h3>
      {right}
    </div>
  );
}

export function CheckList({ name, items, selected = [] }: { name: string; items: { id: string; name: string; disabledNote?: string | null }[]; selected?: string[] }) {
  return (
    <div className="gp-check-grid">
      {items.map((item) => (
        <label key={item.id} className={item.disabledNote ? 'gp-check is-disabled' : 'gp-check'}>
          <input type="checkbox" name={name} value={item.id} defaultChecked={selected.includes(item.id)} disabled={Boolean(item.disabledNote)} />
          <span>{item.name}</span>
          {item.disabledNote && <small>({item.disabledNote})</small>}
        </label>
      ))}
    </div>
  );
}
