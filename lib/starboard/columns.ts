/** 새 보드는 열 없이(빈 화면) 시작하므로 0개도 허용한다. DB columns_limit과 같은 값. */
export const MIN_COLUMNS = 0;
/** 학급 전체를 학생별 열로 나눌 수 있게 넉넉히 둔다. */
export const MAX_COLUMNS = 60;

/** 열 머리 파스텔 색 */
export const COLUMN_PALETTE = ["#F9D5F0", "#F8D7D7", "#F9E1BE", "#FBF0C0", "#D6F0DC", "#D4E8F8", "#E3DAF7", "#FADBC8"] as const;

/**
 * "멤버별로 나누기": 학생마다 "01. 이름" 열. 이미 있는 이름의 열은 건너뛴다.
 * 번호는 이름순 전체 명단 기준이라 일부만 추가돼도 번호가 흔들리지 않는다.
 */
export function memberColumns(
  members: { id: string; name: string }[],
  existingNames: string[],
  existingCount: number,
  existingMemberIds: (string | null)[] = [],
): { name: string; color: string; member_id: string }[] {
  const have = new Set(existingNames);
  const haveMember = new Set(existingMemberIds.filter(Boolean));
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return sorted
    .map((m, i) => ({
      name: `${String(i + 1).padStart(2, "0")}. ${m.name}`.slice(0, 40),
      color: COLUMN_PALETTE[i % COLUMN_PALETTE.length],
      member_id: m.id,
    }))
    .filter((c) => !have.has(c.name) && !haveMember.has(c.member_id))
    .slice(0, Math.max(0, MAX_COLUMNS - existingCount));
}

export function canAddColumn(count: number): boolean {
  return count < MAX_COLUMNS;
}

export function canDeleteColumn(count: number): boolean {
  return count > MIN_COLUMNS;
}

/** 두 위치 사이의 새 위치(분수 위치). 끝에 넣을 때는 next=null */
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return 1;
  if (prev === null) return next! - 1;
  if (next === null) return prev + 1;
  return (prev + next) / 2;
}

/** 열 머리 배경: 진한 색(예전 보드)은 흰색과 섞어 글자가 잘 읽히게 한다 */
export function columnTint(color: string): string {
  const n = parseInt(color.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.75 ? color : `color-mix(in srgb, ${color} 30%, white)`;
}
