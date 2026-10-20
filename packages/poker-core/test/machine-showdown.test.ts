import { describe, expect, it } from 'vitest';
import {
  computePot,
  parseCards,
  parseShorthand,
  primaryOpponent,
  replay,
  showdown,
  type Action,
  type Card,
} from '../src/index';
import { play, setup } from './helpers';

const BOARD = { cards: parseCards('2c 7d 9h Js 3c') };
const cards = (s: string) => parseCards(s) as Card[];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** BTN 1000, SB 3000, BB 5000: BTN and SB all-in, BB calls 3000. Pots 3000 + 4000. */
function threeWay() {
  const s = setup({
    heroPos: 'BTN',
    villPos: 'SB',
    tracked: ['BB'],
    listedOnly: true,
    stacks: { BTN: 1000, SB: 3000, BB: 5000 },
  });
  const r = play(s, [{ act: 'all-in' }, { act: 'all-in' }, { act: 'call' }], BOARD);
  return { s, r };
}

describe('showdown: side pots with cards', () => {
  it('the shortest stack wins the main pot, the side pot goes to the next best hand', () => {
    const { s, r } = threeWay();
    expect(r.state.phase).toEqual({ kind: 'showdown' });
    const res = showdown(s, r.actions, BOARD, {
      hole: { BTN: cards('Ah Ad'), SB: cards('Kh Kd'), BB: cards('Qh Qd') },
    });
    expect(res?.pots.map((p) => [p.amount, p.eligible, p.winners, p.by])).toEqual([
      [3000, ['BTN', 'SB', 'BB'], ['BTN'], 'cards'],
      [4000, ['SB', 'BB'], ['SB'], 'cards'],
    ]);
    expect(res?.heroResult).toBe(2000); // 3000 - 1000
    expect(res?.needsChoice).toBe(false);
  });

  it('the best hand wins every pot it is in', () => {
    const { s, r } = threeWay();
    const res = showdown(s, r.actions, BOARD, {
      hole: { BTN: cards('Qh Qd'), SB: cards('Kh Kd'), BB: cards('Ah Ad') },
    });
    expect(res?.pots.map((p) => p.winners)).toEqual([['BB'], ['BB']]);
    expect(res?.heroResult).toBe(-1000);
  });

  it('a split in the side pot only', () => {
    const { s, r } = threeWay();
    const res = showdown(s, r.actions, BOARD, {
      hole: { BTN: cards('Ah Ad'), SB: cards('Kh Kd'), BB: cards('Ks Kc') },
    });
    expect(res?.pots.map((p) => p.winners)).toEqual([['BTN'], ['SB', 'BB']]);
    expect(res?.payouts).toEqual({ BTN: 3000, SB: 2000, BB: 2000 });
  });

  it('the uncalled part of the biggest all-in goes back, it is no pot', () => {
    const s = setup({
      heroPos: 'BTN',
      villPos: 'SB',
      tracked: ['BB'],
      listedOnly: true,
      stacks: { BTN: 1000, SB: 3000, BB: 5000 },
    });
    // BB shoves 5000 over a 3000 all-in: 2000 comes back.
    const r = play(s, [{ act: 'all-in' }, { act: 'all-in' }, { act: 'all-in' }], BOARD);
    const res = showdown(s, r.actions, BOARD, {
      hole: { BTN: cards('Ah Ad'), SB: cards('Kh Kd'), BB: cards('Qh Qd') },
    });
    expect(sum(res?.pots.map((p) => p.amount) ?? [])).toBe(7000);
    expect(res?.pots).toHaveLength(2);
    expect(replay(s, r.actions, BOARD).pot).toBe(7000);
  });
});

describe('showdown: missing cards need a choice per pot', () => {
  it('no villain cards: needsChoice, then the choices decide each pot', () => {
    const { s, r } = threeWay();
    const hole = { BTN: cards('Ah Ad') };
    const open = showdown(s, r.actions, BOARD, { hole });
    expect(open?.needsChoice).toBe(true);
    expect(open?.heroResult).toBeNull();
    expect(open?.pots.map((p) => p.winners)).toEqual([null, null]);

    const picked = showdown(s, r.actions, BOARD, { hole, choices: [['BTN'], ['BB']] });
    expect(picked?.needsChoice).toBe(false);
    expect(picked?.pots.map((p) => p.by)).toEqual(['choice', 'choice']);
    expect(picked?.heroResult).toBe(2000);
  });

  it('a choice that disagrees with the cards is flagged', () => {
    const { s, r } = threeWay();
    const res = showdown(s, r.actions, BOARD, {
      hole: { BTN: cards('Ah Ad'), SB: cards('Kh Kd'), BB: cards('Qh Qd') },
      choices: [['SB'], null],
    });
    expect(res?.mismatch).toBe(true);
    expect(res?.pots[0]?.byCards).toEqual(['BTN']);
    expect(res?.pots[0]?.winners).toEqual(['SB']);
  });

  it('an incomplete board cannot be evaluated', () => {
    const { s } = threeWay();
    const half = { cards: parseCards('2c 7d 9h') };
    const r = play(s, [{ act: 'all-in' }, { act: 'all-in' }, { act: 'call' }], half);
    const res = showdown(s, r.actions, half, {
      hole: { BTN: cards('Ah Ad'), SB: cards('Kh Kd'), BB: cards('Qh Qd') },
    });
    expect(res?.needsChoice).toBe(true);
  });
});

describe('showdown: hands that end without cards', () => {
  it('everyone folds to hero: the matched blinds are hers, one pot', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'CO', listedOnly: true });
    const r = play(s, [{ seat: 'CO', act: 'fold' }]);
    expect(r.state.phase.kind).toBe('won');
    const res = showdown(s, r.actions, { cards: [] }, { hole: {} });
    expect(res?.pots).toHaveLength(1);
    expect(res?.pots[0]?.by).toBe('fold');
    // SB's 25 and the matched 25 of the BB; the rest of the BB comes back to the BB.
    expect(res?.heroResult).toBe(50);
  });

  it('hero folds: the result is minus what she put in', () => {
    const s = setup({ heroPos: 'SB', villPos: 'BB', listedOnly: true });
    const r = play(s, [{ act: 'fold' }]);
    const res = showdown(s, r.actions, { cards: [] }, { hole: {} });
    expect(res?.heroResult).toBe(-25);
  });

  it('heads-up bet nobody calls: the excess is not in the pot', () => {
    const s = setup({ seats: 2, heroPos: 'BTN', villPos: 'BB', listedOnly: true });
    const r = play(s, [
      { act: 'open', to: 100 },
      { act: 'call' },
      { act: 'check' },
      { act: 'bet', to: 500 },
      { act: 'fold' },
    ]);
    expect(replay(s, r.actions).pot).toBe(200);
    const res = showdown(s, r.actions, { cards: [] }, { hole: {} });
    expect(res?.heroResult).toBe(100);
  });

  it('the hand is not over yet: no result', () => {
    const s = setup();
    expect(showdown(s, replay(s, []).actions, { cards: [] }, { hole: {} })).toBeNull();
  });
});

describe('showdown: golden hand and cross-checks', () => {
  it('golden hand: -18000 when the villain wins', () => {
    const s = setup({ stacks: { MP: 18000, BTN: 20000 } });
    const line = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';
    const { actions } = parseShorthand(line, { heroPos: 'MP', villPos: 'BTN' });
    const board = { cards: parseCards('Qh 7d 2c 9s 3h') };
    const res = showdown(s, actions, board, { hole: {}, choices: [['BTN']] });
    expect(res?.heroResult).toBe(-18000);
    expect(res?.pots).toHaveLength(1);
    expect(res?.pots[0]?.amount).toBe(36075);
  });

  it('agrees with computePot on the total', () => {
    const { s, r } = threeWay();
    const res = showdown(s, r.actions, BOARD, { hole: {} });
    const pot = computePot({
      blinds: { sb: 25, bb: 50, ante: { mode: 'none' } },
      actions: r.actions as Action[],
      heroPos: 'BTN',
      villPos: 'SB',
      seatStacks: s.stacks ?? {},
    });
    expect(sum(res?.pots.map((p) => p.amount) ?? [])).toBe(pot.pot);
  });
});

describe('primaryOpponent: the one who acted last and has not folded', () => {
  const s = setup({ heroPos: 'MP', villPos: 'BTN', tracked: ['CO'], listedOnly: true });

  it('showdown: the opponent still in', () => {
    const r = play(s, [{ act: 'open', to: 150 }, { seat: 'CO', act: 'call' }, { act: 'fold' }]);
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('CO');
  });

  it('both still in: the later actor, whatever the pick order', () => {
    const r = play(s, [{ act: 'open', to: 150 }, { seat: 'CO', act: 'call' }, { act: 'call' }]);
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('BTN');
    expect(primaryOpponent(r.state, ['CO', 'BTN'])).toBe('BTN');
  });

  it('A bets, hero calls, B folds last: A is the opponent', () => {
    const r = play(s, [
      { act: 'open', to: 150 },
      { seat: 'CO', act: 'raise', to: 450 },
      { act: 'fold' }, // BTN folds after A
      { seat: 'MP', act: 'call' },
    ]);
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('CO');
  });

  it('everyone folded: the one who folded last', () => {
    const r = play(s, [{ act: 'open', to: 150 }, { seat: 'CO', act: 'fold' }, { act: 'fold' }]);
    expect(primaryOpponent(r.state, ['CO', 'BTN'])).toBe('BTN');
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('BTN');
  });

  it('nobody has acted: the first picked', () => {
    expect(primaryOpponent(replay(s, []), ['BTN', 'CO'])).toBe('BTN');
    expect(primaryOpponent(replay(s, []), [])).toBeNull();
  });
});
