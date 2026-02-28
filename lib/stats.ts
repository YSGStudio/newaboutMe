export type Period = 'week' | 'month' | 'semester';

export const isPeriod = (value: string | null): value is Period =>
  value === 'week' || value === 'month' || value === 'semester';

const formatDate = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
    days: Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  };
}

export const safeRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
};
