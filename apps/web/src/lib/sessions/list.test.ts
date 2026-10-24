import { describe, expect, it } from 'vitest';
import type { SessionTotals, StatsSession } from 'poker-core';
import {
  buildListItems,
  staleItems,
  netTile,
  EMPTY_FILTER,
  filterItems,
  groupByMonth,
  listOptions,
  parseListFilter,
  serializeListFilter,
  sessionNet,
  sortItems,
  type ListFilter,
  type SessionListItem,
} from './list';

function stats(over: Partial<StatsSession> = {}): StatsSession {
  return {
    id: 's1',
    kind: 'cash',
    mode: 'live',
    venue: 'Chill',
    stakeLabel: '25/50',
    currency: 'VND',
    bb: 50,
    date: '2026-10-14',
    startAt: '2026-10-14T12:00:00Z',
    endAt: '2026-10-14T14:00:00Z',
    buyin: 10000,
    cashout: 12500, // +2500 = +50 bb
    stopLoss: null,
    selfState: null,
    mtt: null,
    ...over,
  };
}

function item(
  over: Partial<SessionListItem> & { s?: Partial<StatsSession> } = {},
): SessionListItem {
  const { s, ...rest } = over;
  return {
    session: stats(s),
    handCount: 10,
    toReview: 0,
    live: null,
    notes: '',
    tournamentName: null,
    lastHandAt: null,
    ...rest,
  };
}

const f = (over: Partial<ListFilter> = {}): ListFilter => ({ ...EMPTY_FILTER, ...over });
const ids = (xs: SessionListItem[]) => xs.map((x) => x.session.id);

describe('buildListItems', () => {
  const rows = [
    {
      id: 'a',
      kind: 'cash',
      mode: 'live',
      venue: 'Chill',
      stake_label: '25/50',
      currency: 'VND',
      bb: 50,
      date: '2026-10-14',
      start_at: '2026-10-14T12:00:00Z',
      end_at: null,
      buyin: 10000,
      cashout: null,
      stop_loss: null,
      self_state: null,
      mtt: null,
      summary: { notes: 'Bàn rất loose' },
    },
  ];
  const hands = [
    { id: 'h1', session_id: 'a', result: 500, level_bb: null, flagged: true },
    { id: 'h2', session_id: 'a', result: -250, level_bb: null, flagged: true },
    { id: 'h3', session_id: 'a', result: null, level_bb: null, flagged: false },
    { id: 'x', session_id: 'other', result: 100, level_bb: null, flagged: true },
  ];

  it('counts hands, flagged hands without an accepted review, and the live result', () => {
    const [first] = buildListItems(rows, hands, new Set(['h2']));
    expect(first!.handCount).toBe(3);
    expect(first!.toReview).toBe(1); // h1 flagged, no accepted review; h2 reviewed
    expect(first!.live).toEqual({ bb: 5, money: 250 });
    expect(first!.notes).toBe('Bàn rất loose');
  });
  it('lastHandAt is the newest created_at among the session hands', () => {
    const timed = [
      { ...hands[0]!, created_at: '2026-10-14T13:00:00Z' },
      { ...hands[1]!, created_at: '2026-10-14T13:30:00Z' },
      hands[2]!,
    ];
    expect(buildListItems(rows, timed, new Set())[0]!.lastHandAt).toBe('2026-10-14T13:30:00Z');
    expect(buildListItems(rows, hands, new Set())[0]!.lastHandAt).toBeNull();
  });
  it('a finished session has no live result', () => {
    const [first] = buildListItems(
      [{ ...rows[0]!, end_at: '2026-10-14T14:00:00Z' }],
      hands,
      new Set(),
    );
    expect(first!.live).toBeNull();
  });
  it('takes the tournament name from sessions.mtt', () => {
    const [first] = buildListItems(
      [{ ...rows[0]!, kind: 'mtt', mtt: { name: 'Sunday Million' } }],
      [],
      new Set(),
    );
    expect(first!.tournamentName).toBe('Sunday Million');
  });
});

describe('sessionNet', () => {
  it('cash: bb and money', () => {
    expect(sessionNet(item())).toEqual({ bb: 50, money: 2500, currency: 'VND' });
  });
  it('MTT: money only', () => {
    const m = item({
      s: {
        kind: 'mtt',
        buyin: 1000,
        cashout: null,
        mtt: { reentries: 0, prize: 4000, bounty: null, place: 12, entries: 180, bustStage: null },
      },
    });
    expect(sessionNet(m)).toEqual({ bb: null, money: 3000, currency: 'VND' });
  });
  it('no result yet: null; an open session shows what it has so far', () => {
    expect(sessionNet(item({ s: { cashout: null, endAt: null } }))).toBeNull();
    expect(
      sessionNet(item({ s: { cashout: null, endAt: null }, live: { bb: 5, money: 250 } })),
    ).toEqual({ bb: 5, money: 250, currency: 'VND' });
  });
});

describe('filterItems', () => {
  const win = item({ s: { id: 'w' } });
  const loss = item({ s: { id: 'l', cashout: 5000 } });
  const mttItem = item({
    s: {
      id: 'm',
      kind: 'mtt',
      venue: 'GGPoker',
      date: '2026-09-02',
      buyin: 1000,
      cashout: null,
      mtt: { reentries: 0, prize: 0, bounty: null, place: null, entries: null, bustStage: null },
    },
    tournamentName: 'Sunday Million',
  });
  const open = item({ s: { id: 'o', cashout: null, endAt: null } });
  const all = [win, loss, mttItem, open];

  it('no filter keeps everything', () => {
    expect(ids(filterItems(all, f()))).toEqual(['w', 'l', 'm', 'o']);
  });
  it('kind', () => {
    expect(ids(filterItems(all, f({ kind: 'mtt' })))).toEqual(['m']);
    expect(ids(filterItems(all, f({ kind: 'cash' })))).toEqual(['w', 'l', 'o']);
  });
  it('month and venue (venue ignores case)', () => {
    expect(ids(filterItems(all, f({ month: '2026-09' })))).toEqual(['m']);
    expect(ids(filterItems(all, f({ venue: 'ggpoker' })))).toEqual(['m']);
  });
  it('result is one choice: all keeps open sessions, win and loss drop them', () => {
    expect(ids(filterItems(all, f({ result: 'all' })))).toEqual(['w', 'l', 'm', 'o']);
    expect(ids(filterItems(all, f({ result: 'win' })))).toEqual(['w']);
    expect(ids(filterItems(all, f({ result: 'loss' })))).toEqual(['l', 'm']);
  });
  it('to review', () => {
    const r = item({ s: { id: 'r' }, toReview: 2 });
    expect(ids(filterItems([win, r], f({ toReview: true })))).toEqual(['r']);
  });
  it('search matches venue, notes and tournament name, ignoring case and accents', () => {
    const noted = item({ s: { id: 'n', venue: null }, notes: 'Bàn loose, đối thủ hay call' });
    expect(ids(filterItems([win, noted], f({ q: 'ban LOOSE' })))).toEqual(['n']);
    expect(ids(filterItems([win, noted], f({ q: 'doi thu' })))).toEqual(['n']);
    expect(ids(filterItems(all, f({ q: 'sunday' })))).toEqual(['m']);
    expect(ids(filterItems(all, f({ q: 'chill' })))).toEqual(['w', 'l', 'o']);
  });
  it('filters combine with AND', () => {
    expect(ids(filterItems(all, f({ kind: 'cash', result: 'loss' })))).toEqual(['l']);
  });
});

describe('groupByMonth', () => {
  const oct1 = item({ s: { id: 'a', date: '2026-10-14' } });
  const oct2 = item({ s: { id: 'b', date: '2026-10-03', cashout: 5000 } }); // -100 bb
  const sep = item({ s: { id: 'c', date: '2026-09-28' } });
  const open = item({ s: { id: 'o', date: '2026-10-20', cashout: null, endAt: null } });

  it('months newest first, items newest first; an open session sits in its month by date', () => {
    const g = groupByMonth([oct2, sep, open, oct1]);
    expect(g.months.map((m) => m.month)).toEqual(['2026-10', '2026-09']);
    expect(ids(g.months[0]!.items)).toEqual(['o', 'a', 'b']);
    expect(ids(g.months[1]!.items)).toEqual(['c']);
  });
  it('the same day keeps the incoming order (newest created first)', () => {
    const x = item({ s: { id: 'x', date: '2026-10-14' } });
    const y = item({ s: { id: 'y', date: '2026-10-14' } });
    expect(ids(groupByMonth([y, x]).months[0]!.items)).toEqual(['y', 'x']);
  });
  it('month net adds the cash bb', () => {
    const g = groupByMonth([oct1, oct2]);
    expect(g.months[0]!.totals.netBb).toBe(-50); // +50 - 100
    expect(g.months[0]!.totals.mttMoney).toEqual([]);
  });
});

describe('sortItems', () => {
  const a = item({ s: { id: 'a', date: '2026-10-01', venue: 'B' }, handCount: 5 });
  const b = item({ s: { id: 'b', date: '2026-10-03', venue: 'A', cashout: 5000 }, handCount: 20 });
  const c = item({ s: { id: 'c', date: '2026-10-02', venue: null, cashout: null }, handCount: 1 });

  it('by date, both directions', () => {
    expect(ids(sortItems([a, b, c], 'date', 'desc'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortItems([a, b, c], 'date', 'asc'))).toEqual(['a', 'c', 'b']);
  });
  it('by net bb; sessions without a result are always last', () => {
    expect(ids(sortItems([a, b, c], 'net', 'desc'))).toEqual(['a', 'b', 'c']);
    expect(ids(sortItems([a, b, c], 'net', 'asc'))).toEqual(['b', 'a', 'c']);
  });
  it('by venue, empty last', () => {
    expect(ids(sortItems([a, b, c], 'venue', 'asc'))).toEqual(['b', 'a', 'c']);
  });
  it('by hands', () => {
    expect(ids(sortItems([a, b, c], 'hands', 'desc'))).toEqual(['b', 'a', 'c']);
  });
  it('does not change the input', () => {
    const input = [a, b, c];
    sortItems(input, 'date', 'desc');
    expect(ids(input)).toEqual(['a', 'b', 'c']);
  });
});

describe('listOptions', () => {
  it('months newest first and venues merged ignoring case', () => {
    const o = listOptions([
      item({ s: { date: '2026-09-01', venue: 'chill' } }),
      item({ s: { date: '2026-10-05', venue: 'Chill' } }),
      item({ s: { date: '2026-10-07', venue: 'GG' } }),
      item({ s: { date: '2026-10-08', venue: null } }),
    ]);
    expect(o.months).toEqual(['2026-10', '2026-09']);
    expect(o.venues).toEqual(['chill', 'GG']);
  });
});

describe('filter in the URL', () => {
  it('round-trips and drops defaults', () => {
    const filter = f({
      kind: 'cash',
      month: '2026-10',
      venue: 'Chill',
      result: 'loss',
      toReview: true,
      q: 'abc',
    });
    const qs = serializeListFilter(filter);
    expect(qs).toBe('kind=cash&month=2026-10&venue=Chill&result=loss&review=1&q=abc');
    expect(parseListFilter(Object.fromEntries(new URLSearchParams(qs)))).toEqual(filter);
    expect(serializeListFilter(f())).toBe('');
  });
  it('ignores junk', () => {
    expect(parseListFilter({ kind: 'sng', month: 'last', win: 'yes', result: 'draw' })).toEqual(
      f(),
    );
  });
  it('reads the old win/loss keys: one of them is that result, both together mean all', () => {
    expect(parseListFilter({ win: '1' }).result).toBe('win');
    expect(parseListFilter({ loss: '1' }).result).toBe('loss');
    expect(parseListFilter({ win: '1', loss: '1' }).result).toBe('all');
    expect(parseListFilter({ win: '1', result: 'loss' }).result).toBe('loss');
  });
});

describe('staleItems', () => {
  const open = (id: string, startAt: string | null, lastHandAt: string | null = null) =>
    item({ s: { id, startAt, endAt: null }, lastHandAt });
  const now = '2026-10-21T10:00:00.000Z';

  it('lists open sessions past 16 hours with the suggested end', () => {
    const stale = staleItems(
      [
        open('old', '2026-10-20T10:00:00.000Z', '2026-10-20T15:00:00.000Z'),
        open('fresh', '2026-10-21T02:00:00.000Z'),
        open('later', null),
        item({ s: { id: 'done' } }),
      ],
      now,
    );
    expect(stale.map((x) => [x.item.session.id, x.suggestedEnd])).toEqual([
      ['old', '2026-10-20T15:15:00.000Z'],
    ]);
  });
});

describe('netTile', () => {
  const totals = (over: Partial<SessionTotals> = {}): SessionTotals => ({
    count: 2,
    hours: 0,
    netBb: 40,
    bbPerHour: null,
    rateSessions: 0,
    netMoney: [{ currency: 'VND', money: 2000 }],
    mttMoney: [],
    ...over,
  });

  it('cash: one line of bb, money under it', () => {
    expect(netTile(totals(), 'cash')).toEqual({
      lines: [{ bb: 40 }],
      sub: [{ currency: 'VND', money: 2000 }],
    });
  });
  it('all with cash only: bb, not the chips or money of the session', () => {
    const chips = totals({
      netMoney: [
        { currency: 'CHIP', money: 2000, converted: { currency: 'VND', money: 2_000_000 } },
      ],
    });
    expect(netTile(chips, 'all')).toEqual({
      lines: [{ bb: 40 }],
      sub: [{ currency: 'CHIP', money: 2000, converted: { currency: 'VND', money: 2_000_000 } }],
    });
  });
  it('all with cash and MTT: two lines, bb for cash and money for MTT', () => {
    const mixed = totals({
      netMoney: [{ currency: 'VND', money: 5000 }],
      mttMoney: [{ currency: 'VND', money: 3000 }],
    });
    expect(netTile(mixed, 'all')).toEqual({
      lines: [{ bb: 40 }, { currency: 'VND', money: 3000 }],
      sub: [{ currency: 'VND', money: 2000 }],
    });
  });
  it('all with MTT only: money lines, one per currency', () => {
    const mtt = totals({
      netBb: 0,
      netMoney: [
        { currency: 'USD', money: 5 },
        { currency: 'VND', money: -1000 },
      ],
      mttMoney: [
        { currency: 'USD', money: 5 },
        { currency: 'VND', money: -1000 },
      ],
    });
    expect(netTile(mtt, 'all')).toEqual({
      lines: [
        { currency: 'USD', money: 5 },
        { currency: 'VND', money: -1000 },
      ],
      sub: [],
    });
    expect(netTile(mtt, 'mtt').lines).toEqual([
      { currency: 'USD', money: 5 },
      { currency: 'VND', money: -1000 },
    ]);
  });
  it('a cash result of exactly zero still shows a figure', () => {
    expect(
      netTile(totals({ netBb: 0, netMoney: [{ currency: 'VND', money: 0 }] }), 'all').lines,
    ).toEqual([{ bb: 0 }]);
  });
  it('no result yet: no line', () => {
    expect(netTile(totals({ netBb: 0, netMoney: [] }), 'all')).toEqual({ lines: [], sub: [] });
    expect(netTile(totals({ netBb: 0, netMoney: [] }), 'mtt')).toEqual({ lines: [], sub: [] });
  });
});
