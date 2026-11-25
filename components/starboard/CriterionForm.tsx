'use client';

/**
 * CriterionForm — 평가 기준 만들기·수정(원본 criteria/CriterionForm.tsx)
 * 이름(60자)·설명(1000자)·단계 2~5개(이름·점수·설명). 기본 단계는 노력 필요 1 · 보통 2 · 잘함 3.
 * 평가에 쓰인 기준(locked)은 단계를 바꿀 수 없고, attachToBoardId가 있으면 만들고 그 작업장에 바로 붙입니다.
 */
import { useState } from 'react';
import type { Criterion, CriterionLevel } from '@/lib/starboard/criteria';
import { MAX_LEVELS, MIN_LEVELS } from '@/lib/starboard/criteria';
import { json, useSb } from './context';

const DEFAULT_LEVELS: CriterionLevel[] = [
  { name: '노력 필요', score: 1, description: '' },
  { name: '보통', score: 2, description: '' },
  { name: '잘함', score: 3, description: '' },
];

type Props = { criterion?: Criterion; attachToBoardId?: string; locked?: boolean; onDone?: () => void };

export default function CriterionForm({ criterion, attachToBoardId, locked, onDone }: Props) {
  const { api } = useSb();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(criterion?.name ?? '');
  const [description, setDescription] = useState(criterion?.description ?? '');
  const [levels, setLevels] = useState<CriterionLevel[]>(criterion?.levels ?? DEFAULT_LEVELS);
  const setLevel = (i: number, patch: Partial<CriterionLevel>) => setLevels(levels.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const idp = criterion?.id ?? attachToBoardId ?? 'new';

  return (
    <form
      className="sb-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          const input = { name, description, levels };
          if (criterion) await api(`/criteria/${criterion.id}`, json('PATCH', input));
          else await api('/criteria', json('POST', { ...input, attachToBoardId }));
          setError('');
          if (!criterion) {
            setName('');
            setDescription('');
            setLevels(DEFAULT_LEVELS);
          }
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label htmlFor={`cr-name-${idp}`}>기준 이름</label>
        <input id={`cr-name-${idp}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor={`cr-desc-${idp}`}>설명</label>
        <textarea id={`cr-desc-${idp}`} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <fieldset disabled={locked} className="sb-fieldset">
        <legend>
          단계 ({MIN_LEVELS}~{MAX_LEVELS}개){locked && ' — 평가가 있어 바꿀 수 없음'}
        </legend>
        {levels.map((l, i) => (
          <div key={i} className="sb-level-row" data-testid="level-row">
            <input aria-label={`${i + 1}단계 이름`} value={l.name} onChange={(e) => setLevel(i, { name: e.target.value })} required />
            <input
              type="number"
              step="any"
              aria-label={`${i + 1}단계 점수`}
              value={Number.isFinite(l.score) ? l.score : ''}
              onChange={(e) => setLevel(i, { score: e.target.valueAsNumber })}
              required
            />
            <input className="sb-level-desc" aria-label={`${i + 1}단계 설명`} placeholder="설명" value={l.description ?? ''} onChange={(e) => setLevel(i, { description: e.target.value })} />
            <button type="button" className="sb-icon-btn" aria-label={`${i + 1}단계 빼기`} onClick={() => setLevels(levels.filter((_, k) => k !== i))}>
              −
            </button>
          </div>
        ))}
        <button type="button" className="sb-btn ghost sb-auto" onClick={() => setLevels([...levels, { name: '', score: levels.length + 1, description: '' }])}>
          ＋ 단계 추가
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="sb-error">
          {error}
        </p>
      )}
      <button className="sb-btn sb-auto" disabled={pending}>
        {criterion ? '저장' : attachToBoardId ? '만들고 이 보드에 붙이기' : '기준 만들기'}
      </button>
    </form>
  );
}
