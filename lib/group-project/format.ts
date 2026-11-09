/** 모둠 프로젝트 화면의 날짜 표시. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(d: string | null): string {
  if (!d) return '날짜 미정';
  const [, m, day] = d.split('-');
  return `${Number(m)}/${Number(day)}`;
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return '날짜 미정';
  if (start === end || !start) return formatDate(end);
  if (!end) return `${formatDate(start)}~`;
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

export function assigneeLabel(assigneeIds: string[], names: Record<string, string>): string {
  if (assigneeIds.length === 0) return '미배정';
  return assigneeIds.map((id) => names[id] ?? '?').join(', ');
}
