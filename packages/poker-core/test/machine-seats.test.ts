import { describe, expect, it } from 'vitest';
import {
  act,
  forcedBets,
  legacySeat,
  maxStraddles,
  primaryOpponent,
  remapSeats,
  replay,
  tableOrder,
  type Action,
  type HandSetup,
} from '../src/index';
import { play, setup, toAct } from './helpers';

const FIRST = (n: number) => tableOrder(n)[0];

describe('position names by table size (5.1c-5)', () => {
  it('drops the early seats first; BTN, SB, BB always stay', () => {
    expect(tableOrder(10)).toEqual([
      'UTG',
      'UTG+1',
      'UTG+2',
      'MP',
      'LJ',
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
    expect(tableOrder(9)).toEqual(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(8)).toEqual(['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(7)).toEqual(['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(6)).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(5)).toEqual(['HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(4)).toEqual(['CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(3)).toEqual(['BTN', 'SB', 'BB']);
    expect(tableOrder(2)).toEqual(['BTN', 'BB']);
  });
});

describe('straddle limit min(3, N-3)', () => {
  it.each([
    [2, 0],
    [3, 0],
    [4, 1],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 3],
  ])('N=%i allows %i', (n, max) => {
    expect(maxStraddles(n)).toBe(max);
  });

  it('never reaches BTN, SB or BB and starts left of the BB', () => {
    for (const n of [4, 6, 10]) {
      const posts = forcedBets(
        setup({ seats: n, straddles: [100, 200, 400, 800], heroPos: 'BB', villPos: 'SB' }),
      ).filter((a) => a.act === 'post_straddle');
      expect(posts.map((a) => a.pos)).toEqual(tableOrder(n).slice(0, maxStraddles(n)));
      expect(posts.some((a) => ['BTN', 'SB', 'BB'].includes(a.pos ?? ''))).toBe(false);
    }
  });

  it('preflop order after the straddle: the straddler acts last (N=4, 6, 10)', () => {
    for (const n of [4, 6, 10]) {
      const order = tableOrder(n);
      const s = setup({
        seats: n,
        straddles: [100],
        heroPos: 'BB',
        villPos: order[0] as never,
        tracked: order.slice(1) as never,
      });
      const seen: string[] = [];
      let actions: Action[] = [];
      for (let i = 0; i < order.length; i++) {
        seen.push(toAct(replay(s, actions)) ?? '?');
        const r = act(s, actions, {
          act: i === 0 ? 'call' : i === order.length - 1 ? 'check' : 'call',
        });
        actions = r.actions;
      }
      expect(seen).toEqual([...order.slice(1), order[0]]);
    }
  });
});

describe('heads-up (N=2)', () => {
  const s = setup({ seats: 2, heroPos: 'BTN', villPos: 'BB' });

  it('BTN posts the small blind', () => {
    const posts = forcedBets(s);
    expect(posts.map((a) => [a.act, a.pos, a.amount])).toEqual([
      ['post_sb', 'BTN', 25],
      ['post_bb', 'BB', 50],
    ]);
  });

  it('BTN acts first preflop, BB has the option after a limp', () => {
    expect(toAct(replay(s, []))).toBe('BTN');
    const r = play(s, [{ act: 'call' }]);
    expect(toAct(r.state)).toBe('BB');
    expect(r.state.buttons).toContain('check');
  });

  it('BB acts first postflop and BTN last', () => {
    const r = play(s, [{ act: 'call' }, { act: 'check' }]);
    expect(r.state.phase).toMatchObject({ kind: 'act', street: 'flop', toAct: 'BB' });
    const flop = play(s, [{ act: 'call' }, { act: 'check' }, { act: 'check' }]);
    expect(toAct(flop.state)).toBe('BTN');
  });

  it('the old name SB still means the button', () => {
    const old = setup({ seats: 2, heroPos: 'SB', villPos: 'BB' });
    expect(toAct(replay(old, []))).toBe('BTN');
  });
});

describe('N=3, 6, 9, 10 acting order', () => {
  it.each([3, 6, 9, 10])('N=%i: first to act is %s of the table order, BB last', (n) => {
    const order = tableOrder(n);
    const s = setup({
      seats: n,
      heroPos: 'BB',
      villPos: 'SB',
      tracked: order.slice(0, -2) as never,
    });
    expect(toAct(replay(s, []))).toBe(FIRST(n));
    const seen: string[] = [];
    let actions: Action[] = [];
    for (let i = 0; i < order.length; i++) {
      seen.push(toAct(replay(s, actions)) ?? '?');
      actions = act(s, actions, { act: i === order.length - 1 ? 'check' : 'call' }).actions;
    }
    expect(seen).toEqual(order);
  });

  it('postflop starts at SB and ends at the button', () => {
    const order = tableOrder(6);
    const s = setup({
      seats: 6,
      heroPos: 'BB',
      villPos: 'SB',
      tracked: order.slice(0, -2) as never,
    });
    let actions: Action[] = [];
    for (let i = 0; i < order.length; i++) {
      actions = act(s, actions, { act: i === order.length - 1 ? 'check' : 'call' }).actions;
    }
    const seen: string[] = [];
    for (let i = 0; i < order.length; i++) {
      seen.push(toAct(replay(s, actions)) ?? '?');
      actions = act(s, actions, { act: 'check' }).actions;
    }
    expect(seen).toEqual(['SB', 'BB', 'LJ', 'HJ', 'CO', 'BTN']);
  });
});

describe('legacySeat: old names read on the new table', () => {
  it.each([
    [5, 'UTG', 'HJ'],
    [6, 'UTG', 'LJ'],
    [6, 'MP', 'HJ'],
    [7, 'MP', 'LJ'],
    [8, 'MP', 'LJ'],
    [2, 'SB', 'BTN'],
    [6, 'CO', 'CO'],
    [9, 'MP', 'MP'],
    [10, 'UTG+2', 'UTG+2'],
  ])('N=%i %s -> %s', (n, from, to) => {
    expect(legacySeat(n, from)).toBe(to);
  });

  it('leaves unknown text alone', () => {
    expect(legacySeat(6, '')).toBe('');
    expect(legacySeat(6, 'xyz')).toBe('xyz');
  });
});

describe('remapSeats: keep what still exists, drop the rest', () => {
  it('9 -> 8 drops MP', () => {
    expect(remapSeats(8, ['MP', 'CO'])).toEqual({ kept: ['CO'], dropped: ['MP'] });
  });
  it('6 -> 9 keeps everything', () => {
    expect(remapSeats(9, ['LJ', 'BTN'])).toEqual({ kept: ['LJ', 'BTN'], dropped: [] });
  });
  it('3 -> 2 drops SB', () => {
    expect(remapSeats(2, ['BTN', 'SB', 'BB'])).toEqual({ kept: ['BTN', 'BB'], dropped: ['SB'] });
  });
});

describe('listedOnly: only the chosen seats are followed', () => {
  const base: Partial<HandSetup> = {
    listedOnly: true,
    heroPos: 'MP',
    villPos: 'BTN',
    tracked: ['CO'],
  };

  it('a deselected seat turns its action and everything after red, nothing is deleted', () => {
    const full = setup({ ...base });
    const r = play(full, [{ act: 'open', to: 150 }, { seat: 'CO', act: 'call' }, { act: 'call' }]);
    expect(r.state.invalid).toEqual([]);

    const dropped = replay(setup({ listedOnly: true, heroPos: 'MP', villPos: 'BTN' }), r.actions);
    const first = r.actions.findIndex((a) => a.pos === 'CO');
    expect(dropped.invalid).toEqual(r.actions.map((_, i) => i).filter((i) => i >= first));
    expect(dropped.actions).toHaveLength(r.actions.length);
    expect(dropped.warnings.map((w) => w.code)).toContain('not_in_hand');

    const back = replay(setup({ ...base }), r.actions);
    expect(back.invalid).toEqual([]);
  });

  it('changing hero seat marks the old hero actions invalid', () => {
    const s = setup({ listedOnly: true, heroPos: 'MP', villPos: 'BTN' });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'call' }]);
    const moved = replay(setup({ listedOnly: true, heroPos: 'LJ', villPos: 'BTN' }), r.actions);
    expect(moved.invalid.length).toBeGreaterThan(0);
    expect(moved.invalid).toContain(r.actions.findIndex((a) => a.pos === 'MP'));
  });

  it('a seat that is gone after lowering N turns its action red', () => {
    const s = setup({ listedOnly: true, heroPos: 'MP', villPos: 'BTN' });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'call' }]);
    const eight = replay(
      setup({ seats: 8, listedOnly: true, heroPos: 'CO', villPos: 'BTN' }),
      r.actions.filter((a) => !['post_sb', 'post_bb'].includes(a.act)),
    );
    expect(eight.invalid.length).toBeGreaterThan(0);
  });

  it('without listedOnly a stray seat is still followed (shorthand, old hands)', () => {
    const s = setup({ heroPos: 'MP', villPos: 'BTN' });
    const r = play(s, [
      { act: 'open', to: 150 },
      { seat: 'CO', act: 'call' },
    ]);
    expect(replay(s, r.actions).invalid).toEqual([]);
  });
});

describe('primaryOpponent', () => {
  const s = setup({ listedOnly: true, heroPos: 'MP', villPos: 'BTN', tracked: ['CO'] });

  it('is the first one picked while he is still in', () => {
    const r = play(s, [{ act: 'open', to: 150 }]);
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('BTN');
  });

  it('moves to the next one when the first folds', () => {
    const r = play(s, [{ act: 'open', to: 150 }, { seat: 'CO', act: 'call' }, { act: 'fold' }]);
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('CO');
  });

  it('keeps the first when everyone folded; null for nobody', () => {
    const r = play(s, [{ act: 'open', to: 150 }, { seat: 'CO', act: 'fold' }, { act: 'fold' }]);
    expect(primaryOpponent(r.state, ['BTN', 'CO'])).toBe('BTN');
    expect(primaryOpponent(r.state, [])).toBeNull();
  });
});
