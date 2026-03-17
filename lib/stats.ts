export type Period = 'week' | 'month' | 'semester';

export const isPeriod = (value: string | null): value is Period =>
  value === 'week' || value === 'month' || value === 'semester';

const formatDate = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toUtcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

export const isWeekendDate = (date: string) => {
  const day = toUtcDate(date).getUTCDay();
  return day === 0 || day === 6;
};

export const enumerateWeekdays = (startDate: string, endDate: string) => {
  const result: string[] = [];
  const current = toUtcDate(startDate);
  const end = toUtcDate(endDate);

  while (current.getTime() <= end.getTime()) {
    const currentDate = formatDate(current);
    if (!isWeekendDate(currentDate)) {
      result.push(currentDate);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
};

export const countWeekdaysBetweenInclusive = (startDate: string, endDate: string) => enumerateWeekdays(startDate, endDate).length;

export function getPeriodRange(period: Period) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);

  if (period === 'week') {
    start.setUTCDate(end.getUTCDate() - 6);
  } else if (period === 'month') {
    start.setUTCDate(end.getUTCDate() - 29);
  } else {
    start.setUTCDate(end.getUTCDate() - 181);
  }

  return {
    period,
    startDate: formatDate(start),
    endDate: formatDate(end),
    startIso: `${formatDate(start)}T00:00:00.000Z`,
    endIso: `${formatDate(end)}T23:59:59.999Z`,
    days: Math.floor((end.getTime() - start.getTime()) / 86400000) + 1,
    weekdays: countWeekdaysBetweenInclusive(formatDate(start), formatDate(end))
  };
}

export const safeRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
};
