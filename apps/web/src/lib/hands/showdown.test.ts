import { describe, expect, it } from 'vitest';
import { act, forcedBets, parseShorthand, type ActInput } from 'poker-core';
import {
  deriveHand,
  emptyDraft,
  fromHandRow,
  toHandRow,
  type HandDraft,
  type HandSession,
} from './build';
import { boardInput, draftToSetup } from './setup';

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

/** The golden hand to the river, hero holding AK on a dry board. */
function headsUp(villain: [string, string], outcome = ''): HandDraft {
  const d = emptyDraft(cash, null);
  d.slots = ['Ah', 'Kd', '7c', '8d', '2s', 'Jh', '3c'];
  d.heroPos = 'MP';
  d.villPos = 'BTN';
  d.heroStack = '18000';
  d.villStack = '20000';
  d.opponents = [{ pos: 'BTN', stack: '20000', opponentId: '', cards: villain }];
  d.outcome = outcome;
  d.actions = parseShorthand(GOLD, { heroPos: 'MP', villPos: 'BTN' }).actions;
  return d;
}

/** BTN (hero, 1000) shoves, SB (3000) and BB (5000) call: pots of 3000 and 4000 (BB's extra 2000 comes back). */
function threeWay(): HandDraft {
  const d = emptyDraft(cash, null);
  d.playersDealt = '3';
  d.heroPos = 'BTN';
  d.heroStack = '1000';
  d.slots = ['Ah', 'Ad', 'Qs', '7d', '5h', '2s', '9c'];
  d.opponents = [
    { pos: 'SB', stack: '3000', opponentId: '', cards: ['Kh', 'Kd'] },
    { pos: 'BB', stack: '5000', opponentId: '', cards: ['Tc', '3c'] },
  ];
  d.villPos = 'SB';
  d.villStack = '3000';
  const setup = draftToSetup(cash, d, 50);
  if (!setup) throw new Error('setup');
  let full = forcedBets(setup);
  const play = (input: ActInput) => {
    const r = act(setup, full, input, boardInput(d));
    expect(r.accepted).toBe(true);
    full = r.actions;
  };
  play({ act: 'all-in' });
  play({ act: 'all-in' });
  play({ act: 'all-in' });
  d.actions = full.filter((a) => !a.act.startsWith('post_'));
  return d;
}

describe('deriveHand showdown (5.1c-6b)', () => {
  it('picks the winner from the cards and names the hands', () => {
    const d = deriveHand(cash, headsUp(['9d', '9s']));
    expect(d.showdown?.pots[0]?.by).toBe('cards');
    expect(d.showdown?.mismatch).toBe(false);
    expect(d.result).toBe(-18000);
    expect(d.outcome).toBe('lose');
  });

  it('hero wins with the better hand', () => {
    const d = deriveHand(cash, headsUp(['5d', '4s']));
    expect(d.result).toBeGreaterThan(0);
    expect(d.outcome).toBe('win');
  });

  it('a pick against the cards still prices the hand but flags a mismatch', () => {
    const draft = headsUp(['9d', '9s']);
    draft.potWinners = [['MP']];
    const d = deriveHand(cash, draft);
    expect(d.showdown?.mismatch).toBe(true);
    expect(d.result).toBeGreaterThan(0);
  });

  it('without cards the typed outcome decides, like hands saved before', () => {
    const d = deriveHand(cash, headsUp(['', ''], 'lose'));
    expect(d.showdown?.by).toBeUndefined();
    expect(d.result).toBe(-18000);
    expect(deriveHand(cash, headsUp(['', ''])).result).toBeNull();
  });

  it('three players: two pots, each won by its own cards', () => {
    const d = deriveHand(cash, threeWay());
    expect(d.showdown?.pots.map((p) => [p.amount, p.winners])).toEqual([
      [3000, ['BTN']],
      [4000, ['SB']],
    ]);
    expect(d.result).toBe(2000);
  });

  it('three players with the cards missing ask for a winner per pot', () => {
    const draft = threeWay();
    draft.opponents = draft.opponents.map((o) => ({ ...o, cards: [] }));
    expect(deriveHand(cash, draft).showdown?.needsChoice).toBe(true);
    draft.potWinners = [['BTN'], ['SB']];
    const d = deriveHand(cash, draft);
    expect(d.showdown?.needsChoice).toBe(false);
    expect(d.result).toBe(2000);
  });

  it('a split pot divides the chips', () => {
    const draft = threeWay();
    draft.opponents = draft.opponents.map((o) => ({ ...o, cards: [] }));
    draft.potWinners = [['BTN', 'SB'], ['SB']];
    expect(deriveHand(cash, draft).result).toBe(500);
    expect(deriveHand(cash, draft).outcome).toBe('split');
  });

  it('keeps the opponent cards and pot winners through the row', () => {
    const draft = threeWay();
    draft.potWinners = [null, ['SB'], ['BB']];
    const row = toHandRow(cash, draft, 1);
    expect(row.pot_winners).toEqual([null, ['SB'], ['BB']]);
    expect(row.opponents).toEqual([
      { pos: 'SB', stack: 3000, cards: ['Kh', 'Kd'] },
      { pos: 'BB', stack: 5000, cards: ['Tc', '3c'] },
    ]);
    const back = fromHandRow(cash, { ...row, villain_cards: row.villain_cards } as never);
    expect(back.potWinners).toEqual([null, ['SB'], ['BB']]);
    expect(back.opponents[1]?.cards).toEqual(['Tc', '3c']);
  });
});
