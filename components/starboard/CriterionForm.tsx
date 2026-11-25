'use client';

/**
 * CriterionForm — 평가 기준 만들기·수정(원본 criteria/CriterionForm.tsx)
 * 이름(60자)·설명(1000자)·단계는 배움성찰과 같은 3단계(노력요함 1 · 보통 2 · 잘함 3)로 고정. 교사는 단계별 기준 문장(200자)만 적습니다.
 * 평가에 쓰인 기준(locked)은 단계를 바꿀 수 없고, attachToBoardId가 있으면 만들고 그 작업장에 바로 붙입니다.
 */
import { useState, type CSSProperties } from 'react';
import type { Criterion, CriterionLevel } from '@/lib/starboard/criteria';
import { buildLevels, LEVEL_GRADES, MAX_LEVEL_DESCRIPTION } from '@/lib/starboard/criteria';
import { GRADE_COLOR, GRADE_LABEL } from '@/lib/learning';
import { json, useSb } from './context';

const DEFAULT_LEVELS: CriterionLevel[] = buildLevels();
/** 입력 순서 — 배움성찰 평가요소 폼과 같이 잘함 → 보통 → 노력요함 */
const INPUT_ORDER = [2, 1, 0] as const;

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
        <legend>단계별 기준{locked && ' — 평가가 있어 바꿀 수 없음'}</legend>
        {/* 배움성찰 평가요소 폼과 같은 3칸 배치(design.md 6.3.3) */}
        <div className="learning-criterion-levels">
        {INPUT_ORDER.map((i) => {
          const grade = LEVEL_GRADES[i];
          return (
            <label
              key={i}
              className="learning-criterion-level"
              style={{ '--grade-color': GRADE_COLOR[grade].text, '--grade-soft': GRADE_COLOR[grade].bg } as CSSProperties}
            >
              <span className="learning-criterion-level-badge">{GRADE_LABEL[grade]} 기준</span>
              <input
                value={levels[i]?.description ?? ''}
                maxLength={MAX_LEVEL_DESCRIPTION}
                onChange={(e) => setLevel(i, { description: e.target.value })}
              />
            </label>
          );
        })}
        </div>
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
