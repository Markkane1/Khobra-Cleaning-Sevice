import assert from 'node:assert/strict';
import { calendarDayRange, zonedDateTimeToUtc, zonedDayRange, zonedMonthRange } from './timezone.ts';

assert.equal(zonedDateTimeToUtc('2026-08-04', '00:00', 'Asia/Dubai').toISOString(), '2026-08-03T20:00:00.000Z');
assert.deepEqual(Object.values(zonedDayRange(new Date('2026-08-03T21:00:00Z'), 'Asia/Dubai')).map(date => date.toISOString()), ['2026-08-03T20:00:00.000Z', '2026-08-04T20:00:00.000Z']);
assert.deepEqual(Object.values(zonedMonthRange(2026, 8, 'Asia/Dubai')).map(date => date.toISOString()), ['2026-07-31T20:00:00.000Z', '2026-08-31T20:00:00.000Z']);
assert.equal(zonedDateTimeToUtc('2026-03-09', '00:00', 'America/New_York').toISOString(), '2026-03-09T04:00:00.000Z');
assert.deepEqual(Object.values(calendarDayRange(new Date('2026-08-03T21:00:00Z'), 'Asia/Dubai')).map(date => date.toISOString()), ['2026-08-04T00:00:00.000Z', '2026-08-05T00:00:00.000Z']);
