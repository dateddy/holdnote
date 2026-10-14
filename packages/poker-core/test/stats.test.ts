import { describe, expect, it } from 'vitest';
import {
  bbPerHour,
  cumulativeSeries,
  disciplineStats,
  leakTable,
  mttStats,
  sessionResult,
  stopLossBreached,
  type StatsSession,
} from '../src/index';

function cash(over: Partial<StatsSession> = {}): StatsSession {
  return {
    id: 's1',
    kind: 'cash',
    mode: 'online',
    venue: null,
    stakeLabel: '0.01/0.02',
    currency: 'USD',
    bb: 0.02,
    date: '2026-09-29',
    startAt: null,
    endAt: null,
    buyin: 8.11,
    cashout: 4.81,
    stopLoss: null,
    selfState: null,
    mtt: null,
    ...over,
  };
}

function mtt(over: Partial<StatsSession> = {}): StatsSession {
  return cash({
    id: 'm1',
    kind: 'mtt',
    buyin: 1.08,
    cashout: null,
    mtt: { reentries: 0, prize: 1.51, bounty: 0.5, place: 200, entries: 1, bustStage: 'itm' },
    ...over,
  });
}

describe('sessionResult', () => {
  it('cash: cashout minus buy-in, in money and bb', () => {
    expect(sessionResult(cash())).toEqual({ money: -3.3, bb: -165 });
  });

  it('cash without cash-out has no result', () => {
    expect(sessionResult(cash({ cashout: null }))).toBeNull();
    expect(sessionResult(cash({ buyin: null }))).toBeNull();
  });

  it('mtt: prize + bounty minus buy-in times entries, no bb', () => {
    expect(sessionResult(mtt())).toEqual({ money: 0.93, bb: null });
    expect(sessionResult(mtt({ mtt: { ...mtt().mtt!, reentries: 1 } }))).toEqual({
      money: -0.15,
      bb: null,
    });
  });

  it('mtt without a recorded prize has no result', () => {
    expect(sessionResult(mtt({ mtt: { ...mtt().mtt!, prize: null } }))).toBeNull();
    expect(sessionResult(mtt({ mtt: null }))).toBeNull();
  });
});

describe('bbPerHour', () => {
  it('needs start and end time', () => {
    expect(bbPerHour(cash())).toBeNull();
    expect(bbPerHour(cash({ startAt: '2026-09-29T10:00:00Z' }))).toBeNull();
  });

  it('divides bb result by hours', () => {
    const s = cash({ startAt: '2026-09-29T10:00:00Z', endAt: '2026-09-29T12:00:00Z' });
    expect(bbPerHour(s)).toBe(-82.5);
  });

  it('is null for mtt and for zero length', () => {
    expect(
      bbPerHour(mtt({ startAt: '2026-09-29T10:00:00Z', endAt: '2026-09-29T12:00:00Z' })),
    ).toBeNull();
    expect(
      bbPerHour(cash({ startAt: '2026-09-29T10:00:00Z', endAt: '2026-09-29T10:00:00Z' })),
    ).toBeNull();
  });
});

describe('stopLossBreached', () => {
  it('breached only when the loss exceeds the stop-loss', () => {
    expect(stopLossBreached(cash({ stopLoss: 6 }))).toBe(false);
    expect(stopLossBreached(cash({ stopLoss: 3 }))).toBe(true);
    expect(stopLossBreached(cash({ stopLoss: 3.3 }))).toBe(false);
  });

  it('false without stop-loss, without result, or for winners', () => {
    expect(stopLossBreached(cash())).toBe(false);
    expect(stopLossBreached(cash({ stopLoss: 3, cashout: null }))).toBe(false);
    expect(stopLossBreached(cash({ stopLoss: 3, cashout: 20 }))).toBe(false);
    expect(stopLossBreached(mtt({ stopLoss: 0.1 }))).toBe(false);
  });
});

describe('mttStats', () => {
  it('groups by currency with ROI, ITM% and most common bust stage', () => {
    const list = [
      mtt({ id: 'a' }),
      mtt({
        id: 'b',
        mtt: { reentries: 0, prize: 0, bounty: 0, place: 90, entries: 100, bustStage: 'early' },
      }),
      mtt({
        id: 'c',
        mtt: { reentries: 0, prize: 0, bounty: 0, place: 80, entries: 100, bustStage: 'early' },
      }),
      mtt({
        id: 'd',
        currency: 'VND',
        buyin: 100,
        mtt: {
          reentries: 0,
          prize: 300,
          bounty: 0,
          place: 1,
          entries: 9,
          bustStage: 'final_table',
        },
      }),
      cash({ id: 'x' }),
    ];
    const usd = mttStats(list).find((g) => g.currency === 'USD')!;
    expect(usd.count).toBe(3);
    expect(usd.cost).toBeCloseTo(3.24, 2);
    expect(usd.returned).toBeCloseTo(2.01, 2);
    expect(usd.roi).toBeCloseTo(-0.38, 2);
    expect(usd.itmPct).toBeCloseTo(33.3, 1);
    expect(usd.topBustStage).toBe('early');
    const vnd = mttStats(list).find((g) => g.currency === 'VND')!;
    expect(vnd.roi).toBe(2);
    expect(vnd.itmPct).toBe(100);
  });

  it('skips mtt sessions without a result and returns [] when none', () => {
    expect(mttStats([mtt({ mtt: null }), cash()])).toEqual([]);
  });
});

describe('leakTable', () => {
  const sessions = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `s${n}`, date: `2026-09-0${n}` }));

  it('counts hands and sessions, trend oldest to newest over the last 5 sessions', () => {
    const rows = [
      { sessionId: 's6', tag: 'tilt', handCount: 2 },
      { sessionId: 's5', tag: 'tilt', handCount: 1 },
      { sessionId: 's3', tag: 'tilt', handCount: 4 },
      { sessionId: 's1', tag: 'tilt', handCount: 9 },
      { sessionId: 's6', tag: 'sizing_too_small', handCount: 1 },
    ];
    const table = leakTable(rows, sessions);
    const tilt = table.find((r) => r.tag === 'tilt')!;
    expect(tilt.hands).toBe(16);
    expect(tilt.sessions).toBe(4);
    // last 5 sessions are s2..s6
    expect(tilt.trend).toEqual([false, true, false, true, true]);
    expect(tilt.repeated).toBe(true);
    const size = table.find((r) => r.tag === 'sizing_too_small')!;
    expect(size.repeated).toBe(false);
    expect(table[0]!.tag).toBe('tilt');
  });

  it('merges review and summary rows of the same session, summary rows count as presence', () => {
    const rows = [
      { sessionId: 's6', tag: 'tilt', handCount: 2 },
      { sessionId: 's6', tag: 'tilt', handCount: 0 },
      { sessionId: 's2', tag: 'bad_bluff', handCount: 0 },
    ];
    const table = leakTable(rows, sessions);
    expect(table.find((r) => r.tag === 'tilt')!.sessions).toBe(1);
    expect(table.find((r) => r.tag === 'bad_bluff')!.hands).toBe(0);
  });

  it('ignores rows of unknown sessions and handles fewer than 5 sessions', () => {
    const table = leakTable([{ sessionId: 'zz', tag: 'tilt', handCount: 1 }], sessions.slice(0, 2));
    expect(table).toEqual([]);
    const short = leakTable([{ sessionId: 's1', tag: 'tilt', handCount: 1 }], sessions.slice(0, 2));
    expect(short[0]!.trend).toEqual([true, false]);
  });
});

describe('cumulativeSeries', () => {
  const list = [
    cash({ id: 'b', date: '2026-09-30', cashout: 20, buyin: 10, bb: 0.5 }),
    cash({ id: 'a', date: '2026-09-29' }),
    cash({ id: 'c', date: '2026-10-01', cashout: null }),
    mtt({ id: 'd', date: '2026-10-02' }),
  ];

  it('orders by date and accumulates bb, skipping sessions without bb result', () => {
    const pts = cumulativeSeries(list, 'bb');
    expect(pts.map((p) => p.sessionId)).toEqual(['a', 'b']);
    expect(pts.map((p) => p.cumulative)).toEqual([-165, -145]);
  });

  it('accumulates money including mtt', () => {
    const pts = cumulativeSeries(list, 'money');
    expect(pts.map((p) => p.sessionId)).toEqual(['a', 'b', 'd']);
    expect(pts[2]!.cumulative).toBeCloseTo(7.63, 2);
  });
});

describe('disciplineStats', () => {
  it('counts stop-loss breaches and tilt sessions', () => {
    const list = [
      cash({ id: 'a', stopLoss: 3 }),
      cash({ id: 'b', stopLoss: 10, selfState: 'tilt' }),
      cash({ id: 'c', selfState: 'tired' }),
    ];
    expect(disciplineStats(list)).toEqual({ sessions: 3, stopLossBreaches: 1, tiltSessions: 1 });
  });
});
