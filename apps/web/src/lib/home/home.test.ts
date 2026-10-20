import { describe, expect, it } from 'vitest';
import { handTotals } from './home';

describe('handTotals', () => {
  it('adds money and converts each hand to bb at its own level', () => {
    const t = handTotals(
      [
        { result: 100, level_bb: null },
        { result: -50, level_bb: null },
        { result: 400, level_bb: 200 },
        { result: null, level_bb: null },
      ],
      50,
    );
    expect(t).toEqual({ money: 450, bb: 3 });
  });

  it('skips bb when the blinds are unknown', () => {
    expect(handTotals([{ result: 10, level_bb: null }], null)).toEqual({ money: 10, bb: 0 });
  });
});
