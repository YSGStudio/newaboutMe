const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const formatDateInSeoul = (date: Date) => DATE_FORMATTER.format(date);

export const todayDate = () => formatDateInSeoul(new Date());

const SEOUL_UTC_OFFSET_HOURS = 9;

const parseDateString = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
};

export const getSeoulDayRange = (date: string) => {
  const { year, month, day } = parseDateString(date);
  const start = new Date(Date.UTC(year, month - 1, day, -SEOUL_UTC_OFFSET_HOURS, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -SEOUL_UTC_OFFSET_HOURS, 0, 0, 0) - 1);

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
};
