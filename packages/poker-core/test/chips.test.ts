import { describe, expect, it } from 'vitest';
import { actionChips, wentToShowdown, type Action, type HandInput } from '../src/index';
import { BLINDS_25_50, hand } from './helpers';

const GOLD = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';
const gold = (): HandInput =>
  hand(GOLD, { heroPos: 'MP', villPos: 'BTN', heroStack: 18000, villStack: 20000 });

describe('actionChips', () => {
  it('golden hand: chips per street, sizes in bb from the resolved amounts', () => {
    const r = actionChips(gold(), 50);
    expect(r.potType).toBe('single_raised');
    const view = (s: keyof typeof r.streets) =>
      r.streets[s].map((c) => [c.actor, c.pos, c.act, c.amountBb]);
    expect(view('preflop')).toEqual([
      ['hero', 'MP', 'call', 1],
      ['villain', 'BTN', 'raise', 10],
      ['hero', 'MP', 'call', 10],
    ]);
    expect(view('flop')).toEqual([
      ['hero', 'MP', 'check', undefined],
      ['villain', 'BTN', 'bet', 10],
      ['hero', 'MP', 'call', 10],
    ]);
    expect(view('river')).toEqual([
      ['hero', 'MP', 'bet', 100],
      ['villain', 'BTN', 'all-in', 360],
      ['hero', 'MP', 'call', 320],
    ]);
  });

  it('keeps the index in the full actions array', () => {
    const r = actionChips(gold(), 50);
    const all = Object.values(r.streets).flat();
    expect(all.map((c) => c.index)).toEqual([...all.map((c) => c.index)].sort((a, b) => a - b));
    expect(r.streets.preflop[0]?.index).toBe(0);
  });

  it('forced bets and dead money are not chips; a fold has no size', () => {
    const actions: Action[] = [
      { street: 'preflop', actor: 'other', pos: 'SB', act: 'post_sb', amount: 25 },
      { street: 'preflop', actor: 'other', pos: 'BB', act: 'post_bb', amount: 50 },
      { street: 'preflop', actor: 'other', act: 'dead', amount: 100 },
      { street: 'preflop', actor: 'villain', pos: 'BTN', act: 'raise', amount: 150 },
      { street: 'preflop', actor: 'hero', pos: 'MP', act: 'fold' },
    ];
    const r = actionChips({ blinds: BLINDS_25_50, heroPos: 'MP', villPos: 'BTN', actions }, 50);
    expect(r.streets.preflop.map((c) => [c.act, c.amountBb])).toEqual([
      ['raise', 3],
      ['fold', undefined],
    ]);
    expect(r.streets.preflop[0]?.index).toBe(3);
  });

  it('a player without a known position keeps the label', () => {
    const actions: Action[] = [
      { street: 'preflop', actor: 'other', who: 'V2', act: 'raise', amount: 150 },
      { street: 'preflop', actor: 'hero', pos: 'MP', act: 'call' },
    ];
    const r = actionChips({ blinds: BLINDS_25_50, heroPos: 'MP', actions }, 50);
    expect(r.streets.preflop[0]).toMatchObject({ actor: 'other', who: 'V2', act: 'raise' });
  });

  it('streets without actions are empty; the bb comes from the caller (MTT level)', () => {
    const r = actionChips(hand('V o500 H f', { heroPos: 'MP', villPos: 'BTN' }), 1000);
    expect(r.streets.flop).toEqual([]);
    expect(r.streets.preflop[0]?.amountBb).toBe(0.5);
  });
});

describe('wentToShowdown', () => {
  it('all-in and call: yes', () => {
    expect(wentToShowdown(gold())).toBe(true);
  });
  it('everyone folded to a bet: no', () => {
    expect(wentToShowdown(hand('V o500 H f', { heroPos: 'MP', villPos: 'BTN' }))).toBe(false);
    expect(
      wentToShowdown(hand('V o500 H c / H x V b500 H f', { heroPos: 'MP', villPos: 'BTN' })),
    ).toBe(false);
  });
  it('check-check on the river: yes', () => {
    expect(
      wentToShowdown(
        hand('V o500 H c / H x V x / H x V x / H x V x', { heroPos: 'MP', villPos: 'BTN' }),
      ),
    ).toBe(true);
  });
  it('multiway: one fold on the river is still a showdown for the other two', () => {
    const actions: Action[] = [
      { street: 'river', actor: 'hero', pos: 'MP', act: 'bet', amount: 100 },
      { street: 'river', actor: 'villain', pos: 'BTN', act: 'call' },
      { street: 'river', actor: 'other', pos: 'CO', act: 'fold' },
    ];
    expect(wentToShowdown({ blinds: BLINDS_25_50, heroPos: 'MP', villPos: 'BTN', actions })).toBe(
      true,
    );
  });
});
