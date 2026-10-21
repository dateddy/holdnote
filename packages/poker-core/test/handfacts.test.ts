import { describe, expect, it } from 'vitest';
import { computePot, playersByStreet, potType, type Action, type HandInput } from '../src/index';
import { play, setup, BLINDS_25_50 } from './helpers';

const input = (actions: Action[], over: Partial<HandInput> = {}): HandInput => ({
  blinds: BLINDS_25_50,
  heroPos: 'MP',
  villPos: 'BTN',
  actions,
  ...over,
});
const pre = (actor: Action['actor'], pos: Action['pos'], act: Action['act'], amount?: number) =>
  ({ street: 'preflop', actor, pos, act, ...(amount !== undefined && { amount }) }) as Action;

describe('potType', () => {
  const type = (actions: Action[]) => potType(computePot(input(actions)).steps);
  it('limped: nobody raised', () => {
    expect(type([pre('hero', 'MP', 'call', 50), pre('villain', 'BTN', 'call', 50)])).toBe('limped');
  });
  it('single raised', () => {
    expect(type([pre('villain', 'BTN', 'raise', 150), pre('hero', 'MP', 'call')])).toBe(
      'single_raised',
    );
  });
  it('3-bet and 4-bet+', () => {
    const open = pre('hero', 'MP', 'raise', 150);
    const three = pre('villain', 'BTN', 'raise', 450);
    expect(type([open, three, pre('hero', 'MP', 'call')])).toBe('three_bet');
    expect(
      type([open, three, pre('hero', 'MP', 'raise', 1000), pre('villain', 'BTN', 'call')]),
    ).toBe('four_bet_plus');
  });
  it('an all-in over the open counts as a raise', () => {
    expect(type([pre('villain', 'BTN', 'raise', 150), pre('hero', 'MP', 'all-in', 900)])).toBe(
      'three_bet',
    );
  });
  it('an all-in without a known amount counts as a raise (saved hand #1: H r500 V ai)', () => {
    expect(type([pre('hero', 'UTG+1', 'raise', 500), pre('villain', 'MP', 'all-in')])).toBe(
      'three_bet',
    );
  });
  it('an all-in below the current level is a call, not a raise', () => {
    expect(type([pre('villain', 'BTN', 'raise', 300), pre('hero', 'MP', 'all-in', 200)])).toBe(
      'single_raised',
    );
  });
  it('a raise over limpers is an iso pot; a 3-bet over it is a 3-bet pot', () => {
    const limp = pre('villain', 'UTG', 'call', 50);
    const iso = pre('hero', 'MP', 'raise', 200);
    expect(type([limp, iso, pre('villain', 'UTG', 'call')])).toBe('iso');
    expect(type([limp, iso, pre('villain', 'BTN', 'raise', 600), pre('hero', 'MP', 'call')])).toBe(
      'three_bet',
    );
  });
  it('a raise with no limper stays single raised', () => {
    expect(type([pre('hero', 'MP', 'raise', 150), pre('villain', 'BTN', 'call')])).toBe(
      'single_raised',
    );
  });
  it('ignores postflop betting', () => {
    const flop = { street: 'flop', actor: 'hero', pos: 'MP', act: 'bet', amount: 100 } as Action;
    expect(type([pre('hero', 'MP', 'call', 50), pre('villain', 'BTN', 'call', 50), flop])).toBe(
      'limped',
    );
  });
});

describe('uncalled bet per street', () => {
  it('is returned to the bettor and reported', () => {
    const flop = { street: 'flop', actor: 'hero', pos: 'MP', act: 'bet', amount: 300 } as Action;
    const fold = { street: 'flop', actor: 'villain', pos: 'BTN', act: 'fold' } as Action;
    const r = computePot(
      input([pre('villain', 'BTN', 'raise', 150), pre('hero', 'MP', 'call'), flop, fold]),
    );
    expect(r.streets.find((s) => s.street === 'preflop')?.uncalled).toBeUndefined();
    expect(r.streets.find((s) => s.street === 'flop')?.uncalled).toEqual({
      key: 'hero',
      amount: 300,
    });
  });
  it('is the part of an all-in nobody could call', () => {
    const r = computePot(
      input([pre('hero', 'MP', 'all-in', 1000), pre('villain', 'BTN', 'call')], {
        heroStack: 1000,
        villStack: 600,
      }),
    );
    expect(r.streets[0]?.uncalled).toEqual({ key: 'hero', amount: 400 });
    expect(r.pot).toBe(1275); // 600 + 600 + SB + BB
  });
});

describe('playersByStreet', () => {
  it('counts who is still in at the start of each postflop street', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB', tracked: ['SB'], listedOnly: true });
    const r = play(s, [
      { act: 'open', to: 150 },
      { act: 'call' },
      { act: 'call' },
      { act: 'check' },
      { act: 'check' },
      { act: 'bet', to: 100 },
      { act: 'fold' },
      { act: 'call' },
      { act: 'check' },
      { act: 'check' },
    ]);
    const streets = playersByStreet(s, r.actions);
    expect(streets.map((x) => [x.street, x.players.length])).toEqual([
      ['flop', 3],
      ['turn', 2],
    ]);
    expect(streets[1]?.players).toEqual(['BB', 'BTN']);
  });
  it('is empty when the hand ends preflop', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB', tracked: ['SB'], listedOnly: true });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'fold' }, { act: 'fold' }]);
    expect(playersByStreet(s, r.actions)).toEqual([]);
  });
});
