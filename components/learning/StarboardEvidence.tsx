'use client';

/**
 * StarboardEvidence — 배움성찰 결과물 중 "별빛보드 작업장" 근거
 * 붙인 작업장을 칩으로 보여 주고, 누르면 그 작업장과 하위 작업장만 읽기 전용 칸반으로 펼칩니다(같은 층의 다른 작업장은 안 보임).
 * 고칠 수 있으면 "🗂 별빛보드 작업장"으로 내가 볼 수 있는 작업장을 골라 붙이고, ×로 뗍니다.
 * 학생 화면(LearningContent)과 교사 화면(LearningDashboard)이 함께 씁니다 — 요청 주소만 다릅니다.
 */
import { useCallback, useState } from 'react';
import { SbProvider } from '@/components/starboard/context';
import Kanban from '@/components/starboard/Kanban';
import type { BoardView } from '@/lib/starboard/types';

export type EvidenceBoard = { id: string; board_id: string; title: string; project_title: string };
type Option = { id: string; title: string; projectTitle: string; depth: number; personal: boolean };
type View = { id: string; title: string; depth: number; view: BoardView };

type Props = {
  kind: 'teacher' | 'student';
  boards: EvidenceBoard[];
  canEdit: boolean;
  loadOptions: () => Promise<{ options: Option[]; max: number }>;
  onAdd: (boardId: string) => Promise<void>;
  onRemove: (linkId: string) => Promise<void>;
  loadViews: (linkId: string) => Promise<{ boards: View[] }>;
};

export default function StarboardEvidence({ kind, boards, canEdit, loadOptions, onAdd, onRemove, loadViews }: Props) {
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [max, setMax] = useState(3);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<{ linkId: string; views: View[] | null } | null>(null);
  const go = useCallback(() => {}, []);

  const startPicking = async () => {
    setPicking((v) => !v);
    setError('');
    if (options) return;
    try {
      const r = await loadOptions();
      setOptions(r.options);
      setMax(r.max);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openViewer = async (linkId: string) => {
    if (open?.linkId === linkId) return setOpen(null);
    setOpen({ linkId, views: null });
    try {
      const r = await loadViews(linkId);
      setOpen({ linkId, views: r.boards });
    } catch (e) {
      setOpen(null);
      setError((e as Error).message);
    }
  };

  const attached = new Set(boards.map((b) => b.board_id));
  const full = boards.length >= max;

  return (
    <div className="learning-board-evidence">
      <div className="row space-between" style={{ gap: 6 }}>
        <p className="hint" style={{ margin: 0 }}>별빛보드 작업장 {boards.length}/{max}</p>
        {canEdit && (
          <button type="button" className="outline" style={{ width: 'auto', fontSize: 12, padding: '5px 11px' }} onClick={startPicking} disabled={busy || (full && !picking)}>
            🗂 별빛보드 작업장
          </button>
        )}
      </div>

      {picking && canEdit && (
        <div className="learning-board-picker">
          {options === null ? (
            <p className="hint" style={{ margin: 0 }}>작업장을 불러오는 중...</p>
          ) : options.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>고를 수 있는 작업장이 없어요.</p>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="근거로 붙일 작업장" style={{ flex: 1, minWidth: 0 }}>
                <option value="">작업장 고르기</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id} disabled={attached.has(o.id)}>
                    {o.projectTitle} · {'　'.repeat(o.depth)}{o.personal ? '👤 ' : ''}{o.title}{attached.has(o.id) ? ' (붙임)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ghost"
                style={{ width: 'auto', flexShrink: 0 }}
                disabled={busy || !pick || full}
                onClick={() =>
                  run(async () => {
                    await onAdd(pick);
                    setPick('');
                    setPicking(false);
                  })
                }
              >
                {busy ? '붙이는 중...' : '붙이기'}
              </button>
            </div>
          )}
          <p className="hint" style={{ margin: '6px 0 0' }}>붙인 작업장을 열면 그 작업장과 그 안의 작업장만 보여요.</p>
        </div>
      )}

      {error && <p style={{ margin: 0, color: '#dc2626', fontSize: 12 }}>{error}</p>}

      {boards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {boards.map((b) => (
            <div key={b.id} className={open?.linkId === b.id ? 'learning-board-chip is-active' : 'learning-board-chip'}>
              <button type="button" className="learning-board-chip-open" onClick={() => openViewer(b.id)} aria-expanded={open?.linkId === b.id}>
                🗂 {b.project_title} · {b.title}
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="outline"
                  style={{ width: 'auto', flexShrink: 0, fontSize: 12, padding: '4px 10px' }}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      if (open?.linkId === b.id) setOpen(null);
                      await onRemove(b.id);
                    })
                  }
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="learning-board-viewer" data-testid="evidence-board-viewer">
          {open.views === null ? (
            <p className="hint" style={{ margin: 0 }}>작업장을 불러오는 중...</p>
          ) : open.views.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>볼 수 있는 작업장이 없어요.</p>
          ) : (
            <SbProvider kind={kind} go={go}>
              {open.views.map((v) => (
                <section key={v.id} className="learning-board-viewer-item" style={{ marginLeft: Math.min(v.depth, 4) * 14 }}>
                  <h5>
                    {v.depth > 0 && <span aria-hidden="true">↳ </span>}
                    {v.title} <span className="hint">카드 {v.view.cards.length}개</span>
                  </h5>
                  <Kanban view={{ ...v.view, board: { ...v.view.board, can_write: false } }} readOnly onChanged={() => {}} />
                </section>
              ))}
            </SbProvider>
          )}
        </div>
      )}
    </div>
  );
}
