'use client';

/**
 * CriteriaManager — 교사의 평가 기준 목록(원본 criteria/page.tsx + CriteriaClient)
 * 학급·프로젝트와 상관없이 재사용합니다. 평가에 쓰인 기준은 "평가에 사용됨 · 단계 잠김"으로 표시하고 삭제를 막습니다.
 * "복사해서 수정"은 새 기준 행을 만듭니다.
 */
import { useState } from 'react';
import { useLoad } from '@/components/group-project/ui';
import type { Criterion } from '@/lib/starboard/criteria';
import { json, useSb } from './context';
import CriterionForm from './CriterionForm';

export default function CriteriaManager() {
  const { api } = useSb();
  const { data, reload } = useLoad(() => api<{ criteria: Criterion[]; locked: string[] }>('/criteria'), [api]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lockedSet = new Set(data?.locked ?? []);
  const criteria = data?.criteria ?? [];

  const run = async (work: () => Promise<unknown>) => {
    setPending(true);
    try {
      await work();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setPending(false);
      reload();
    }
  };

  return (
    <div className="sb-criteria">
      <div className="sb-page-title">
        <h2>평가 기준</h2>
      </div>
      <details className="card sb-create-card">
        <summary>새 기준 만들기</summary>
        <div className="sb-create-body">
          <CriterionForm onDone={reload} />
        </div>
      </details>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <ul className="sb-stack" data-testid="criteria-list">
        {criteria.map((c) => {
          const isLocked = lockedSet.has(c.id);
          return (
            <li key={c.id} className="card" data-testid="criterion">
              <div className="sb-row-wrap">
                <h3 className="sb-strong">{c.name}</h3>
                {isLocked && <span className="badge sb-badge-hide">평가에 사용됨 · 단계 잠김</span>}
                <div className="sb-row-wrap sb-push-right">
                  <button type="button" className="sb-btn ghost is-small" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                    수정
                  </button>
                  <button type="button" className="sb-btn ghost is-small" disabled={pending} onClick={() => run(() => api(`/criteria/${c.id}/copy`, json('POST')))}>
                    복사해서 수정
                  </button>
                  <button type="button" className="sb-btn is-danger is-small" disabled={pending || isLocked} onClick={() => run(() => api(`/criteria/${c.id}`, json('DELETE')))}>
                    삭제
                  </button>
                </div>
              </div>
              {c.description && <p className="hint">{c.description}</p>}
              <ol className="sb-level-chips">
                {c.levels.map((l, i) => (
                  <li key={i}>
                    {l.name} ({l.score})
                  </li>
                ))}
              </ol>
              {editing === c.id && (
                <div className="sb-divider">
                  <CriterionForm
                    criterion={c}
                    locked={isLocked}
                    onDone={() => {
                      setEditing(null);
                      reload();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
        {data && criteria.length === 0 && <li className="sb-meta">기준이 없습니다.</li>}
      </ul>
    </div>
  );
}
