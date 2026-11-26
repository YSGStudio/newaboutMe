'use client';

/**
 * PeerReviewModal / ReviewSummaryModal — 동료평가와 평가 보기(원본 kanban/ReviewModals.tsx)
 * 평가하기: 교사가 붙인 기준마다 별(1~단계 수)을 고릅니다. 같은 별을 다시 누르면 지웁니다. 누가 줬는지는 보이지 않아요.
 * 평가 보기: 선생님 평가 총평균 + 친구 평가 총평균(5점 만점 환산), 기준별 별 막대, 선생님 한마디.
 */
import { useEffect, useRef, useState } from 'react';
import type { Criterion } from '@/lib/starboard/criteria';
import { fmt1, maxStars, overallOutOf5, starLabel, teacherStars, type ReviewSummary, type Stars } from '@/lib/starboard/peer';
import { json, useSb } from './context';

/** 섹션 이름 '01. 이름' → '이름' */
export const memberName = (columnName: string) => columnName.replace(/^\d+\.\s*/, '');

function ReviewModal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sb-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className="sb-modal sb-review-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sb-modal-head">
          <h2 className="sb-modal-title">{label}</h2>
          <button ref={closeButton} type="button" className="sb-icon-btn sb-close" onClick={onClose} aria-label="닫기" title="닫기">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 별 입력: 1..max. 같은 별을 다시 누르면 지운다 */
function StarInput({ c, value, onChange }: { c: Criterion; value: number | undefined; onChange: (v: number | undefined) => void }) {
  const max = maxStars(c);
  return (
    <div className="sb-stars" role="radiogroup" aria-label={`${c.name} 별점`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          aria-label={`별 ${k}개 (${starLabel(c, k)})`}
          title={starLabel(c, k)}
          className={value !== undefined && k <= value ? 'sb-star is-on' : 'sb-star'}
          onClick={() => onChange(value === k ? undefined : k)}
          data-testid="star"
        >
          ★
        </button>
      ))}
      <span className="sb-meta">{value ? `${value}/${max} · ${starLabel(c, value)}` : '아직 안 골랐어요'}</span>
    </div>
  );
}

/** 별 보기 (소수 평균은 부분 채움) */
function StarMeter({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span className="sb-meta">—</span>;
  return (
    <span className="sb-star-meter">
      <span className="sb-star-track" aria-hidden="true">
        {'★'.repeat(max)}
        <span className="sb-star-fill" style={{ width: `${(value / max) * 100}%` }}>
          {'★'.repeat(max)}
        </span>
      </span>
      <span className="sb-strong">
        {fmt1(value)}
        <span className="sb-meta">/{max}</span>
      </span>
    </span>
  );
}

/** 친구 평가하기: 교사가 붙인 평가 기준마다 별점 */
export function PeerReviewModal({ boardId, target, criteria, onClose }: { boardId: string; target: { id: string; name: string }; criteria: Criterion[]; onClose: () => void }) {
  const { api } = useSb();
  const [stars, setStars] = useState<Stars | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // 늦게 온 응답이 이미 고른 별을 덮어쓰지 않도록, 처음 한 번만 채운다
    let alive = true;
    api<{ stars: Stars }>(`/boards/${boardId}/peer/${target.id}`)
      .then((r) => alive && setStars((cur) => cur ?? r.stars ?? {}))
      .catch(() => alive && setStars((cur) => cur ?? {}));
    return () => {
      alive = false;
    };
  }, [api, boardId, target.id]);
  const done = stars ? criteria.filter((c) => stars[c.id]).length : 0;

  return (
    <ReviewModal label={`⭐ ${target.name} 평가하기`} onClose={onClose}>
      <p className="hint">선생님이 정한 평가 기준마다 별을 골라 주세요. 누가 줬는지는 친구에게 보이지 않고, 평균만 보여요.</p>
      {stars === null ? (
        <p className="sb-empty-row">불러오는 중…</p>
      ) : (
        <form
          className="sb-stack"
          data-testid="peer-review-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              const r = await api<{ stars: Stars }>(`/boards/${boardId}/peer/${target.id}`, json('PUT', { stars }));
              setStars(r.stars);
              setMsg({ ok: true, text: Object.keys(r.stars).length ? '평가를 저장했어요.' : '평가를 지웠어요.' });
            } catch (err) {
              setMsg({ ok: false, text: err instanceof Error ? err.message : '저장하지 못했어요.' });
            } finally {
              setPending(false);
            }
          }}
        >
          {criteria.map((c) => (
            <fieldset key={c.id} className="sb-review-criterion">
              <legend className="sb-sr-only">{c.name}</legend>
              <p className="sb-strong">{c.name}</p>
              {c.description && <p className="hint">{c.description}</p>}
              <CriterionLevels criterion={c} />
              <StarInput
                c={c}
                value={stars[c.id]}
                onChange={(v) =>
                  setStars((cur) => {
                    const n = { ...(cur ?? {}) };
                    if (v === undefined) delete n[c.id];
                    else n[c.id] = v;
                    return n;
                  })
                }
              />
            </fieldset>
          ))}
          {msg && (
            <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'notice success' : 'notice error'}>
              {msg.text}
            </p>
          )}
          <div className="sb-modal-actions">
            <span className="sb-meta">
              {done}/{criteria.length}개 골랐어요
            </span>
            <span className="sb-flex-1" />
            <button type="button" className="sb-btn ghost" onClick={onClose}>
              닫기
            </button>
            <button className="sb-btn" disabled={pending || (done === 0 && !msg)}>
              {pending ? '저장 중…' : '평가 저장'}
            </button>
          </div>
        </form>
      )}
    </ReviewModal>
  );
}

/** 내 평가 보기(학생 본인) / 학생 평가 보기(교사): 선생님 평가 + 친구들 평가 평균 */
export function ReviewSummaryModal({ boardId, student, criteria: boardCriteria, onClose }: {
  boardId: string;
  student: { id: string; name: string };
  criteria: Criterion[];
  onClose: () => void;
}) {
  const { api, isTeacher } = useSb();
  const [data, setData] = useState<ReviewSummary | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api<{ summary: ReviewSummary | null }>(`/boards/${boardId}/review/${student.id}`)
      .then((r) => alive && setData(r.summary))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [api, boardId, student.id]);

  const criteria = data?.criteria ?? boardCriteria;
  const tStars = data?.teacher ? teacherStars(criteria, data.teacher.levels) : null;
  const tOverall = tStars ? overallOutOf5(criteria, tStars) : null;
  const pOverall = data && data.peer_count > 0 ? overallOutOf5(criteria, data.peer_avg) : null;

  return (
    <ReviewModal label={isTeacher ? `📊 ${student.name} 평가 보기` : '📊 내 평가 보기'} onClose={onClose}>
      {data === undefined && <p className="sb-empty-row" role="status">평가 결과를 불러오는 중…</p>}
      {data === null && <p className="notice info">평가 결과를 불러올 수 없어요.</p>}
      {criteria.length === 0 && data && <p className="sb-empty-row">아직 이 작업장에 평가 기준이 없어요.</p>}
      {criteria.length > 0 && (
        <div className="sb-stack" data-testid="review-summary">
          {data && (
            <div className="sb-review-totals">
              <div className="sb-review-total is-teacher">
                <span>선생님 평가 총평균</span>
                <strong data-testid="teacher-overall">
                  {tOverall === null ? '—' : fmt1(tOverall)}
                  <small> / 5</small>
                </strong>
                {isTeacher && data.teacher && !data.teacher.published && <span className="sb-gold">학생에게 아직 비공개</span>}
              </div>
              <div className="sb-review-total">
                <span>친구 평가 총평균</span>
                <strong data-testid="peer-overall">
                  {pOverall === null ? '—' : fmt1(pOverall)}
                  <small> / 5</small>
                </strong>
                <span className="sb-meta" data-testid="peer-count">
                  {data.peer_count}명이 평가했어요
                </span>
              </div>
            </div>
          )}
          {criteria.map((c) => (
            <section className="sb-review-criterion" key={c.id} data-testid="review-row">
              <h3>{c.name}</h3>
              {c.description && <p className="hint">{c.description}</p>}
              <CriterionLevels criterion={c} selected={data?.teacher?.levels[c.id]} />
              {data && <div className="sb-row-wrap sb-review-scores">
                <div className="sb-review-stars"><span className="sb-meta">선생님</span><StarMeter value={tStars?.[c.id] ?? null} max={maxStars(c)} /></div>
                <div className="sb-review-stars"><span className="sb-meta">친구들 평균</span><StarMeter value={data.peer_avg[c.id] ?? null} max={maxStars(c)} /></div>
              </div>}
            </section>
          ))}
          {data && !data.teacher && <p className="notice info">{isTeacher ? '아직 이 학생을 평가하지 않았어요.' : '선생님 평가는 아직 공개되지 않았어요.'}</p>}
          {data?.teacher?.feedback && (
            <div className="sb-teacher-note">
              <p className="sb-meta sb-strong">선생님 한마디</p>
              <p className="sb-prewrap">{data.teacher.feedback}</p>
            </div>
          )}
        </div>
      )}
    </ReviewModal>
  );
}

export function CriterionLevels({ criterion, selected }: { criterion: Criterion; selected?: number }) {
  const levels = criterion.levels.map((level, index) => ({ ...level, index })).sort((a, b) => b.score - a.score);
  return (
    <ul className="sb-review-levels">
      {levels.map((level) => (
        <li key={level.index} className={selected === level.index ? 'is-selected' : undefined}>
          <b>{level.name} · {level.score}점</b>
          {level.description && <span>{level.description}</span>}
          {selected === level.index && <span className="sb-strong">선생님이 선택한 단계</span>}
        </li>
      ))}
    </ul>
  );
}

export function RubricModal({ criteria, onClose }: { criteria: Criterion[]; onClose: () => void }) {
  return (
    <ReviewModal label="평가 기준" onClose={onClose}>
      {criteria.map((criterion) => (
        <section className="sb-review-criterion" key={criterion.id}>
          <h3>{criterion.name}</h3>
          {criterion.description && <p className="hint">{criterion.description}</p>}
          <CriterionLevels criterion={criterion} />
        </section>
      ))}
    </ReviewModal>
  );
}
