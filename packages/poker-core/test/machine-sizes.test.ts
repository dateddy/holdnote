import { describe, expect, it } from 'vitest';
import { previewAmount, quickSizes, replay } from '../src/index';
import { play, setup } from './helpers';

describe('quickSizes', () => {
  it('open: 2x, 2.5x, 3x of the current bet (the big blind without a straddle)', () => {
    const st = replay(setup(), []);
    expect(quickSizes(st, 'open')).toEqual([
      { key: '2x', to: 100 },
      { key: '2.5x', to: 125 },
      { key: '3x', to: 150 },
    ]);
  });

  it('open over a straddle uses the straddle', () => {
    const st = replay(setup({ straddles: [100] }), []);
    expect(quickSizes(st, 'open').map((s) => s.to)).toEqual([200, 250, 300]);
  });

  it('raise: 3x and 4x of the bet faced', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [{ act: 'open', to: 150 }]);
    expect(quickSizes(r.state, 'raise')).toEqual([
      { key: '3x', to: 450 },
      { key: '4x', to: 600 },
    ]);
  });

  it('bet: third, half, two thirds and the pot', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'call' }], { cards: ['Ah', 'Kd', '7c'] });
    expect(r.state.pot).toBe(325);
    expect(quickSizes(r.state, 'bet').map((q) => [q.key, q.to])).toEqual([
      ['1/3', 108.33],
      ['1/2', 162.5],
      ['2/3', 216.67],
      ['pot', 325],
    ]);
  });
});

describe('previewAmount', () => {
  const s = setup({ heroPos: 'BTN', villPos: 'BB', stacks: { BTN: 1000, BB: 1000 } });

  it('flags an amount below the minimum raise', () => {
    const r = play(s, [{ act: 'open', to: 200 }]);
    expect(previewAmount(r.state, 250)).toEqual({ to: 250, belowMin: true, becomesAllIn: false });
    expect(previewAmount(r.state, 350)).toEqual({ to: 350, belowMin: false, becomesAllIn: false });
  });

  it('flags an amount that reaches the stack as an all-in', () => {
    const r = play(s, [{ act: 'open', to: 200 }]);
    expect(previewAmount(r.state, 5000)).toEqual({ to: 5000, belowMin: false, becomesAllIn: true });
  });
});
