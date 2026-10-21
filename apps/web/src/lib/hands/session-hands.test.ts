import { describe, expect, it } from 'vitest';
import { parseShorthand } from 'poker-core';
import { emptyDraft, toHandRow, type HandSession } from './build';
import {
  buildHandRows,
  EMPTY_HAND_FILTER,
  filterHandRows,
  handOptions,
  isHandFiltering,
  parseHandFilter,
  serializeHandFilter,
  sortHandRows,
  type HandRow,
  type HandRowDb,
} from './session-hands';

const cash: HandSession = {
  kind: 'cash',
  mode: 'live',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 18000,
  seats: 9,
  mtt: null,
};

const GOLD = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';

function goldRow(over: Partial<HandRowDb> = {}): HandRowDb {
  const draft = emptyDraft(cash, null);
  draft.slots = ['Ah', 'Kd', '7c', '8d', '2s', 'Jh', '3c'];
  draft.heroPos = 'MP';
  draft.villPos = 'BTN';
  draft.outcome = 'lose';
  draft.heroStack = '18000';
  draft.villStack = '20000';
  draft.thought = 'Call quá rộng?';
  draft.flagged = true;
  draft.actions = parseShorthand(GOLD, { heroPos: 'MP', villPos: 'BTN' }).actions;
  return {
    ...toHandRow(cash, draft, 7),
    id: 'h7',
    session_id: 's1',
    created_at: '2026-10-20T15:00:00Z',
    ...over,
  } as unknown as HandRowDb;
}

describe('buildHandRows', () => {
  it('golden hand: -360bb, chips per street, showdown, pot in bb', () => {
    const [r] = buildHandRows(cash, [goldRow()], new Map());
    expect(r!.num).toBe(7);
    expect(r!.resultBb).toBe(-360);
    expect(r!.potType).toBe('single_raised');
    expect(r!.showdown).toBe(true);
    expect(r!.potBb).toBe(721.5); // 36075 / 50
    expect(r!.chips.river.map((c) => [c.act, c.amountBb])).toEqual([
      ['bet', 100],
      ['all-in', 360],
      ['call', 320],
    ]);
    expect(r!.thought).toBe('Call quá rộng?');
    expect(r!.heroPos).toBe('MP');
    expect(r!.opponents).toBe(1);
    expect(r!.eff).toEqual({ amount: 18000, bb: 360 });
    // The last step still holds the 2000 of the shove nobody could call; potBb is after it is returned.
    expect(r!.steps.at(-1)?.potAfter).toBe(38075);
  });

  it('review labels: flagged without an accepted review needs a look; AI source is shown', () => {
    const row = goldRow();
    const none = buildHandRows(cash, [row], new Map())[0]!;
    expect([none.needsReview, none.aiReviewed]).toEqual([true, false]);
    const accepted = buildHandRows(
      cash,
      [row],
      new Map([['h7', { source: 'ai', accepted: true }]]),
    )[0]!;
    expect([accepted.needsReview, accepted.aiReviewed]).toEqual([false, true]);
    const draftAi = buildHandRows(
      cash,
      [row],
      new Map([['h7', { source: 'ai', accepted: false }]]),
    )[0]!;
    expect([draftAi.needsReview, draftAi.aiReviewed]).toEqual([true, true]);
  });

  it('an unflagged hand never needs a review', () => {
    const [r] = buildHandRows(cash, [goldRow({ flagged: false })], new Map());
    expect(r!.needsReview).toBe(false);
  });

  it('MTT: result in bb of the hand level, level and stage kept', () => {
    const mtt: HandSession = { ...cash, kind: 'mtt', mtt: {} };
    const [r] = buildHandRows(
      mtt,
      [goldRow({ level_bb: 100, level: 8, stage: 'bubble', result: -18000 })],
      new Map(),
    );
    expect(r!.resultBb).toBe(-180);
    expect(r!.level).toBe(8);
    expect(r!.stage).toBe('bubble');
  });
});

const row = (over: Partial<HandRow>): HandRow => ({
  id: `h${over.num ?? 1}`,
  num: 1,
  createdAt: '2026-10-20T15:00:00Z',
  heroCards: [],
  board: [],
  heroPos: 'BTN',
  villPos: 'BB',
  opponents: 1,
  potType: 'single_raised',
  chips: { preflop: [], flop: [], turn: [], river: [] },
  result: 0,
  resultBb: 0,
  potBb: 10,
  showdown: false,
  steps: [],
  eff: null,
  flagged: false,
  accepted: false,
  needsReview: false,
  aiReviewed: false,
  missing: false,
  thought: '',
  level: null,
  stage: null,
  ...over,
});

describe('filter, sort, URL', () => {
  const rows = [
    row({ num: 1, heroPos: 'BTN', resultBb: 20, potBb: 30, showdown: true }),
    row({
      num: 2,
      heroPos: 'MP',
      resultBb: -50,
      potBb: 120,
      potType: 'three_bet',
      needsReview: true,
    }),
    row({ num: 3, heroPos: 'BTN', resultBb: null, potBb: null, stage: 'bubble' }),
    row({ num: 4, heroPos: 'CO', resultBb: -5, potBb: 8 }),
  ];
  const nums = (xs: HandRow[]) => xs.map((x) => x.num);
  const f = (over: Partial<typeof EMPTY_HAND_FILTER>) => ({ ...EMPTY_HAND_FILTER, ...over });

  it('filters combine', () => {
    expect(nums(filterHandRows(rows, f({ review: true })))).toEqual([2]);
    expect(nums(filterHandRows(rows, f({ showdown: true })))).toEqual([1]);
    expect(nums(filterHandRows(rows, f({ pos: 'BTN' })))).toEqual([1, 3]);
    expect(nums(filterHandRows(rows, f({ pot: 'three_bet' })))).toEqual([2]);
    expect(nums(filterHandRows(rows, f({ stage: 'bubble' })))).toEqual([3]);
    expect(nums(filterHandRows(rows, f({ pos: 'BTN', showdown: true })))).toEqual([1]);
  });

  it('sorts: latest, biggest wins, biggest losses, biggest pots; unknown last', () => {
    expect(nums(sortHandRows(rows, 'latest'))).toEqual([4, 3, 2, 1]);
    expect(nums(sortHandRows(rows, 'won'))).toEqual([1, 4, 2, 3]);
    expect(nums(sortHandRows(rows, 'lost'))).toEqual([2, 4, 1, 3]);
    expect(nums(sortHandRows(rows, 'pot'))).toEqual([2, 1, 4, 3]);
  });

  it('options list only what exists, positions in table order', () => {
    expect(handOptions(rows)).toEqual({ positions: ['MP', 'CO', 'BTN'], stages: ['bubble'] });
  });

  it('URL round trip; defaults and junk are dropped', () => {
    const filter = f({ review: true, pos: 'CO', pot: 'limped', sort: 'pot', showdown: true });
    const qs = serializeHandFilter(filter);
    expect(parseHandFilter(Object.fromEntries(new URLSearchParams(qs)))).toEqual(filter);
    expect(serializeHandFilter(EMPTY_HAND_FILTER)).toBe('');
    expect(parseHandFilter({ pot: 'bogus', sort: 'zzz' })).toEqual(EMPTY_HAND_FILTER);
    expect(isHandFiltering(EMPTY_HAND_FILTER)).toBe(false);
    expect(isHandFiltering(f({ sort: 'pot' }))).toBe(false);
    expect(isHandFiltering(f({ stage: 'x' }))).toBe(true);
  });
});
