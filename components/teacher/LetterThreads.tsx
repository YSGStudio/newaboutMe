'use client';

/**
 * LetterThreads — 교사 별빛메일 탭의 "두 학생 대화" 목록.
 *
 * 편지마다 한 줄씩 늘어놓으면 보낸 편지와 답장이 따로 흩어져 맥락을 잡기 어려워서,
 * 같은 두 학생이 주고받은 편지를 하나의 대화로 묶고 펼치면 시간순으로 보여줍니다.
 * DB에는 "어느 편지에 대한 답장인지" 연결 정보가 없으므로, 묶는 기준은 두 학생의 짝입니다.
 *
 * - 대화에는 읽음처리한 지난 편지도 함께 보여줍니다(맥락을 위해). 새 편지는 따로 표시합니다.
 * - 어떤 대화를 목록에 올릴지는 상위 화면이 `visibleIds`로 정합니다
 *   (평소에는 새 편지가 있는 대화, 검색 중에는 검색에 걸린 편지가 있는 대화).
 * - 검색 중에는 대화를 펼친 채로 보여주고, 검색에 걸린 편지를 강조합니다.
 */
import { useMemo, useState } from 'react';
import { buildThreads, type Person, type ThreadLetter } from '@/lib/letter-threads';

type Props<T extends ThreadLetter> = {
  /** 읽음처리한 편지까지 포함한 학급 전체 편지 */
  letters: T[];
  /** 목록에 올릴 대화를 고르는 기준이 되는 편지 id */
  visibleIds: Set<string>;
  /** 검색 중이면 대화를 펼치고 걸린 편지를 강조합니다 */
  searching: boolean;
  deletingId: string;
  onOpen: (letter: T) => void;
  onDelete: (letterId: string) => void;
};

const personName = (person: Person | null) => person ? person.name : '알 수 없는 학생';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function LetterThreads<T extends ThreadLetter>({ letters, visibleIds, searching, deletingId, onOpen, onDelete }: Props<T>) {
  // 펼침 상태는 "기본값에서 뒤집은 대화"만 기억합니다. 검색 중에는 기본이 펼침입니다.
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());

  const threads = useMemo(
    () => buildThreads(letters).filter((thread) => thread.letters.some((row) => visibleIds.has(row.id))),
    [letters, visibleIds],
  );

  const toggle = (key: string) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="letter-thread-list">
      {threads.map((thread) => {
        const isOpen = searching !== toggled.has(thread.key);
        const last = thread.letters[thread.letters.length - 1];
        const bodyId = `letter-thread-${thread.key.replace('|', '-')}`;
        return (
          <section key={thread.key} className={`letter-thread${thread.newCount > 0 ? ' is-new' : ''}${isOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="letter-thread-head"
              aria-expanded={isOpen}
              aria-controls={bodyId}
              onClick={() => toggle(thread.key)}
            >
              <span className="letter-envelope-icon" aria-hidden="true">{thread.newCount > 0 ? '💌' : '✉'}</span>
              <span className="letter-thread-pair">
                <strong>
                  {personName(thread.left.person)}
                  <span aria-hidden="true"> ↔ </span>
                  <span className="sr-only">, </span>
                  {personName(thread.right.person)}
                </strong>
                <small>{last.title}</small>
              </span>
              <span className="letter-thread-meta">
                <span>{thread.letters.length}통</span>
                {thread.newCount > 0 && <span className="letter-thread-new">새 편지 {thread.newCount}</span>}
                <span>{formatDate(thread.lastAt)}</span>
              </span>
              <span className="letter-thread-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <ol id={bodyId} className="letter-thread-body">
                {thread.letters.map((letter) => {
                  const fromLeft = letter.sender_id === thread.left.id;
                  const isMatch = searching && visibleIds.has(letter.id);
                  return (
                    <li
                      key={letter.id}
                      className={`letter-bubble ${fromLeft ? 'is-left' : 'is-right'}${letter.teacher_archived_at ? ' is-read' : ''}${isMatch ? ' is-match' : ''}`}
                    >
                      <p className="letter-bubble-from">
                        {personName(letter.sender)} <span aria-hidden="true">→</span> {personName(letter.recipient)}
                        <time dateTime={letter.created_at}>{formatDateTime(letter.created_at)}</time>
                      </p>
                      <button type="button" className="letter-bubble-title" onClick={() => onOpen(letter)}>
                        {letter.title}
                      </button>
                      <p className="letter-bubble-content">{letter.content}</p>
                      <div className="letter-bubble-actions">
                        {!letter.teacher_archived_at && <span className="letter-thread-new">새 편지</span>}
                        <button
                          type="button"
                          className="letter-bubble-delete"
                          onClick={() => onDelete(letter.id)}
                          disabled={deletingId === letter.id}
                        >
                          {deletingId === letter.id ? '삭제 중' : '삭제'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
