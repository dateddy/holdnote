import { describe, expect, it } from 'vitest';
import type { StatsSession } from 'poker-core';
import { filterOptions, filterSessions, parseFilters, resolveView } from './filters';

function s(over: Partial<StatsSession>): StatsSession {
  return {
    id: 'x',
    kind: 'cash',
    mode: 'online',
    venue: null,
    stakeLabel: '0.01/0.02',
    currency: 'USD',
    bb: 0.02,
    date: '2026-10-01',
    startAt: null,
    endAt: null,
    buyin: 10,
    cashout: 12,
    stopLoss: null,
    selfState: null,
    mtt: null,
    ...over,
  };
}

const mttRow = (over: Partial<StatsSession> = {}) =>
  s({
    kind: 'mtt',
    stakeLabel: null,
    buyin: 1,
    cashout: null,
    mtt: { reentries: 0, prize: 3, bounty: 0, place: 1, entries: 9, bustStage: null },
    ...over,
  });

describe('parseFilters', () => {
  it('reads known values and ignores junk', () => {
    expect(
      parseFilters({
        kind: 'mtt',
        mode: 'live',
        venue: ' Hà Nội ',
        stake: '1/2',
        currency: 'VND',
        unit: 'money',
      }),
    ).toEqual({
      kind: 'mtt',
      mode: 'live',
      venue: 'Hà Nội',
      stake: '1/2',
      currency: 'VND',
      unit: 'money',
    });
    expect(parseFilters({ kind: 'x', mode: ['zzz'], unit: 'zz' })).toEqual({
      kind: 'all',
      mode: 'all',
      venue: '',
      stake: '',
      currency: '',
      unit: null,
    });
  });
});

describe('filterSessions', () => {
  const list = [
    s({ id: 'a', venue: 'Sòng A', mode: 'live', stakeLabel: '25/50', currency: 'VND' }),
    s({ id: 'b', venue: 'sòng a', mode: 'online' }),
    mttRow({ id: 'c' }),
  ];
  const f = parseFilters({});
  it('filters by each field, venue ignoring case', () => {
    expect(filterSessions(list, f)).toHaveLength(3);
    expect(filterSessions(list, { ...f, kind: 'mtt' }).map((x) => x.id)).toEqual(['c']);
    expect(filterSessions(list, { ...f, mode: 'live' }).map((x) => x.id)).toEqual(['a']);
    expect(filterSessions(list, { ...f, venue: 'SÒNG A' }).map((x) => x.id)).toEqual(['a', 'b']);
    expect(filterSessions(list, { ...f, stake: '25/50' }).map((x) => x.id)).toEqual(['a']);
    expect(filterSessions(list, { ...f, currency: 'VND' }).map((x) => x.id)).toEqual(['a']);
  });
});

describe('filterOptions', () => {
  it('lists distinct venues, stakes and currencies, sorted', () => {
    const o = filterOptions([
      s({ venue: 'B', stakeLabel: '1/2', currency: 'VND' }),
      s({ venue: 'a', stakeLabel: '1/2', currency: 'USD' }),
      s({ venue: 'A', stakeLabel: null, currency: 'USD' }),
      mttRow({ venue: null }),
    ]);
    expect(o.venues).toEqual(['a', 'B']);
    expect(o.stakes).toEqual(['1/2']);
    expect(o.currencies).toEqual(['USD', 'VND']);
  });
});

describe('resolveView', () => {
  const list = [
    s({ id: 'a' }),
    s({ id: 'b', cashout: null }),
    s({ id: 'c', currency: 'VND', buyin: 1000, cashout: 900, bb: 50 }),
    mttRow({ id: 'd' }),
    mttRow({
      id: 'e',
      currency: 'VND',
      buyin: 100,
      mtt: { reentries: 0, prize: 0, bounty: 0, place: 5, entries: 9, bustStage: null },
    }),
    mttRow({ id: 'f' }),
  ];
  const f = parseFilters({});

  it('defaults to bb over cash sessions, mtt left out', () => {
    const v = resolveView(list, f);
    expect(v.unit).toBe('bb');
    expect(v.currency).toBeNull();
    expect(v.sessions.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(v.missing).toBe(1);
  });

  it('mtt defaults to money in the most common currency', () => {
    const only = { ...f, kind: 'mtt' as const };
    const v = resolveView(filterSessions(list, only), only);
    expect(v.unit).toBe('money');
    expect(v.currency).toBe('USD');
    expect(v.sessions.map((x) => x.id)).toEqual(['d', 'f']);
  });

  it('money needs one currency: explicit choice wins', () => {
    const v = resolveView(list, { ...f, unit: 'money', currency: 'VND' });
    expect(v.currency).toBe('VND');
    expect(v.sessions.map((x) => x.id)).toEqual(['c', 'e']);
  });

  it('no sessions at all gives an empty bb view', () => {
    expect(resolveView([], f)).toMatchObject({ unit: 'bb', sessions: [], missing: 0 });
    expect(resolveView([], { ...f, kind: 'mtt' })).toMatchObject({ unit: 'money', currency: null });
  });
});
