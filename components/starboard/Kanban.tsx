'use client';

/**
 * Kanban — 작업장 칸반(원본 components/kanban/Kanban.tsx)
 * 섹션(열)을 가로로 늘어놓고 카드를 드래그 앤 드롭(포인터·터치·키보드)으로 옮깁니다.
 * 섹션 머리: 이름, 내 섹션 "나", 개수, 평가 버튼(⭐ 평가하기 / 📊 평가 보기), ✏️ 글쓰기.
 * 섹션이 없으면 교사에게 "멤버별로 나누기 / 직접 만들기" 안내를, 학생에게 빈 보드 안내를 보여 줍니다.
 * readOnly는 평가 화면에서 대상 보드를 읽기 전용으로 보여 줄 때 씁니다.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BoardView, CardView, ColumnView } from '@/lib/starboard/types';
import { HIDE_MODE_LABEL } from '@/lib/starboard/hiding';
import { COLUMN_PALETTE, columnTint, isNoticeColumn, orderColumns, positionBetween } from '@/lib/starboard/columns';
import { formatKST } from '@/lib/starboard/datetime';
import { avatarPair, initials } from '@/lib/starboard/visual';
import type { CardField, CardFieldValues } from '@/lib/starboard/card-fields';
import { json, useSb } from './context';
import { AttachmentThumbs } from './attachments/AttachmentList';
import { addCardLink, uploadCardFile } from './attachments/upload-client';
import { ACCEPT_FILES, checkFile, parseLinks } from '@/lib/starboard/upload';
import LinkDraftInput from './attachments/LinkDraftInput';
import { STARBOARD_CARD_LABELS_DUE_ENABLED, STARBOARD_CHECKLIST_ENABLED } from '@/lib/features';
import CardModal from './CardModal';
import { CardContentInputs, CardContentView } from './CardContent';
import { PeerReviewModal, ReviewSummaryModal, RubricModal, memberName } from './ReviewModals';

function sortCards(cards: CardView[]) {
  return [...cards].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

type Props = {
  view: BoardView;
  onChanged: () => void;
  readOnly?: boolean;
  heading?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  appearance?: 'workspace';
};

export default function Kanban({ view, onChanged, readOnly, heading, actions, status, appearance }: Props) {
  const { api, isTeacher } = useSb();
  const [optimistic, setOptimistic] = useState<{ base: CardView[]; cards: CardView[] } | null>(null);
  const cards = optimistic && optimistic.base === view.cards ? optimistic.cards : view.cards;
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [composeId, setComposeId] = useState<string | null>(null);
  const [showRubric, setShowRubric] = useState(false);
  // 공지사항 섹션은 누구에게나 맨 앞. 학생에게는 그다음 자기 멤버 섹션을, 각 섹션 안에서는 자기 카드를 맨 앞에 보여 준다.
  // 자기 카드끼리·남의 카드끼리의 순서는 저장된 순서를 지킨다.
  const viewerId = view.board.viewer_id;
  const columns = useMemo(() => {
    const sorted = orderColumns(view.columns);
    if (isTeacher) return sorted;
    const notice = sorted.filter((c) => isNoticeColumn(c.name));
    const rest = sorted.filter((c) => !isNoticeColumn(c.name));
    const mine = (c: ColumnView) => Boolean(c.member_id && c.member_id === viewerId);
    return [...notice, ...rest.filter(mine), ...rest.filter((c) => !mine(c))];
  }, [view.columns, isTeacher, viewerId]);
  const byColumn = useMemo(() => {
    const m = new Map<string, CardView[]>();
    for (const c of columns) m.set(c.id, []);
    const ordered = sortCards(cards);
    const list = isTeacher ? ordered : [...ordered.filter((c) => c.is_mine), ...ordered.filter((c) => !c.is_mine)];
    for (const card of list) m.get(card.column_id)?.push(card);
    return m;
  }, [cards, columns, isTeacher]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const doMove = (card: CardView, columnId: string, index: number) => {
    const shown = (byColumn.get(columnId) ?? []).filter((c) => c.id !== card.id);
    // 학생 화면은 자기 카드를 앞에 모아 보여 주므로, 저장 순서는 자기 카드끼리 사이에서만 정한다.
    // (화면 순서 그대로 이웃을 잡으면 남의 카드 위치와 섞여 엉뚱한 자리로 저장된다.)
    const target = isTeacher ? shown : shown.filter((c) => c.is_mine);
    const at = isTeacher ? index : Math.min(index, target.length);
    const prev = target[at - 1]?.position ?? null;
    const next = target[at]?.position ?? null;
    const position = positionBetween(prev, next);
    if (card.column_id === columnId && card.position === position) return;
    const updated = cards.map((c) => (c.id === card.id ? { ...c, column_id: columnId, position } : c));
    setOptimistic({ base: view.cards, cards: updated });
    api(`/cards/${card.id}/move`, json('POST', { columnId, position }))
      .then(() => setError(''))
      .catch((e: Error) => {
        setError(e.message);
        setOptimistic(null);
      })
      .finally(onChanged);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card || !card.can_edit) return;
    const overId = String(over.id);
    if (overId.startsWith('col:')) {
      const colId = overId.slice(4);
      doMove(card, colId, (byColumn.get(colId) ?? []).filter((c) => c.id !== card.id).length);
      return;
    }
    const overCard = cards.find((c) => c.id === overId);
    if (!overCard || overCard.id === card.id) return;
    const list = (byColumn.get(overCard.column_id) ?? []).filter((c) => c.id !== card.id);
    let idx = list.findIndex((c) => c.id === overCard.id);
    const original = byColumn.get(overCard.column_id) ?? [];
    if (card.column_id === overCard.column_id && original.indexOf(card) < original.indexOf(overCard)) idx += 1;
    doMove(card, overCard.column_id, idx);
  };

  const openCard = cards.find((c) => c.id === openId) ?? null;
  const canWrite = view.board.can_write && !readOnly;
  const template = view.board.card_fields ?? [];
  const myColumn = !isTeacher && viewerId ? columns.find((col) => col.member_id === viewerId) : undefined;
  const composeColumn = canWrite ? columns.find((col) => col.id === composeId) : undefined;
  const [review, setReview] = useState<{ mode: 'peer' | 'summary'; id: string; name: string } | null>(null);
  const hasCriteria = appearance === 'workspace' && !readOnly && view.criteria.length > 0;
  const myReviewId = !isTeacher && viewerId && (myColumn || hasCriteria || view.my_evaluation) ? viewerId : null;

  const openCardReview = (card: CardView) => {
    const id = card.is_mine && !isTeacher ? viewerId : card.author_id;
    if (id && (isTeacher || card.is_mine)) {
      setReview({ mode: 'summary', id, name: card.author_name ?? '나' });
    } else if (id && view.board.kind === 'shared' && view.board.peer_review) {
      setReview({ mode: 'peer', id, name: card.author_name ?? '친구' });
    } else {
      setShowRubric(true);
    }
  };
  // 섹션 주인에 따라: 내 섹션 → 내 평가 보기, 친구 섹션 → 평가하기(동료평가가 켜져 있고 기준이 있을 때), 교사 → 그 학생 평가 보기
  const reviewAction = (col: ColumnView): 'summary' | 'peer' | null => {
    if (readOnly || !col.member_id) return null;
    if (isTeacher || col.member_id === view.board.viewer_id) return 'summary';
    if (view.board.kind === 'shared' && view.board.peer_review && view.criteria.length > 0) return 'peer';
    return null;
  };

  return (
    <>
      {heading && (
        <header className="sb-board-head sb-space-header">
          {heading}
          <div className="sb-board-actions">
            {actions}
            {myReviewId && (
              <button type="button" className="sb-btn-dark" onClick={() => setReview({ mode: 'summary', id: myReviewId, name: '나' })}>내 평가</button>
            )}
          </div>
        </header>
      )}
      {status}
      {error && (
        <p role="alert" className="notice error sb-kanban-error">
          {error}
        </p>
      )}
      {columns.length === 0 &&
        (isTeacher && !readOnly ? (
          <EmptyBoard boardId={view.board.id} memberSplit={view.board.kind === 'shared'} onChanged={onChanged} />
        ) : (
          <div className="card sb-empty-board" data-testid="empty-board">
            <p className="sb-empty-title">아직 빈 보드예요</p>
            <p className="hint">선생님이 카드 섹션을 준비하고 있어요.</p>
          </div>
        ))}
      <DndContext id={`kanban-${view.board.id}`} sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className={`sb-kanban${isTeacher ? '' : ' is-student'}${appearance ? ' sb-kanban-workspace' : ''}`} data-testid="kanban">
          {columns.map((col) => (
            <Column
              key={col.id}
              col={col}
              cards={byColumn.get(col.id) ?? []}
              workspace={appearance === 'workspace'}
              onWrite={canWrite ? () => setComposeId(col.id) : undefined}
              boardId={view.board.id}
              template={template}
              readOnly={!!readOnly}
              reviewAction={reviewAction(col)}
              hasCriteria={hasCriteria}
              onCardReview={openCardReview}
              isMine={!!col.member_id && col.member_id === view.board.viewer_id}
              onReview={(mode) => setReview({ mode, id: col.member_id!, name: memberName(col.name) })}
              onOpen={setOpenId}
            />
          ))}
          {isTeacher && !readOnly && columns.length > 0 && (
            <SectionAdder boardId={view.board.id} count={columns.length} memberSplit={view.board.kind === 'shared'} onChanged={onChanged} />
          )}
        </div>
      </DndContext>
      {composeColumn && (
        <AddCard
          key={composeColumn.id}
          boardId={view.board.id}
          columnId={composeColumn.id}
          columnName={composeColumn.name}
          template={template}
          lastPosition={(byColumn.get(composeColumn.id) ?? []).reduce((last, card) => Math.max(last, card.position), 0)}
          onAdded={onChanged}
          onClose={() => setComposeId(null)}
        />
      )}
      {showRubric && <RubricModal criteria={view.criteria} onClose={() => setShowRubric(false)} />}
      {review?.mode === 'peer' && (
        <PeerReviewModal boardId={view.board.evaluation_board_id} target={{ id: review.id, name: review.name }} criteria={view.criteria} onClose={() => setReview(null)} />
      )}
      {review?.mode === 'summary' && (
        <ReviewSummaryModal boardId={view.board.evaluation_board_id} student={{ id: review.id, name: review.name }} criteria={view.criteria} onClose={() => setReview(null)} />
      )}
      {openCard && (
        <CardModal
          workspace={appearance === 'workspace'}
          card={readOnly ? { ...openCard, can_edit: false } : openCard}
          boardId={view.board.id}
          template={template}
          columns={columns}
          onClose={() => setOpenId(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

type ColumnProps = {
  col: ColumnView;
  cards: CardView[];
  workspace: boolean;
  onWrite?: () => void;
  boardId: string;
  template: CardField[];
  readOnly: boolean;
  reviewAction: 'summary' | 'peer' | null;
  isMine: boolean;
  onReview: (mode: 'summary' | 'peer') => void;
  hasCriteria: boolean;
  onCardReview: (card: CardView) => void;
  onOpen: (id: string) => void;
};

function Column({ col, cards, workspace, onWrite, boardId, template, readOnly, reviewAction, isMine, onReview, hasCriteria, onCardReview, onOpen }: ColumnProps) {
  const { isTeacher } = useSb();
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.id}` });
  return (
    <section
      ref={setNodeRef}
      style={workspace ? ({ '--sb-column-color': columnTint(col.color) } as CSSProperties) : undefined}
      className={isOver ? 'sb-column is-over' : 'sb-column'}
      aria-label={`${col.name} 열`}
      data-testid="column"
      data-column-name={col.name}
      data-member-id={col.member_id ?? undefined}
    >
      <header className="sb-column-head" style={workspace ? undefined : { background: columnTint(col.color) }}>
        <h3 title={col.name}>{col.name}</h3>
        {isMine && <span className="sb-me-badge">나</span>}
        <span className="sb-count-pill" data-testid="column-count">
          {cards.length + col.hidden_count}
        </span>
        {reviewAction && (
          <button
            type="button"
            className={hasCriteria ? 'sb-round-btn sb-review-glow' : 'sb-round-btn'}
            onClick={() => onReview(reviewAction)}
            aria-label={reviewAction === 'peer' ? `${col.name} 평가하기` : isMine ? '내 평가 보기' : `${col.name} 평가 보기`}
            title={reviewAction === 'peer' ? '평가하기' : isMine ? '내 평가 보기' : '평가 보기'}
            data-testid={reviewAction === 'peer' ? 'peer-review-btn' : 'review-summary-btn'}
          >
            <span aria-hidden="true">{reviewAction === 'peer' ? '⭐' : '📊'}</span>
          </button>
        )}
        {onWrite && (
          <button
            type="button"
            className="sb-round-btn"
            onClick={onWrite}
            aria-label={`${col.name}에 글쓰기`}
            title="글쓰기"
            data-testid="write-toggle"
          >
            <span aria-hidden="true">✏️</span>
          </button>
        )}
      </header>
      {isTeacher && col.effective_hide !== 'off' && <p className="sb-column-hide">가리기: {HIDE_MODE_LABEL[col.effective_hide]}</p>}
      <div className="sb-column-body">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="sb-card-list">
            {cards.length === 0 && col.hidden_count === 0 && (
              <li className="sb-empty-row">{onWrite ? '✏️를 눌러 글을 써 보세요' : '아직 카드가 없어요'}</li>
            )}
            {cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                template={template}
                boardId={boardId}
                readOnly={readOnly}
                onOpen={() => onOpen(card.id)}
                onReview={hasCriteria && card.author_role !== 'teacher' ? () => onCardReview(card) : undefined}
              />
            ))}
            {col.hidden_count > 0 && (
              <li className="sb-hidden-count" data-testid="hidden-count">
                {workspace ? `카드 ${col.hidden_count}개 · 내용 비공개` : `다른 친구 카드 ${col.hidden_count}개`}
              </li>
            )}
          </ul>
        </SortableContext>
      </div>
    </section>
  );
}

function CardItem({ card, template, boardId, readOnly, onOpen, onReview }: { card: CardView; template: CardField[]; boardId: string; readOnly: boolean; onOpen: () => void; onReview?: () => void }) {
  const movable = card.can_edit && !readOnly;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: !movable });
  const done = card.checklist.filter((c) => c.done).length;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={card.is_mine ? 'sb-card is-mine' : 'sb-card'}
      data-testid="card"
      data-card-title={card.title}
    >
      <div {...attributes} {...listeners} className={movable ? 'sb-card-inner is-movable' : 'sb-card-inner'}>
        <button type="button" className="sb-card-open" onClick={onOpen}>
          {STARBOARD_CARD_LABELS_DUE_ENABLED && card.labels.length > 0 && (
            <span className="sb-labels">
              {card.labels.map((l) => (
                <span key={l} className="sb-label">
                  {l}
                </span>
              ))}
            </span>
          )}
          <span className="sb-card-title">{card.title}</span>
          <CardContentView card={card} template={template} preview />
          <span className="sb-card-meta">
            {STARBOARD_CARD_LABELS_DUE_ENABLED && card.due_date && <span>마감 {card.due_date}</span>}
            {STARBOARD_CHECKLIST_ENABLED && card.checklist.length > 0 && (
              <span className={done === card.checklist.length ? 'is-complete' : undefined}>
                · ☑ {done}/{card.checklist.length}
              </span>
            )}
          </span>
        </button>
        <AttachmentThumbs boardId={boardId} items={card.attachments} />
        {!onReview && <AuthorLine card={card} />}
      </div>
      {onReview && (
        <div className="sb-card-review-footer">
          <AuthorLine card={card} />
          <button type="button" className="sb-round-btn sb-review-glow" aria-label={`${card.title} 평가 기준 보기`} title="평가 기준 보기" onClick={onReview} data-testid="card-review-btn">
            <span aria-hidden="true">⭐</span>
          </button>
        </div>
      )}
    </li>
  );
}

/** 섹션 머리의 ✏️로 여닫는 글쓰기 칸: 제목 + 보드 카드 형식(기본: 내용) */
type PendingFile = { id: string; file: File; kind: 'image' | 'pdf' | 'video'; url: string };

function AddCard({ boardId, columnId, columnName, template, lastPosition, onAdded, onClose }: {
  boardId: string;
  columnId: string;
  columnName: string;
  template: CardField[];
  lastPosition: number;
  onAdded: () => void;
  onClose: () => void;
}) {
  const { api } = useSb();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [values, setValues] = useState<CardFieldValues>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  // 올리기 전에 고른 첨부 — 카드를 만든 뒤 차례로 올린다. 미리보기는 브라우저 안 주소(objectURL)로 바로 그린다.
  const [files, setFiles] = useState<PendingFile[]>([]);
  // 링크 칸 — 넣기 버튼 없이, 카드를 올릴 때 칸에 붙여 넣은 주소를 모두 첨부한다.
  const [linkText, setLinkText] = useState('');
  const [progress, setProgress] = useState('');
  // 쓰기 창을 닫을 때 남은 미리보기 주소를 풀어 준다(빼기·올리기에서는 그때그때 푼다).
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const pick = (list: FileList | null) => {
    const next: PendingFile[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list ?? [])) {
      const check = checkFile(file);
      if ('error' in check) problems.push(`${file.name}: ${check.error}`);
      else next.push({ id: `${file.name}-${file.size}-${Math.random()}`, file, kind: check.kind, url: URL.createObjectURL(file) });
    }
    setFiles((prev) => [...prev, ...next]);
    setError(problems.join(' '));
  };

  return (
    <dialog ref={dialogRef} className="sb-modal sb-compose-dialog" aria-label="카드 쓰기" onCancel={(e) => {
      e.preventDefault();
      if (!pending) onClose();
    }}>
      <header className="sb-modal-head">
        <div className="sb-flex-1">
          <h2 className="sb-modal-title">카드 쓰기</h2>
          <p className="sb-meta">{columnName}</p>
        </div>
        <button type="button" className="sb-icon-btn sb-close" aria-label="닫기" disabled={pending} onClick={onClose}>×</button>
      </header>
      <form
        className="sb-composer"
        data-testid="card-composer"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending || !title.trim()) return;
          setPending(true);
          try {
            const created = await api<{ id: string }>(
              `/boards/${boardId}/cards`,
              json('POST', {
                columnId,
                position: lastPosition + 1,
                title,
                body: template.length ? '' : body,
                fields: template.length ? values : {},
                labels: [],
                due_date: null,
                checklist: [],
              }),
            );
            // 첨부는 카드가 생긴 뒤에 올린다. 하나가 실패해도 나머지는 계속 올리고, 실패한 것만 알려 준다.
            const links = parseLinks(linkText).urls;
            const total = files.length + links.length;
            const failed: string[] = [];
            let done = 0;
            for (const f of files) {
              setProgress(`첨부 올리는 중 (${++done}/${total})`);
              await uploadCardFile(api, created.id, f.file).catch((err: Error) => failed.push(`${f.file.name}: ${err.message}`));
            }
            for (const url of links) {
              setProgress(`첨부 올리는 중 (${++done}/${total})`);
              await addCardLink(api, created.id, url).catch((err: Error) => failed.push(`${url}: ${err.message}`));
            }
            setProgress('');
            setTitle('');
            setBody('');
            setValues({});
            files.forEach((f) => URL.revokeObjectURL(f.url));
            setFiles([]);
            setLinkText('');
            setError(failed.length ? `카드는 올렸지만 첨부 ${failed.length}개를 올리지 못했어요. ${failed.join(' ')}` : '');
            onAdded();
            if (!failed.length) onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : '올리지 못했어요.');
          } finally {
            setPending(false);
            setProgress('');
          }
        }}
        onKeyDown={(e) => {
          // 한 줄 칸에서 Enter는 다음 칸으로, Ctrl/⌘+Enter는 올리기
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          const t = e.target as HTMLElement;
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          } else if (t.tagName === 'INPUT') {
            e.preventDefault();
            const inputs = [...e.currentTarget.querySelectorAll<HTMLElement>('input, textarea')];
            inputs[inputs.indexOf(t) + 1]?.focus();
          }
        }}
      >
        <div>
          <label htmlFor={`new-${columnId}-title`}>제목</label>
          <input id={`new-${columnId}-title`} autoFocus maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="card-input-title" />
        </div>
        <CardContentInputs template={template} body={body} onBody={setBody} values={values} onValues={setValues} idPrefix={`new-${columnId}`} />
        <div className="sb-composer-attach">
          <label className="sb-file-label">
            📎 사진·PDF·영상 넣기
            <input
              type="file"
              className="sb-sr-only"
              accept={ACCEPT_FILES}
              multiple
              disabled={pending}
              data-testid="composer-file-input"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <LinkDraftInput id={`new-${columnId}-links`} value={linkText} onChange={setLinkText} disabled={pending} />
          {files.length > 0 && (
            <ul className="sb-pending-list" aria-label="넣은 첨부 미리보기" data-testid="composer-previews">
              {files.map((f) => (
                <li key={f.id} className="sb-pending-item">
                  {f.kind === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.file.name} />
                  )}
                  {f.kind === 'video' && <video src={f.url} muted playsInline controls preload="metadata" aria-label={f.file.name} />}
                  {f.kind === 'pdf' && (
                    <span className="sb-file-chip">
                      <span aria-hidden="true">📄</span> {f.file.name}
                    </span>
                  )}
                  <button
                    type="button"
                    className="sb-pending-remove"
                    aria-label={`${f.file.name} 빼기`}
                    disabled={pending}
                    onClick={() => {
                      URL.revokeObjectURL(f.url);
                      setFiles((prev) => prev.filter((x) => x.id !== f.id));
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="sb-error">{error}</p>}
        <div className="sb-modal-actions">
          <button type="button" className="sb-btn ghost" disabled={pending} onClick={onClose}>취소</button>
          <button className="sb-btn" disabled={pending || !title.trim()}>{pending ? progress || '올리는 중…' : '카드 올리기'}</button>
        </div>
      </form>
    </dialog>
  );
}

/** 카드 아래 작성자 정보: 아바타 · 이름 · 번호(또는 선생님) · 쓴 시간. 가리기로 숨겨진 작성자는 '익명'. */
export function AuthorLine({ card }: { card: CardView }) {
  const name = card.author_name ?? (card.is_mine ? '나' : null);
  const when = formatKST(card.created_at, 'monthDayTime');
  const pair = name && card.author_id ? avatarPair(card.author_id) : null;
  return (
    <div className="sb-author" data-testid="card-author">
      <span
        className="sb-avatar is-small"
        style={pair ? ({ '--avatar-soft': pair.soft, '--avatar-accent': pair.accent } as React.CSSProperties) : undefined}
        aria-hidden="true"
      >
        {name ? initials(name) : '?'}
      </span>
      <span className="sb-author-text">
        <span className={card.is_mine ? 'sb-author-name is-mine' : 'sb-author-name'}>
          {name ?? '익명'}
          {card.is_mine && card.author_name && <span className="sb-meta"> (나)</span>}
        </span>
        <span className="sb-meta sb-truncate">
          {card.author_role !== 'teacher' && card.author_number != null && `${card.author_number}번 · `}
          <time dateTime={card.created_at}>{when}</time>
        </span>
      </span>
      {card.author_role === 'teacher' && <span className="badge sb-badge-teacher">선생님</span>}
    </div>
  );
}

/** 빈 보드(섹션 0개)에서 교사가 보는 시작 안내 */
function EmptyBoard({ boardId, memberSplit, onChanged }: { boardId: string; memberSplit: boolean; onChanged: () => void }) {
  return (
    <section className="card sb-empty-board is-teacher" data-testid="empty-board">
      <div>
        <p className="sb-empty-title">빈 보드예요. 카드 섹션을 어떻게 나눌까요?</p>
        <p className="hint">섹션은 나중에 보드 설정에서 이름·색·순서를 바꾸거나 지울 수 있어요.</p>
      </div>
      <div className={memberSplit ? 'sb-empty-choices' : 'sb-empty-choices is-single'}>
        {memberSplit && (
          <div className="sb-empty-choice">
            <p className="sb-strong">
              <span aria-hidden="true">👥</span> 멤버별로 나누기
            </p>
            <p className="hint">학생마다 &lsquo;01. 이름&rsquo; 섹션을 하나씩 만들어요.</p>
            <MemberSplitButton boardId={boardId} onChanged={onChanged} className="sb-btn" />
          </div>
        )}
        <div className="sb-empty-choice">
          <p className="sb-strong">
            <span aria-hidden="true">✏️</span> 직접 만들기
          </p>
          <p className="hint">공지사항, 모둠, 단계처럼 원하는 섹션을 하나씩 만들어요.</p>
          <AddSectionForm boardId={boardId} count={0} onChanged={onChanged} />
        </div>
      </div>
    </section>
  );
}

/** 섹션이 있을 때 맨 오른쪽의 "＋ 섹션 추가" 칸 */
function SectionAdder({ boardId, count, memberSplit, onChanged }: { boardId: string; count: number; memberSplit: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sb-section-adder" data-testid="section-adder">
      {open ? (
        <div className="card sb-section-adder-form">
          <AddSectionForm boardId={boardId} count={count} onChanged={onChanged} onDone={() => setOpen(false)} />
          <button type="button" className="sb-btn ghost" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      ) : (
        <button type="button" className="sb-add-btn is-tall" onClick={() => setOpen(true)}>
          ＋ 섹션 추가
        </button>
      )}
      {memberSplit && <MemberSplitButton boardId={boardId} onChanged={onChanged} className="sb-add-btn" label="👥 빠진 멤버 섹션 채우기" />}
    </div>
  );
}

function AddSectionForm({ boardId, count, onChanged, onDone }: { boardId: string; count: number; onChanged: () => void; onDone?: () => void }) {
  const { api } = useSb();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <form
      className="sb-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api(`/boards/${boardId}/columns`, json('POST', { name, color: COLUMN_PALETTE[count % COLUMN_PALETTE.length] }));
          setName('');
          setError('');
          onChanged();
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : '만들지 못했습니다.');
        } finally {
          setPending(false);
        }
      }}
    >
      <input aria-label="새 섹션 이름" placeholder="예: 공지사항, 1모둠, 질문 모음" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      {error && <p className="sb-error">{error}</p>}
      <button className="sb-btn" disabled={pending || !name.trim()}>
        섹션 만들기
      </button>
    </form>
  );
}

function MemberSplitButton({ boardId, onChanged, className, label = '멤버별로 나누기' }: { boardId: string; onChanged: () => void; className: string; label?: string }) {
  const { api } = useSb();
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const r = await api<{ added: number }>(`/boards/${boardId}/columns/members`, json('POST'));
            setMsg(`섹션 ${r.added ?? 0}개를 만들었어요.`);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : '만들지 못했습니다.');
          } finally {
            setPending(false);
            onChanged();
          }
        }}
      >
        {pending ? '만드는 중…' : label}
      </button>
      {msg && (
        <p role="status" className="sb-meta sb-center">
          {msg}
        </p>
      )}
    </>
  );
}
