import { describe, expect, it } from 'vitest';
import { filterHands, handBbOf, HAND_FILTERS, summarize, type ListHand } from './list';

const base: ListHand = {
  id: 'a',
  num: 1,
  hero_cards: ['Ah', 'Kd'],
  board: [],
  hero_pos: 'BTN',
  villain_pos: 'BB',
  eff_stack: 5000,
  result: -1000,
  level_bb: null,
  flagged: false,
  missing_data: false,
  reviewed: false,
};

const hands: ListHand[] = [
  base,
  { ...base, id: 'b', num: 2, flagged: true, result: 500, reviewed: true },
  { ...base, id: 'c', num: 3, missing_data: true, result: null, eff_stack: null },
];

describe('filterHands', () => {
  it('has the five filters of spec 3.6', () => {
    expect(HAND_FILTERS).toEqual(['all', 'flagged', 'missing', 'unreviewed', 'reviewed']);
  });

  it('filters', () => {
    const ids = (f: Parameters<typeof filterHands>[1]) => filterHands(hands, f).map((h) => h.id);
    expect(ids('all')).toEqual(['a', 'b', 'c']);
    expect(ids('flagged')).toEqual(['b']);
    expect(ids('missing')).toEqual(['c']);
    expect(ids('unreviewed')).toEqual(['a', 'c']);
    expect(ids('reviewed')).toEqual(['b']);
  });
});

describe('handBbOf', () => {
  it('uses level_bb for MTT hands, session bb otherwise', () => {
    expect(handBbOf({ ...base, level_bb: 100 }, 50)).toBe(100);
    expect(handBbOf(base, 50)).toBe(50);
    expect(handBbOf(base, null)).toBeNull();
  });
});

describe('summarize', () => {
  it('counts hands and sums results in bb', () => {
    // -1000/50 = -20 and 500/50 = 10; the hand without a result adds nothing.
    expect(summarize(hands, 50)).toEqual({ count: 3, totalBb: -10, missing: 1, reviewed: 1 });
  });

  it('adds per-hand bb for MTT levels', () => {
    const mtt = [
      { ...base, result: -200, level_bb: 100 },
      { ...base, id: 'z', result: 300, level_bb: 200 },
    ];
    expect(summarize(mtt, 50).totalBb).toBe(-0.5);
  });
});
