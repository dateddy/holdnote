import { describe, expect, it } from 'vitest';
import { previewNext, suggestAmount } from '../src/index';
import { hand } from './helpers';

describe('previewNext', () => {
  it('preflop: facing the blinds', () => {
    const p = previewNext(hand('', { heroPos: 'BTN', villPos: 'BB' }), 'preflop', {
      actor: 'hero',
    });
    expect(p).toMatchObject({ pot: 75, level: 50, toCall: 50, facing: true });
  });

  it('flop after a called open: first to act is not facing', () => {
    const input = hand('H o150 V c / ', { heroPos: 'BTN', villPos: 'BB' });
    const p = previewNext(input, 'flop', { actor: 'villain' });
    expect(p).toMatchObject({ pot: 325, level: 0, toCall: 0, facing: false });
  });

  it('flop: facing a bet', () => {
    const input = hand('H o150 V c / V b100', { heroPos: 'BTN', villPos: 'BB' });
    const p = previewNext(input, 'flop', { actor: 'hero' });
    expect(p).toMatchObject({ pot: 425, level: 100, toCall: 100, facing: true });
  });
});

describe('suggestAmount', () => {
  it('bet is a fraction of the pot', () => {
    expect(suggestAmount('bet', 0.5, { pot: 300, level: 0, toCall: 0, facing: false })).toBe(150);
    expect(suggestAmount('bet', 1 / 3, { pot: 300, level: 0, toCall: 0, facing: false })).toBe(100);
  });

  it('raise to = level + fraction of the pot after calling', () => {
    // Pot 400 with a 100 bet to call: pot-sized raise = 100 + (400 + 100) = 600.
    expect(suggestAmount('raise', 1, { pot: 400, level: 100, toCall: 100, facing: true })).toBe(
      600,
    );
    expect(suggestAmount('raise', 0.5, { pot: 400, level: 100, toCall: 100, facing: true })).toBe(
      350,
    );
  });

  it('rounds to 2 decimals', () => {
    expect(suggestAmount('bet', 2 / 3, { pot: 1, level: 0, toCall: 0, facing: false })).toBe(0.67);
  });
});
