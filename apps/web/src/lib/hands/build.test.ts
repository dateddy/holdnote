import { describe, expect, it } from 'vitest';
import { parseShorthand } from 'poker-core';
import {
  canSave,
  deriveHand,
  emptyDraft,
  fromHandRow,
  nextHandDefaults,
  startingStack,
  toHandRow,
  type HandSession,
} from './build';

const cash: HandSession = {
  kind: 'cash',
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

function golden() {
  const draft = emptyDraft(cash, null);
  draft.slots = ['Ah', 'Kd', '', '', '', '', ''];
  draft.heroPos = 'MP';
  draft.villPos = 'BTN';
  draft.outcome = 'lose';
  draft.heroStack = '18000';
  draft.villStack = '20000';
  draft.actions = parseShorthand(GOLD, { heroPos: 'MP', villPos: 'BTN' }).actions;
  return draft;
}

describe('deriveHand', () => {
  it('golden case: -18000 (-360bb), eff 360bb', () => {
    const d = deriveHand(cash, golden());
    expect(d.result).toBe(-18000);
    expect(d.resultBb).toBe(-360);
    expect(d.eff).toEqual({ amount: 18000, bb: 360 });
    expect(d.potFinal).toBe(36075);
    expect(d.missing).toBe(false);
  });

  it('manual result overrides the computed one', () => {
    const draft = golden();
    draft.resultText = '-17k5';
    expect(deriveHand(cash, draft).result).toBe(-17500);
  });

  it('marks missing data without outcome or stacks', () => {
    const draft = golden();
    draft.outcome = '';
    expect(deriveHand(cash, draft).missing).toBe(true);
    const noStack = golden();
    noStack.villStack = '';
    expect(deriveHand(cash, noStack).missing).toBe(true);
  });

  it('MTT uses the level bb', () => {
    const mtt: HandSession = { ...cash, kind: 'mtt', sb: 25, bb: 50, mtt: {} };
    const draft = golden();
    draft.levelBb = '100';
    const d = deriveHand(mtt, draft);
    expect(d.bb).toBe(100);
    expect(d.resultBb).toBe(-180);
  });
});

describe('canSave', () => {
  it('needs two hero cards or the flag', () => {
    const draft = emptyDraft(cash, null);
    expect(canSave(draft)).toBe(false);
    draft.slots[0] = 'Ah';
    expect(canSave(draft)).toBe(false);
    draft.slots[1] = 'Kd';
    expect(canSave(draft)).toBe(true);
    const flagged = emptyDraft(cash, null);
    flagged.flagged = true;
    expect(canSave(flagged)).toBe(true);
  });
});

describe('startingStack / nextHandDefaults', () => {
  it('first hand takes the buy-in', () => {
    expect(startingStack(cash, null)).toBe(18000);
    expect(
      startingStack({ ...cash, kind: 'mtt', buyin: 5, mtt: { start_stack: 10000 } }, null),
    ).toBe(10000);
  });

  it('next hand adds the previous result', () => {
    expect(startingStack(cash, { hero_stack: 18000, result: -5000 })).toBe(13000);
    expect(startingStack(cash, { hero_stack: null, result: -5000 })).toBeNull();
  });

  it('carries level and players dealt', () => {
    const d = nextHandDefaults(
      { ...cash, kind: 'mtt', mtt: {} },
      {
        hero_stack: 100,
        result: 10,
        level_bb: 100,
        players_dealt: 7,
      },
    );
    expect(d.levelBb).toBe('100');
    expect(d.playersDealt).toBe('7');
    expect(d.heroStack).toBe('110');
  });
});

describe('toHandRow', () => {
  it('builds the insert row', () => {
    const row = toHandRow(cash, golden(), 3);
    expect(row).toMatchObject({
      num: 3,
      hero_cards: ['Ah', 'Kd'],
      board: [],
      hero_pos: 'MP',
      villain_pos: 'BTN',
      outcome: 'lose',
      result: -18000,
      pot_final: 36075,
      hero_stack: 18000,
      villain_stack: 20000,
      eff_stack: 18000,
      level_bb: null,
      missing_data: false,
      flagged: false,
    });
    expect(Array.isArray(row.actions)).toBe(true);
  });

  it('keeps board cards in order and drops gaps', () => {
    const draft = golden();
    draft.slots = ['Ah', 'Kd', '8s', 'Qh', 'Jh', '2c', ''];
    expect(toHandRow(cash, draft, 1).board).toEqual(['8s', 'Qh', 'Jh', '2c']);
  });
});

describe('fromHandRow', () => {
  it('round trips the golden hand through a saved row', () => {
    const draft = golden();
    const row = toHandRow(cash, draft, 1);
    const back = fromHandRow(cash, row as never);
    expect(back.slots.slice(0, 2)).toEqual(['Ah', 'Kd']);
    expect(back.heroPos).toBe('MP');
    expect(back.outcome).toBe('lose');
    expect(back.heroStack).toBe('18000');
    expect(back.resultText).toBe('');
    expect(deriveHand(cash, back).result).toBe(-18000);
    expect(back.actions.length).toBe(draft.actions.length);
  });

  it('keeps a manual result as an override', () => {
    const row = { ...toHandRow(cash, golden(), 1), result: -17500 };
    expect(fromHandRow(cash, row as never).resultText).toBe('-17500');
  });

  it('drops malformed actions', () => {
    const row = { ...toHandRow(cash, golden(), 1), actions: [{ foo: 1 }, null] };
    expect(fromHandRow(cash, row as never).actions).toEqual([]);
  });
});
