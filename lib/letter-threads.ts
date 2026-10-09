/**
 * 별빛메일 대화 묶기 — 같은 두 학생이 주고받은 편지를 하나의 대화로 묶습니다.
 * DB에는 "어느 편지에 대한 답장인지" 연결 정보가 없어, 묶는 기준은 두 학생의 짝입니다.
 * 화면(components/teacher/LetterThreads.tsx)과 테스트가 함께 씁니다.
 */
export type Person = { id: string; name: string; student_number: number };

export type ThreadLetter = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  teacher_archived_at: string | null;
  sender_id: string;
  recipient_id: string;
  sender: Person | null;
  recipient: Person | null;
};

export type Thread<T extends ThreadLetter> = {
  key: string;
  left: { id: string; person: Person | null };
  right: { id: string; person: Person | null };
  letters: T[];
  newCount: number;
  lastAt: string;
};

/** 두 학생의 짝으로 편지를 묶습니다. 출석번호가 앞선 학생을 왼쪽에 둡니다. */
export function buildThreads<T extends ThreadLetter>(letters: T[]): Thread<T>[] {
  const byKey = new Map<string, T[]>();
  for (const letter of letters) {
    const key = [letter.sender_id, letter.recipient_id].sort().join('|');
    const bucket = byKey.get(key);
    if (bucket) bucket.push(letter);
    else byKey.set(key, [letter]);
  }

  return [...byKey.entries()].map(([key, rows]) => {
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const people = new Map<string, Person | null>();
    for (const row of sorted) {
      if (!people.has(row.sender_id) || row.sender) people.set(row.sender_id, row.sender);
      if (!people.has(row.recipient_id) || row.recipient) people.set(row.recipient_id, row.recipient);
    }
    const [a, b] = [...people.entries()].map(([id, person]) => ({ id, person }));
    const second = b ?? a; // 자기 자신에게 보낸 편지
    const [left, right] = (a.person?.student_number ?? 0) <= (second.person?.student_number ?? 0) ? [a, second] : [second, a];
    return {
      key,
      left,
      right,
      letters: sorted,
      newCount: sorted.filter((row) => !row.teacher_archived_at).length,
      lastAt: sorted[sorted.length - 1].created_at,
    };
  }).sort((x, y) => y.lastAt.localeCompare(x.lastAt));
}
