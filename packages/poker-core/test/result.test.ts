import { describe, expect, it } from 'vitest';
import { computeResult, nextStack } from '../src/index';
import { hand } from './helpers';

const LINE = 'H o150 V c / V x H b200 V c'; // pot 725, hero put in 350
const BASE = { heroPos: 'BTN', villPos: 'BB' } as const;

describe('computeResult', () => {
  it.each([
    ['win', 375],
    ['lose', -350],
    ['fold', -350],
    ['split', 12.5],
  ] as const)('%s', (outcome, expected) => {
    expect(computeResult(hand(LINE, { ...BASE, outcome }))).toBe(expected);
  });

  it('fold preflop loses only what hero put in', () => {
    expect(computeResult(hand('H o150 V 3b450 H f', { ...BASE, outcome: 'fold' }))).toBe(-150);
  });

  it('is null when hero never acts', () => {
    expect(computeResult(hand('V o150 SB f', { ...BASE, outcome: 'win' }))).toBeNull();
  });

  it('is null without an outcome', () => {
    expect(computeResult(hand(LINE, BASE))).toBeNull();
  });

  it('is null when the pot is not exact', () => {
    expect(computeResult(hand('H o150 V ai H c', { ...BASE, outcome: 'lose' }))).toBeNull();
  });

  it('each-player ante without players dealt: loss is known, win is not', () => {
    const opts = {
      ...BASE,
      blinds: { sb: 50, bb: 100, ante: { mode: 'each', amount: 10 } },
    } as const;
    expect(computeResult(hand('H o250 V c', { ...opts, outcome: 'lose' }))).toBe(-260);
    expect(computeResult(hand('H o250 V 3b900 H f', { ...opts, outcome: 'fold' }))).toBe(-260);
    expect(computeResult(hand('H o250 V c', { ...opts, outcome: 'win' }))).toBeNull();
    expect(computeResult(hand('H o250 V c', { ...opts, outcome: 'split' }))).toBeNull();
  });

  it('rounds to cents', () => {
    const r = computeResult(
      hand('H o0.06 V c / V x H b0.1 V c', {
        ...BASE,
        blinds: { sb: 0.01, bb: 0.02, ante: { mode: 'none' } },
        outcome: 'win',
      }),
    );
    expect(r).toBe(0.17);
  });
});

describe('nextStack', () => {
  it('adds the result to the stack', () => {
    expect(nextStack(18000, -18000)).toBe(0);
    expect(nextStack(4.49, -0.25)).toBe(4.24);
    expect(nextStack(1000, 375)).toBe(1375);
  });
});
