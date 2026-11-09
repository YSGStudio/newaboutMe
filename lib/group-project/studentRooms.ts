/** 학생 탭 첫 화면에서 열 방을 고르는 규칙. 화면 없이 단위 테스트한다. */
import type { StudentRoom } from './types';

// 진행 중인 최신 주제 우선, 없으면 가장 최근 주제
export function pickDefaultRoom(rooms: StudentRoom[], today: string): StudentRoom | null {
  const byLatest = [...rooms].sort((a, b) => (a.topic.start_date < b.topic.start_date ? 1 : -1));
  return byLatest.find((r) => r.topic.start_date <= today && today <= r.topic.end_date) ?? byLatest[0] ?? null;
}
