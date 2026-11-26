'use client';

/**
 * EvaluationScreen — 교사의 학생 평가 화면(원본 evaluate/[studentId]/page.tsx + EvaluationForm + EvaluationTarget)
 * 왼쪽: 평가 대상(그 학생의 개인 보드와 하위 전체, 또는 이 작업장에 쓴 카드)을 읽기 전용 칸반으로.
 * 오른쪽: 기준별 단계 선택 + 피드백(2000자). 0.6초 뒤 자동 저장, 칸을 벗어나거나 이동할 때 바로 저장,
 * 이 학생 평가 공개/공개 취소, 이전·다음 학생.
 */
import { useEffect, useRef, useState } from 'react';
import Notice from '@/components/ui/Notice';
import { useLoad } from '@/components/group-project/ui';
import type { Criterion } from '@/lib/starboard/criteria';
import { formatKST } from '@/lib/starboard/datetime';
import type { BoardView } from '@/lib/starboard/types';
import { json, useSb } from './context';
import Kanban from './Kanban';

type Data = {
  board: { id: string; title: string };
  criteria: Criterion[];
  student: { id: string; name: string; student_number: number };
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  evaluation: { levels: Record<string, number>; feedback: string; published: boolean; updated_at: string } | null;
  mode: 'personal' | 'cards';
  targets: { title: string; view: BoardView }[];
  /** 배움성찰과 연결된 작업장이면 그 활동 — 평가가 배움성찰에 함께 저장된다 */
  linkedActivity?: { id: string; subject: string; unit: string; title: string } | null;
  /** 서술 피드백 상한(연결된 작업장은 배움성찰과 같은 500자) */
  feedbackMax?: number;
};

type Props = {
  boardId: string;
  studentId: string;
  /** 학생별 현황으로 돌아가기 */
  onBack: () => void;
  /** 이전·다음 학생으로 */
  onStudent: (studentId: string) => void;
};

export default function EvaluationScreen({ boardId, studentId, onBack, onStudent }: Props) {
  const { api } = useSb();
  const { data, error } = useLoad(() => api<Data>(`/boards/${boardId}/evaluations/${studentId}`), [api, boardId, studentId]);
  if (!data) return error ? <Notice type="error" message={error} /> : <p className="hint">불러오는 중...</p>;
  return (
    <main className="sb-evaluate">
      <header className="sb-space-header sb-summary-head">
        <div>
          <h2 className="sb-page-heading">학생 평가 · <span data-testid="eval-student">{data.student.name}</span></h2>
          <p>{data.board.title} · {data.index + 1} / {data.total}</p>
        </div>
        <button type="button" className="sb-btn-dark" onClick={onBack}>← 학생별 현황</button>
      </header>
      {data.linkedActivity && (
        <p className="notice info" data-testid="eval-linked">
          배움성찰 &lsquo;{data.linkedActivity.subject} · {[data.linkedActivity.unit, data.linkedActivity.title].filter(Boolean).join(' ')}&rsquo;과 연결된 작업장입니다. 여기서 매긴 등급과 피드백이 배움성찰 평가로 함께 저장됩니다.
        </p>
      )}
      <div className="sb-evaluate-grid">
        <section aria-label="평가 대상(읽기 전용)" className="sb-evaluate-targets" data-testid="eval-target" data-mode={data.mode}>
          <h3>평가할 결과물</h3>
          {data.targets.length === 0 && <p className="card sb-meta">이 학생의 개인 보드가 없습니다.</p>}
          {data.targets.map((t) => (
            <div key={t.view.board.id} className="card sb-evaluate-target">
              <h3>
                {t.title} <span className="sb-meta">카드 {t.view.cards.length}개</span>
              </h3>
              <Kanban view={{ ...t.view, board: { ...t.view.board, can_write: false } }} readOnly appearance="workspace" onChanged={() => {}} />
            </div>
          ))}
        </section>
        <EvaluationForm
          boardId={boardId}
          studentId={studentId}
          criteria={data.criteria}
          initial={data.evaluation}
          feedbackMax={data.feedbackMax ?? 2000}
          onPrev={data.prevId ? () => onStudent(data.prevId!) : null}
          onNext={data.nextId ? () => onStudent(data.nextId!) : null}
        />
      </div>
    </main>
  );
}

type Initial = Data['evaluation'];

function EvaluationForm({
  boardId,
  studentId,
  criteria,
  initial,
  feedbackMax,
  onPrev,
  onNext,
}: {
  boardId: string;
  studentId: string;
  criteria: Criterion[];
  initial: Initial;
  feedbackMax: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const { api } = useSb();
  const [levels, setLevels] = useState<Record<string, number>>(initial?.levels ?? {});
  const [feedback, setFeedback] = useState(initial?.feedback ?? '');
  const [published, setPublished] = useState(initial?.published ?? false);
  const [status, setStatus] = useState(initial ? `저장됨 ${formatKST(initial.updated_at, 'time')}` : '');
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);
  const latest = useRef({ levels, feedback });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = `/boards/${boardId}/evaluations/${studentId}`;

  const save = () => api<{ updated_at: string }>(url, json('PUT', latest.current));

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    setStatus('저장 중…');
    try {
      const r = await save();
      setStatus(`저장됨 ${formatKST(r.updated_at, 'time')}`);
    } catch (e) {
      setStatus(`저장 실패: ${e instanceof Error ? e.message : ''}`);
    }
  };

  const change = (next: { levels?: Record<string, number>; feedback?: string }) => {
    latest.current = { levels: next.levels ?? latest.current.levels, feedback: next.feedback ?? latest.current.feedback };
    if (next.levels) setLevels(next.levels);
    if (next.feedback !== undefined) setFeedback(next.feedback);
    dirty.current = true;
    setStatus('입력 중…');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  useEffect(() => {
    return () => {
      // 화면을 떠날 때 남은 변경 저장
      if (dirty.current) void api(url, json('PUT', latest.current)).catch(() => {});
    };
  }, [api, url]);

  const move = (fn: (() => void) | null) => async () => {
    if (!fn) return;
    await flush();
    fn();
  };

  return (
    <aside className="card sb-evaluate-form" aria-label="평가 입력">
      <h3>평가 기준</h3>
      {criteria.length === 0 && <p className="hint">이 보드에 붙은 평가 기준이 없습니다. 보드 설정에서 기준을 붙이세요.</p>}
      {criteria.map((c) => (
        <fieldset key={c.id} className="sb-fieldset">
          <legend>{c.name}</legend>
          {c.description && <p className="hint">{c.description}</p>}
          <div className="sb-level-options">
            {c.levels.map((l, i) => (
              <label key={i} className={levels[c.id] === i ? 'sb-level-pick is-selected' : 'sb-level-pick'} title={l.description}>
                <input type="radio" name={`level-${c.id}`} checked={levels[c.id] === i} onChange={() => change({ levels: { ...latest.current.levels, [c.id]: i } })} />
                <strong>{l.name} ({l.score})</strong>
                {l.description && <span>{l.description}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div>
        <label htmlFor="feedback">학생에게 남길 피드백</label>
        <textarea id="feedback" className="sb-textarea-lg" maxLength={feedbackMax} value={feedback} onChange={(e) => change({ feedback: e.target.value })} onBlur={flush} />
        <p className="sb-between sb-meta">
          <span role="status" data-testid="save-status">{status || '변경 내용은 자동으로 저장돼요.'}</span>
          <span>{feedback.length}/{feedbackMax}</span>
        </p>
      </div>
      <div className="sb-row-wrap">
        <button
          type="button"
          className={published ? 'sb-btn ghost' : 'sb-btn'}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              dirty.current = true;
              await flush();
              await api(url, json('POST', { published: !published }));
              setPublished(!published);
            } catch (e) {
              setStatus(e instanceof Error ? e.message : '바꾸지 못했습니다.');
            } finally {
              setPending(false);
            }
          }}
        >
          {published ? '공개 취소' : '이 학생 평가 공개'}
        </button>
        <span data-testid="published-state">{published ? '공개됨' : '비공개'}</span>
      </div>
      <div className="sb-between sb-divider">
        {onPrev ? (
          <button type="button" className="sb-btn ghost" onClick={move(onPrev)}>
            ← 이전 학생
          </button>
        ) : (
          <span />
        )}
        {onNext && (
          <button type="button" className="sb-btn ghost" onClick={move(onNext)}>
            다음 학생 →
          </button>
        )}
      </div>
    </aside>
  );
}
