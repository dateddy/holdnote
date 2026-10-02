import { describe, expect, it } from 'vitest';
import { computeEff, computeSpr } from '../src/index';
import { hand } from './helpers';

describe('computeEff', () => {
  it('is the smaller stack, in money and bb', () => {
    expect(computeEff(18000, 20000, 50)).toEqual({ amount: 18000, bb: 360 });
    expect(computeEff(4.66, 4.49, 0.02)).toEqual({ amount: 4.49, bb: 224.5 });
  });

  it('is null when a stack is missing', () => {
    expect(computeEff(undefined, 2000, 50)).toBeNull();
    expect(computeEff(2000, undefined, 50)).toBeNull();
  });
});

describe('computeSpr', () => {
  it('gives SPR at the start of each postflop street with actions', () => {
    const spr = computeSpr(
      hand('H o150 V c / V x H b200 V c / V x H x', {
        heroPos: 'BTN',
        villPos: 'BB',
        heroStack: 5000,
        villStack: 3000,
      }),
    );
    expect(spr).toEqual([
      { street: 'flop', pot: 325, effRemaining: 2850, spr: 8.77 },
      { street: 'turn', pot: 725, effRemaining: 2650, spr: 3.66 },
    ]);
  });

  it('is empty without both stacks', () => {
    expect(
      computeSpr(hand('H o150 V c / V x H x', { heroPos: 'BTN', villPos: 'BB', heroStack: 5000 })),
    ).toEqual([]);
  });
});
