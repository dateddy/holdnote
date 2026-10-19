import { describe, expect, it } from 'vitest';
import {
  act,
  boardCheck,
  boardNeeded,
  edit,
  forcedBets,
  reachedStreet,
  replay,
  streetTabs,
} from '../src/index';
import { play, setup } from './helpers';

const HU = { heroPos: 'BTN', villPos: 'BB' } as const;
const NONE = ['', '', '', '', ''];
const PRE = [{ act: 'open', to: 150 }, { act: 'call' }] as const;

describe('boardCheck: which board slots are open', () => {
  it('preflop: every slot is locked and nothing is needed', () => {
    const st = replay(setup(HU), []);
    expect(boardNeeded(st)).toBe(0);
    expect(boardCheck(st, NONE)).toEqual({
      slots: ['locked', 'locked', 'locked', 'locked', 'locked'],
      needed: 0,
      missing: 0,
      extra: 0,
    });
  });

  it('flop to act with an empty board: the flop slots are missing, action is not blocked', () => {
    const r = play(setup(HU), [...PRE]);
    expect(r.state.phase).toMatchObject({ kind: 'act', street: 'flop' });
    const c = boardCheck(r.state, NONE);
    expect(c.slots).toEqual(['missing', 'missing', 'missing', 'locked', 'locked']);
    expect(c).toMatchObject({ needed: 3, missing: 3, extra: 0 });
    // and the next action goes through without any board
    const next = act(setup(HU), r.actions, { act: 'check' });
    expect(next.accepted).toBe(true);
  });

  it('a card past the street reached is extra', () => {
    const r = play(setup(HU), [...PRE]);
    const c = boardCheck(r.state, ['Ah', 'Kd', '7c', '9s', '']);
    expect(c.slots).toEqual(['open', 'open', 'open', 'extra', 'locked']);
    expect(c).toMatchObject({ missing: 0, extra: 1 });
  });

  it('all-in called before the flop: every slot opens to run out the board', () => {
    const s = setup({ ...HU, stacks: { BTN: 1000, BB: 1000 } });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'all-in' }, { act: 'call' }]);
    expect(r.state.phase).toEqual({ kind: 'runout', missing: 5 });
    expect(boardNeeded(r.state)).toBe(5);
    expect(boardCheck(r.state, ['Ah', '', '', '', '']).slots).toEqual([
      'open',
      'missing',
      'missing',
      'missing',
      'missing',
    ]);
    // the betting streets stay where the actions are
    expect(reachedStreet(r.state)).toBe('preflop');
  });

  it('showdown after the river needs all five', () => {
    const r = play(
      setup(HU),
      [...PRE, ...Array.from({ length: 6 }, () => ({ act: 'check' }) as const)],
      { cards: ['Ah', 'Kd', '7c', '2s', '9h'] },
    );
    expect(r.state.phase).toEqual({ kind: 'showdown' });
    expect(boardNeeded(r.state)).toBe(5);
    expect(boardCheck(r.state, ['Ah', 'Kd', '7c', '2s', '']).slots[4]).toBe('missing');
  });

  it('hand won by a fold on the flop: only the flop is needed, a turn card is extra', () => {
    const s = setup(HU);
    const r = play(s, [...PRE, { act: 'check' }, { act: 'bet', to: 100 }, { act: 'fold' }]);
    expect(r.state.phase).toEqual({ kind: 'won', winner: 'BTN' });
    expect(reachedStreet(r.state)).toBe('flop');
    const c = boardCheck(r.state, ['Ah', 'Kd', '7c', '2s', '']);
    expect(c.slots).toEqual(['open', 'open', 'open', 'extra', 'locked']);
  });

  it('editing preflop into a fold leaves the entered flop as extra, nothing is removed', () => {
    const s = setup(HU);
    const r = play(s, [...PRE, { act: 'check' }, { act: 'check' }], { cards: ['Ah', 'Kd', '7c'] });
    const first = forcedBets(s).length;
    const e = edit(s, r.actions, first, { act: 'fold' }, { cards: ['Ah', 'Kd', '7c'] });
    expect(e.actions).toHaveLength(r.actions.length);
    expect(boardCheck(e.state, ['Ah', 'Kd', '7c', '', '']).slots).toEqual([
      'extra',
      'extra',
      'extra',
      'locked',
      'locked',
    ]);
  });
});

describe('streetTabs', () => {
  it('marks done, current, locked', () => {
    const r = play(setup(HU), [...PRE, { act: 'check' }]);
    expect(streetTabs(r.state)).toEqual({
      preflop: 'done',
      flop: 'current',
      turn: 'locked',
      river: 'locked',
    });
  });

  it('flags the street whose actions stopped fitting after an edit', () => {
    const s = setup(HU);
    const r = play(s, [...PRE, { act: 'check' }, { act: 'check' }]);
    // the first flop check becomes a fold: the second check no longer fits
    const e = edit(s, r.actions, forcedBets(s).length + 2, { act: 'fold' });
    expect(streetTabs(e.state)).toMatchObject({ preflop: 'done', flop: 'invalid' });
  });

  it('after a fold the hand is over: the street reached is done, later ones locked', () => {
    const r = play(setup(HU), [...PRE, { act: 'check' }, { act: 'bet', to: 100 }, { act: 'fold' }]);
    expect(streetTabs(r.state)).toEqual({
      preflop: 'done',
      flop: 'done',
      turn: 'locked',
      river: 'locked',
    });
  });
});
