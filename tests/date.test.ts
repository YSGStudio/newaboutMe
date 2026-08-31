import { describe, it, expect } from 'vitest';
import { formatDateInSeoul, getSeoulDayRange, SEOUL_UTC_OFFSET_HOURS } from '@/lib/date';

describe('formatDateInSeoul', () => {
  it('UTC 시각을 서울 날짜로 옮긴다', () => {
    // 2026-08-30T15:00Z = 서울 2026-08-31 00:00
    expect(formatDateInSeoul(new Date('2026-08-30T15:00:00Z'))).toBe('2026-08-31');
  });

  it('서울 자정 직전은 아직 전날이다', () => {
    expect(formatDateInSeoul(new Date('2026-08-30T14:59:59Z'))).toBe('2026-08-30');
  });
});

describe('getSeoulDayRange', () => {
  it('하루의 시작과 끝을 UTC로 돌려준다', () => {
    const { startIso, endIso } = getSeoulDayRange('2026-08-31');
    expect(startIso).toBe('2026-08-30T15:00:00.000Z');
    expect(endIso).toBe('2026-08-31T14:59:59.999Z');
  });

  it('범위의 양 끝은 같은 서울 날짜에 속한다', () => {
    const { start, end } = getSeoulDayRange('2026-08-31');
    expect(formatDateInSeoul(start)).toBe('2026-08-31');
    expect(formatDateInSeoul(end)).toBe('2026-08-31');
  });

  it('월말을 넘어가도 다음 달 1일로 이어진다', () => {
    expect(getSeoulDayRange('2026-08-31').endIso).toBe('2026-08-31T14:59:59.999Z');
    expect(getSeoulDayRange('2026-09-01').startIso).toBe('2026-08-31T15:00:00.000Z');
  });

  it('서울은 UTC+9다', () => {
    expect(SEOUL_UTC_OFFSET_HOURS).toBe(9);
  });
});
