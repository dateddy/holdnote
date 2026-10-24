import { describe, expect, it } from 'vitest';
import { composeTimes, editTimesFrom, localDate, localTime, resolveTimes } from './times';

const HOUR = 3_600_000;
const NOW = '2026-10-21T12:00:00.000Z';

describe('composeTimes', () => {
  it('turns the date and the two times into moments, end after start', () => {
    const { startAt, endAt } = composeTimes('2026-10-14', '19:00', '23:30');
    expect(Date.parse(endAt ?? '') - Date.parse(startAt ?? '')).toBe(4.5 * HOUR);
  });

  it('an end time earlier than the start is after midnight (next day)', () => {
    const { startAt, endAt } = composeTimes('2026-10-14', '22:00', '02:00');
    expect(Date.parse(endAt ?? '') - Date.parse(startAt ?? '')).toBe(4 * HOUR);
  });

  it('empty or broken pieces give null', () => {
    expect(composeTimes('2026-10-14', '', '')).toEqual({ startAt: null, endAt: null });
    expect(composeTimes('', '19:00', '')).toEqual({ startAt: null, endAt: null });
    expect(composeTimes('2026-10-14', '19:00', '').endAt).toBeNull();
  });

  it('local date and time read back what was composed', () => {
    const { startAt } = composeTimes('2026-10-14', '09:05', '');
    const d = new Date(startAt ?? '');
    expect([localDate(d), localTime(d)]).toEqual(['2026-10-14', '09:05']);
  });
});

describe('resolveTimes', () => {
  it('keeps a valid start and end', () => {
    expect(
      resolveTimes('2026-10-14T10:00:00Z', '2026-10-14T12:00:00Z', NOW, { startRequired: true }),
    ).toEqual({
      startAt: '2026-10-14T10:00:00.000Z',
      endAt: '2026-10-14T12:00:00.000Z',
      error: false,
    });
  });

  it('a new session without a start starts now; an edit may have none', () => {
    expect(resolveTimes('', '', NOW, { startRequired: true })).toMatchObject({ startAt: NOW });
    expect(resolveTimes('', '', NOW, { startRequired: false })).toMatchObject({ startAt: null });
  });

  it('an end that is not after the start, or unreadable, is an error', () => {
    const r = resolveTimes('2026-10-14T10:00:00Z', '2026-10-14T10:00:00Z', NOW, {
      startRequired: true,
    });
    expect(r.error).toBe(true);
    expect(resolveTimes('x', '', NOW, { startRequired: true }).error).toBe(true);
  });
});

describe('editTimesFrom', () => {
  // Built from local parts so the test means the same in any time zone.
  const iso = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).toISOString();

  it('an open session: date and start time as saved, end time empty', () => {
    expect(editTimesFrom({ date: '2026-10-21', start_at: iso(21, 13, 12), end_at: null })).toEqual({
      date: '2026-10-21',
      startTime: '13:12',
      endTime: '',
    });
  });

  it('an ended session after midnight keeps its end time on the clock', () => {
    const row = { date: '2026-10-21', start_at: iso(21, 22, 0), end_at: iso(22, 2, 30) };
    const got = editTimesFrom(row);
    expect(got).toEqual({ date: '2026-10-21', startTime: '22:00', endTime: '02:30' });
    // Saving it untouched gives the same two moments back.
    expect(composeTimes(got.date, got.startTime, got.endTime)).toEqual({
      startAt: row.start_at,
      endAt: row.end_at,
    });
  });

  it('the date follows the local day of the start when they differ', () => {
    expect(editTimesFrom({ date: '2026-10-20', start_at: iso(21, 1, 5), end_at: null }).date).toBe(
      '2026-10-21',
    );
  });

  it('no start time saved: the saved date, empty times, never "now"', () => {
    expect(editTimesFrom({ date: '2026-10-21', start_at: null, end_at: null })).toEqual({
      date: '2026-10-21',
      startTime: '',
      endTime: '',
    });
  });
});
