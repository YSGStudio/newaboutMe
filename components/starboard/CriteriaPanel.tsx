'use client';

/**
 * CriteriaPanel / MyEvaluationPanel — 작업장 상단의 평가 기준 펼침과 학생의 "선생님 평가"(원본 board/CriteriaPanel.tsx)
 * 기준은 교사·미리 보여주기·동료평가 중 하나가 켜져 있을 때 보입니다. 선생님 평가는 공개된 자기 평가만 보입니다.
 */
import type { BoardView } from '@/lib/starboard/types';

export function CriteriaPanel({ view }: { view: BoardView }) {
  if (!view.criteria.length) return null;
  return (
    <details className="card sb-criteria-panel" data-testid="criteria-panel">
      <summary>평가 기준 {view.criteria.length}개</summary>
      <ul>
        {view.criteria.map((c) => (
          <li key={c.id}>
            <p className="sb-strong">{c.name}</p>
            {c.description && <p className="hint">{c.description}</p>}
            <ol className="sb-level-chips">
              {c.levels.map((l, i) => (
                <li key={i}>
                  <b>{l.name}</b> ({l.score}점){l.description ? ` — ${l.description}` : ''}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function MyEvaluationPanel({ view }: { view: BoardView }) {
  const e = view.my_evaluation;
  if (!e) return null;
  return (
    <section className="sb-my-eval" data-testid="my-evaluation">
      <h2>선생님 평가</h2>
      <ul>
        {e.criteria.map((c) => {
          const level = c.levels[e.levels[c.id]];
          return (
            <li key={c.id}>
              <span className="sb-strong">{c.name}</span>
              <span className="sb-my-eval-level">{level ? `${level.name} (${level.score}점)` : '—'}</span>
            </li>
          );
        })}
      </ul>
      {e.feedback && <p className="sb-my-eval-feedback">{e.feedback}</p>}
    </section>
  );
}
