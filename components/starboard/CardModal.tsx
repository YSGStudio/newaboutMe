'use client';

/**
 * CardModal — 카드 상세(원본 kanban/CardModal.tsx)
 * 머리: 섹션 배지·작성자·닫기(Esc). 쓸 수 있으면 제목·내용(또는 형식 항목)·라벨·마감일 편집과 "카드 삭제 → 정말 삭제",
 * 아니면 보기만. 아래에 체크리스트(바로 저장), 첨부(목록·올리기), 활동 기록을 보여 줍니다.
 */
import { useEffect, useState } from 'react';
import type { Activity, CardView, ChecklistItem, ColumnView } from '@/lib/starboard/types';
import { columnTint } from '@/lib/starboard/columns';
import { formatKST } from '@/lib/starboard/datetime';
import type { CardField, CardFieldValues } from '@/lib/starboard/card-fields';
import { json, useSb } from './context';
import { AttachmentDetail } from './attachments/AttachmentList';
import AttachmentUploader from './attachments/AttachmentUploader';
import { CardContentInputs, CardContentView } from './CardContent';

const ACTION_LABEL: Record<Activity['action'], string> = { create: '만듦', update: '수정함', move: '옮김', delete: '삭제함' };

type Props = { card: CardView; boardId: string; template: CardField[]; columns: ColumnView[]; onClose: () => void; onChanged: () => void };

export default function CardModal({ card, boardId, template, columns, onClose, onChanged }: Props) {
  const { api } = useSb();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const [values, setValues] = useState<CardFieldValues>(card.fields ?? {});
  const [labels, setLabels] = useState(card.labels.join(', '));
  const [due, setDue] = useState(card.due_date ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist);
  const [newItem, setNewItem] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = card.can_edit;
  const col = columns.find((c) => c.id === card.column_id);

  useEffect(() => {
    api<{ activities: Activity[] }>(`/cards/${card.id}/activities`)
      .then((r) => setActivities(r.activities ?? []))
      .catch(() => setActivities([]));
  }, [api, card.id, card.updated_at, card.column_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (work: () => Promise<unknown>, after?: () => void) => {
    setPending(true);
    try {
      await work();
      setError('');
      onChanged();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  };

  const save = (patch?: { checklist?: ChecklistItem[] }) =>
    run(() =>
      api(
        `/cards/${card.id}`,
        json('PATCH', {
          title,
          body,
          fields: template.length ? values : (card.fields ?? {}),
          labels: labels.split(',').map((s) => s.trim()).filter(Boolean),
          due_date: due || null,
          checklist: patch?.checklist ?? checklist,
        }),
      ),
    );

  return (
    <div className="sb-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="카드 상세" className="sb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sb-modal-head">
          <span className="sb-column-badge" style={{ background: col ? columnTint(col.color) : undefined }}>
            {col?.name}
          </span>
          <span className="sb-meta">{card.author_name ?? (card.is_mine ? '나' : '익명')}</span>
          <button type="button" className="sb-icon-btn sb-close" onClick={onClose} aria-label="닫기" title="닫기">
            ×
          </button>
        </div>

        {editable ? (
          <form
            className="sb-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div>
              <label htmlFor="card-title">제목</label>
              <input id="card-title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <CardContentInputs template={template} body={body} onBody={setBody} values={values} onValues={setValues} idPrefix="card" />
            <div className="sb-form-grid">
              <div>
                <label htmlFor="card-labels">라벨 (쉼표로 구분)</label>
                <input id="card-labels" value={labels} onChange={(e) => setLabels(e.target.value)} />
              </div>
              <div>
                <label htmlFor="card-due">마감일</label>
                <input id="card-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
            {error && <p className="sb-error">{error}</p>}
            <div className="sb-modal-actions">
              {confirmDelete ? (
                <button type="button" className="sb-btn is-danger" onClick={() => run(() => api(`/cards/${card.id}`, json('DELETE')), onClose)}>
                  정말 삭제
                </button>
              ) : (
                <button type="button" className="sb-btn is-danger" onClick={() => setConfirmDelete(true)}>
                  카드 삭제
                </button>
              )}
              <span className="sb-flex-1" />
              <button className="sb-btn" disabled={pending}>
                저장
              </button>
            </div>
          </form>
        ) : (
          <div className="sb-stack">
            <h2 className="sb-modal-title">{card.title}</h2>
            <CardContentView card={card} template={template} />
            {card.labels.length > 0 && (
              <div className="sb-labels">
                {card.labels.map((l) => (
                  <span key={l} className="sb-label">
                    {l}
                  </span>
                ))}
              </div>
            )}
            {card.due_date && <p className="sb-meta">마감 {card.due_date}</p>}
            {error && <p className="sb-error">{error}</p>}
          </div>
        )}

        <section className="sb-modal-section">
          <h3>체크리스트</h3>
          <ul className="sb-checklist">
            {checklist.map((item, i) => (
              <li key={i}>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!editable}
                  aria-label={item.text}
                  onChange={() => {
                    const next = checklist.map((c, k) => (k === i ? { ...c, done: !c.done } : c));
                    setChecklist(next);
                    save({ checklist: next });
                  }}
                />
                <span className={item.done ? 'is-done' : undefined}>{item.text}</span>
                {editable && (
                  <button
                    type="button"
                    className="sb-text-btn"
                    onClick={() => {
                      const next = checklist.filter((_, k) => k !== i);
                      setChecklist(next);
                      save({ checklist: next });
                    }}
                  >
                    빼기
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <form
              className="sb-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                const next = [...checklist, { text: newItem.trim(), done: false }];
                setChecklist(next);
                setNewItem('');
                save({ checklist: next });
              }}
            >
              <input placeholder="예: 자료 3개 찾기" aria-label="체크리스트 항목" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <button className="sb-btn ghost">추가</button>
            </form>
          )}
        </section>

        <section className="sb-modal-section">
          <h3>첨부</h3>
          <AttachmentDetail
            boardId={boardId}
            items={card.attachments}
            canEdit={editable}
            onDelete={(id) => run(() => api(`/attachments/${id}`, json('DELETE')))}
          />
          {editable && <AttachmentUploader cardId={card.id} onDone={onChanged} />}
        </section>

        <section className="sb-modal-section">
          <h3>활동 기록</h3>
          <ol className="sb-activities" data-testid="activity-list">
            {activities.map((a) => (
              <li key={a.id} data-testid="activity">
                <time className="sb-meta">{formatKST(a.created_at)}</time> {a.actor_name ?? '누군가'} — {ACTION_LABEL[a.action]}
                {a.action === 'move' && ` (${a.from_column ?? '?'} → ${a.to_column ?? '?'})`}
              </li>
            ))}
            {activities.length === 0 && <li className="sb-meta">기록이 없습니다.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
