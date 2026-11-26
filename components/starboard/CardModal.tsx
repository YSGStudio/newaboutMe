'use client';

/**
 * CardModal — 카드 상세(원본 kanban/CardModal.tsx)
 * 머리: 섹션 배지·작성자·(수정하기)·닫기(Esc).
 * 교사·학생 모두 카드를 먼저 넓은 읽기 화면으로 열고, 닫기 옆 ✏️ 수정하기를 눌러야 편집 화면(제목·내용·첨부 올리기·카드 삭제)이 됩니다.
 * 저장하거나 취소하면 다시 읽기 화면으로 돌아갑니다.
 * 교사는 그 작업장의 모든 카드(학생 카드 포함)를 지울 수 있어서, 읽기 화면 머리의 🗑로 바로 지웁니다(서버 sb_can_write_card가 담임 교사를 허용).
 * 라벨·마감일은 lib/features.ts STARBOARD_CARD_LABELS_DUE_ENABLED로 화면에서 내렸습니다(저장된 값은 그대로 다시 보냄).
 * 아래에 첨부(목록 — 읽기 화면에서는 첨부가 있을 때만), 활동 기록을 보여 줍니다.
 * 수정 화면의 링크 칸은 넣기 버튼이 없습니다 — 주소를 붙여 넣고 저장하면 함께 첨부되고, 붙여 넣는 동안 미리보기가 보입니다.
 * 체크리스트는 lib/features.ts STARBOARD_CHECKLIST_ENABLED로 화면에서 내렸습니다(저장된 항목은 그대로 유지).
 */
import { useEffect, useState } from 'react';
import type { Activity, CardView, ChecklistItem, ColumnView } from '@/lib/starboard/types';
import { columnTint } from '@/lib/starboard/columns';
import { formatKST } from '@/lib/starboard/datetime';
import type { CardField, CardFieldValues } from '@/lib/starboard/card-fields';
import { json, useSb } from './context';
import { AttachmentDetail } from './attachments/AttachmentList';
import AttachmentUploader from './attachments/AttachmentUploader';
import LinkDraftInput from './attachments/LinkDraftInput';
import { addCardLink } from './attachments/upload-client';
import { parseLinks } from '@/lib/starboard/upload';
import { CardContentInputs, CardContentView } from './CardContent';
import { STARBOARD_CARD_LABELS_DUE_ENABLED, STARBOARD_CHECKLIST_ENABLED } from '@/lib/features';

const ACTION_LABEL: Record<Activity['action'], string> = { create: '만듦', update: '수정함', move: '옮김', delete: '삭제함' };

type Props = { workspace?: boolean; card: CardView; boardId: string; template: CardField[]; columns: ColumnView[]; onClose: () => void; onChanged: () => void };

export default function CardModal({ workspace, card, boardId, template, columns, onClose, onChanged }: Props) {
  const { api, isTeacher, confirm } = useSb();
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
  const [linkText, setLinkText] = useState('');
  const editable = card.can_edit;
  const [editing, setEditing] = useState(false);
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

  /** 편집을 그만두고 읽기 화면으로 — 고치던 값은 카드에 저장된 값으로 되돌린다 */
  const stopEditing = () => {
    setTitle(card.title);
    setBody(card.body);
    setValues(card.fields ?? {});
    setLabels(card.labels.join(', '));
    setDue(card.due_date ?? '');
    setConfirmDelete(false);
    setError('');
    setLinkText('');
    setEditing(false);
  };

  const save = (patch?: { checklist?: ChecklistItem[] }, after?: () => void) =>
    run(async () => {
      await api(
        `/cards/${card.id}`,
        json('PATCH', {
          title,
          body,
          fields: template.length ? values : (card.fields ?? {}),
          // 칸을 감춘 동안에는 저장된 값을 그대로 보낸다 — 지워지지 않게.
          labels: STARBOARD_CARD_LABELS_DUE_ENABLED ? labels.split(',').map((s) => s.trim()).filter(Boolean) : card.labels,
          due_date: STARBOARD_CARD_LABELS_DUE_ENABLED ? due || null : card.due_date,
          checklist: patch?.checklist ?? checklist,
        }),
      );
      // 저장 버튼으로 저장할 때 링크 칸에 붙여 넣은 주소도 함께 첨부한다(넣기 버튼 없음).
      if (patch) return;
      const failed: string[] = [];
      for (const url of parseLinks(linkText).urls) {
        await addCardLink(api, card.id, url).catch(() => failed.push(url));
      }
      setLinkText(failed.join('\n'));
      if (failed.length) throw new Error(`카드는 저장했지만 링크 ${failed.length}개를 붙이지 못했어요. 주소를 확인하고 다시 저장해 주세요.`);
    }, after);

  return (
    <div className="sb-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="카드 상세" className={`sb-modal${editing ? '' : ' is-reading'}${workspace ? ' sb-workspace-card-dialog' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="sb-modal-head">
          <span className="sb-column-badge" style={{ background: col ? columnTint(col.color) : undefined }}>
            {col?.name}
          </span>
          <span className="sb-meta">{card.author_name ?? (card.is_mine ? '나' : '익명')}</span>
          <div className="sb-modal-head-actions">
            {editable && !editing && (
              <button type="button" className="sb-icon-btn" onClick={() => setEditing(true)} aria-label="수정하기" title="수정하기" data-testid="card-edit">
                <span aria-hidden="true">✏️</span>
              </button>
            )}
            {isTeacher && editable && !editing && (
              <button
                type="button"
                className="sb-icon-btn is-danger"
                disabled={pending}
                aria-label="카드 삭제"
                title="카드 삭제"
                data-testid="card-delete"
                onClick={async () => {
                  const who = card.author_name ?? (card.is_mine ? '내' : '익명');
                  if (!(await confirm(`'${card.title}' 카드(${who})를 지울까요? 첨부도 함께 지워지고 되돌릴 수 없습니다.`, '삭제'))) return;
                  run(() => api(`/cards/${card.id}`, json('DELETE')), onClose);
                }}
              >
                <span aria-hidden="true">🗑️</span>
              </button>
            )}
            <button type="button" className="sb-icon-btn sb-close" onClick={onClose} aria-label="닫기" title="닫기">
              ×
            </button>
          </div>
        </div>

        {editable && editing ? (
          <form
            className="sb-stack"
            onSubmit={(e) => {
              e.preventDefault();
              // 저장하면 읽기 화면으로 돌아간다.
              save(undefined, () => setEditing(false));
            }}
          >
            <div>
              <label htmlFor="card-title">제목</label>
              <input id="card-title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <CardContentInputs template={template} body={body} onBody={setBody} values={values} onValues={setValues} idPrefix="card" />
            {STARBOARD_CARD_LABELS_DUE_ENABLED && (
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
            )}
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
              <button type="button" className="sb-btn ghost" onClick={stopEditing} disabled={pending}>
                취소
              </button>
              <button className="sb-btn" disabled={pending}>
                저장
              </button>
            </div>
          </form>
        ) : (
          <div className="sb-stack">
            <h2 className="sb-modal-title">{card.title}</h2>
            <CardContentView card={card} template={template} />
            {STARBOARD_CARD_LABELS_DUE_ENABLED && card.labels.length > 0 && (
              <div className="sb-labels">
                {card.labels.map((l) => (
                  <span key={l} className="sb-label">
                    {l}
                  </span>
                ))}
              </div>
            )}
            {STARBOARD_CARD_LABELS_DUE_ENABLED && card.due_date && <p className="sb-meta">마감 {card.due_date}</p>}
            {error && <p className="sb-error">{error}</p>}
          </div>
        )}

        {STARBOARD_CHECKLIST_ENABLED && (
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
                {editable && editing && (
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
          {editable && editing && (
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
        )}

        {/* 첨부가 없으면 읽기 화면에서는 첨부 칸을 그리지 않는다(수정 화면에서는 올리려고 보여 준다). */}
        {(editing || card.attachments.length > 0) && (
        <section className="sb-modal-section">
          <h3>첨부</h3>
          <AttachmentDetail
            boardId={boardId}
            items={card.attachments}
            canEdit={editable && editing}
            onDelete={(id) => run(() => api(`/attachments/${id}`, json('DELETE')))}
          />
          {editable && editing && (
            <>
              <AttachmentUploader cardId={card.id} onDone={onChanged} />
              <LinkDraftInput id={`card-${card.id}-links`} value={linkText} onChange={setLinkText} disabled={pending} />
              {parseLinks(linkText).urls.length > 0 && <p className="sb-meta">링크는 위 저장을 누르면 함께 붙어요.</p>}
            </>
          )}
        </section>
        )}

        {workspace ? (
          <details className="sb-modal-section sb-card-history">
            <summary>활동 기록</summary>
            <CardHistory activities={activities} />
          </details>
        ) : (
          <section className="sb-modal-section">
            <h3>활동 기록</h3>
            <CardHistory activities={activities} />
          </section>
        )}
      </div>
    </div>
  );
}

function CardHistory({ activities }: { activities: Activity[] }) {
  return (
    <ol className="sb-activities" data-testid="activity-list">
      {activities.map((a) => (
        <li key={a.id} data-testid="activity">
          <time className="sb-meta">{formatKST(a.created_at)}</time> {a.actor_name ?? '누군가'} — {ACTION_LABEL[a.action]}
          {a.action === 'move' && ` (${a.from_column ?? '?'} → ${a.to_column ?? '?'})`}
        </li>
      ))}
      {activities.length === 0 && <li className="sb-meta">기록이 없습니다.</li>}
    </ol>
  );
}
