import { describe, it, expect } from 'vitest';
import { buildThreads, type ThreadLetter } from '@/lib/letter-threads';

const minjun = { id: 'a', name: '김민준', student_number: 3 };
const seoyeon = { id: 'b', name: '이서연', student_number: 1 };
const jiho = { id: 'c', name: '박지호', student_number: 2 };

const letter = (id: string, from: typeof minjun, to: typeof minjun, at: string, archived = false): ThreadLetter => ({
  id,
  title: `편지 ${id}`,
  content: '내용',
  created_at: at,
  teacher_archived_at: archived ? '2026-10-01T00:00:00Z' : null,
  sender_id: from.id,
  recipient_id: to.id,
  sender: from,
  recipient: to,
});

describe('buildThreads', () => {
  it('보낸 편지와 답장을 같은 두 학생의 대화 하나로 묶는다', () => {
    const threads = buildThreads([
      letter('1', minjun, seoyeon, '2026-10-06T01:00:00Z'),
      letter('2', seoyeon, minjun, '2026-10-07T01:00:00Z'),
      letter('3', minjun, jiho, '2026-10-05T01:00:00Z'),
    ]);
    expect(threads).toHaveLength(2);
    const pair = threads.find((t) => t.letters.length === 2)!;
    expect(pair.letters.map((l) => l.id)).toEqual(['1', '2']); // 시간순
  });

  it('출석번호가 앞선 학생을 왼쪽에 둔다', () => {
    const [thread] = buildThreads([letter('1', minjun, seoyeon, '2026-10-06T01:00:00Z')]);
    expect(thread.left.person?.name).toBe('이서연');
    expect(thread.right.person?.name).toBe('김민준');
  });

  it('가장 최근 편지가 있는 대화가 먼저 오고, 새 편지 수를 센다', () => {
    const threads = buildThreads([
      letter('1', minjun, jiho, '2026-10-01T01:00:00Z', true),
      letter('2', minjun, seoyeon, '2026-10-06T01:00:00Z', true),
      letter('3', seoyeon, minjun, '2026-10-08T01:00:00Z'),
    ]);
    expect(threads[0].letters.map((l) => l.id)).toEqual(['2', '3']);
    expect(threads[0].newCount).toBe(1);
    expect(threads[1].newCount).toBe(0);
  });

  it('삭제된 학생이 있어도 대화를 만든다', () => {
    const orphan = { ...letter('1', minjun, seoyeon, '2026-10-06T01:00:00Z'), recipient: null };
    const [thread] = buildThreads([orphan]);
    expect(thread.letters).toHaveLength(1);
    expect([thread.left.person, thread.right.person]).toContain(null);
  });
});
