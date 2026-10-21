import { describe, expect, it } from 'vitest';
import type { StatsSession } from 'poker-core';
import type { HandRow } from '@/lib/hands/session-hands';
import { detailTiles, sessionStage } from './detail';
import { emptySummary } from './summary';

const base: StatsSession = {
  id: 's1',
  kind: 'cash',
  mode: 'live',
  venue: 'Chill',
  stakeLabel: '25/50',
  currency: 'VND',
  bb: 50,
  date: '2026-10-20',
  startAt: '2026-10-20T10:00:00Z',
  endAt: null,
  buyin: 10000,
  cashout: null,
  stopLoss: null,
  selfState: null,
  mtt: null,
};

const hand = (num: number, result: number | null, needsReview = false): HandRow =>
  ({
    id: `h${num}`,
    num,
    result,
    resultBb: result == null ? null : result / 50,
    needsReview,
  }) as HandRow;

describe('detailTiles, cash', () => {
  it('open: elapsed time, net from the hands so far, no bb/hour', () => {
    const t = detailTiles(
      base,
      [hand(1, 500), hand(2, -250), hand(3, null, true)],
      '2026-10-20T12:30:00Z',
    );
    expect(t).toMatchObject({
      kind: 'cash',
      hours: 2.5,
      hands: 3,
      net: { bb: 5, money: 250 },
      rate: null,
      toReview: 1,
    });
  });

  it('ended: the real result and bb/hour', () => {
    const ended = { ...base, endAt: '2026-10-20T14:00:00Z', cashout: 12500 };
    const t = detailTiles(ended, [hand(1, 100)], '2026-10-21T00:00:00Z');
    expect(t).toMatchObject({ kind: 'cash', hours: 4, net: { bb: 50, money: 2500 }, rate: 12.5 });
  });

  it('ended without a cash-out falls back to the hands; no end time means no bb/hour', () => {
    const t = detailTiles({ ...base, endAt: '2026-10-20T11:00:00Z' }, [hand(1, 500)], 'x');
    expect(t).toMatchObject({ net: { bb: 10, money: 500 }, rate: null });
  });

  it('not started: no time', () => {
    const t = detailTiles({ ...base, startAt: null }, [], '2026-10-20T12:00:00Z');
    expect(t).toMatchObject({ kind: 'cash', hours: null, hands: 0, net: null });
  });
});

describe('detailTiles, MTT', () => {
  const mtt: StatsSession = {
    ...base,
    kind: 'mtt',
    buyin: 500,
    mtt: { reentries: 1, prize: 2000, bounty: 300, place: 12, entries: 180, bustStage: 'itm' },
  };
  it('buy-in with re-entries, place, prize plus bounty', () => {
    expect(detailTiles(mtt, [hand(1, 0, true)], 'x')).toEqual({
      kind: 'mtt',
      buyin: 500,
      reentries: 1,
      place: 12,
      entries: 180,
      prize: 2300,
      bounty: 300,
      toReview: 1,
    });
  });
  it('before the result is entered: no prize', () => {
    const open = {
      ...mtt,
      mtt: { ...mtt.mtt!, prize: null, bounty: null, place: null, entries: null },
    };
    expect(detailTiles(open, [], 'x')).toMatchObject({ place: null, prize: null });
  });
});

describe('sessionStage', () => {
  it('follows the session: not started, playing, ended, summarized', () => {
    const none = emptySummary();
    expect(sessionStage({ ...base, startAt: null }, none)).toBe('notStarted');
    expect(sessionStage(base, none)).toBe('playing');
    expect(sessionStage({ ...base, endAt: '2026-10-20T14:00:00Z' }, none)).toBe('ended');
    expect(sessionStage({ ...base, endAt: '2026-10-20T14:00:00Z' }, { ...none, grade: 'B' })).toBe(
      'summarized',
    );
    expect(sessionStage({ ...base, endAt: '2026-10-20T14:00:00Z' }, { ...none, notes: 'ok' })).toBe(
      'summarized',
    );
  });
});
