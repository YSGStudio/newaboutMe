import 'server-only';

const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export const studentLabel = (studentNumber: number) => `${studentNumber}번 학생`;

// ISO 날짜/타임스탬프를 기간 시작일 기준 상대 표현("N주차 M요일")으로 변환
// — 실제 날짜를 GPT에 그대로 보내지 않기 위함
export function toRelativeDateLabel(dateOrIso: string, periodStartDate: string): string {
  const target = new Date(dateOrIso);
  const start = new Date(`${periodStartDate}T00:00:00.000Z`);
  const targetUtcDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  const diffDays = Math.floor((targetUtcDay.getTime() - start.getTime()) / 86400000);
  const week = Math.max(1, Math.floor(diffDays / 7) + 1);
  const weekday = WEEKDAY_LABELS[target.getUTCDay()];
  return `${week}주차 ${weekday}`;
}

// 학생을 식별할 수 있는 정보(이름·DB ID·학급코드 등)가 프롬프트에 섞여 들어가지 않았는지 점검하는 안전망.
// 호출부에서 만든 프롬프트 문자열에 실제 이름이 포함되면 호출 자체를 막는다.
export function assertNoRealName(promptText: string, realName: string): void {
  if (realName && promptText.includes(realName)) {
    throw new Error('익명화 실패: 프롬프트에 학생 실명이 포함되어 있습니다.');
  }
}
