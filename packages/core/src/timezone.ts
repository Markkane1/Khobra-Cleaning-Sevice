type DateParts = { year: number; month: number; day: number };

function partsAt(value: Date, timeZone: string): DateParts & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match || !clock) throw new Error('Invalid local date or time');
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]), Number(clock[3] || 0));
  let instant = target;
  for (let attempt = 0; attempt < 2; attempt++) {
    const actual = partsAt(new Date(instant), timeZone);
    instant += target - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  }
  return new Date(instant);
}

function dateKey(value: Date | string, timeZone: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const { year, month, day } = partsAt(new Date(value), timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function zonedDayRange(value: Date | string, timeZone: string): { start: Date; end: Date } {
  const date = dateKey(value, timeZone);
  return { start: zonedDateTimeToUtc(date, '00:00', timeZone), end: zonedDateTimeToUtc(addDays(date, 1), '00:00', timeZone) };
}

export function calendarDayRange(value: Date | string, timeZone: string): { start: Date; end: Date } {
  const date = dateKey(value, timeZone);
  return { start: new Date(`${date}T00:00:00.000Z`), end: new Date(`${addDays(date, 1)}T00:00:00.000Z`) };
}

export function zonedMonthRange(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month');
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { start: zonedDateTimeToUtc(start, '00:00', timeZone), end: zonedDateTimeToUtc(next, '00:00', timeZone) };
}

export function zonedYearMonth(value: Date, timeZone: string): { year: number; month: number; monthName: string } {
  const { year, month } = partsAt(value, timeZone);
  return { year, month, monthName: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone }).format(value) };
}
