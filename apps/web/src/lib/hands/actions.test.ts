import { describe, expect, it } from 'vitest';
import type { Action } from 'poker-core';
import { defaultActor, removeLastOnStreet } from './actions';

describe('defaultActor', () => {
  it('preflop: MP acts before BTN', () => {
    expect(defaultActor('preflop', [], 'MP', 'BTN')).toBe('hero');
    expect(defaultActor('preflop', [], 'BTN', 'MP')).toBe('villain');
  });

  it('postflop: BB acts before BTN, SB before BB', () => {
    expect(defaultActor('flop', [], 'BTN', 'BB')).toBe('villain');
    expect(defaultActor('flop', [], 'SB', 'BB')).toBe('hero');
  });

  it('alternates after an action', () => {
    const actions: Action[] = [{ street: 'preflop', actor: 'hero', act: 'raise', amount: 150 }];
    expect(defaultActor('preflop', actions, 'BTN', 'BB')).toBe('villain');
    const next: Action[] = [...actions, { street: 'preflop', actor: 'villain', act: 'call' }];
    expect(defaultActor('preflop', next, 'BTN', 'BB')).toBe('hero');
  });

  it('falls back to hero without positions', () => {
    expect(defaultActor('flop', [], '', '')).toBe('hero');
  });
});

describe('removeLastOnStreet', () => {
  it('removes only the last action of that street', () => {
    const actions: Action[] = [
      { street: 'preflop', actor: 'hero', act: 'raise', amount: 150 },
      { street: 'flop', actor: 'villain', act: 'check' },
      { street: 'preflop', actor: 'villain', act: 'call' },
    ];
    expect(removeLastOnStreet(actions, 'preflop')).toEqual(actions.slice(0, 2));
  });
});
