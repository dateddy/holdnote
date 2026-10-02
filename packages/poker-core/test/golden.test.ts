import { describe, expect, it } from 'vitest';
import {
  computeEff,
  computePot,
  computeResult,
  nextStack,
  parseShorthand,
  resolveActions,
  toBb,
  type HandInput,
} from '../src/index';

// CLAUDE.md golden case: BB 50, hero 18000 (MP), villain 20000 (BTN), hero loses.
const LINE = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';

describe('golden hand', () => {
  const { actions, errors } = parseShorthand(LINE, { heroPos: 'MP', villPos: 'BTN' });
  const input: HandInput = {
    blinds: { sb: 25, bb: 50, ante: { mode: 'none' } },
    heroPos: 'MP',
    villPos: 'BTN',
    heroStack: 18000,
    villStack: 20000,
    outcome: 'lose',
    actions,
  };

  it('parses without errors', () => {
    expect(errors).toEqual([]);
  });

  it('result is -18000 chips = -360bb', () => {
    const result = computeResult(input);
    expect(result).toBe(-18000);
    expect(toBb(result ?? 0, 50)).toBe(-360);
  });

  it('eff stack is 360bb', () => {
    expect(computeEff(18000, 20000, 50)).toEqual({ amount: 18000, bb: 360 });
  });

  it('hero stack after the hand is 0', () => {
    expect(nextStack(18000, computeResult(input) ?? 0)).toBe(0);
  });

  it('villain shove is all of their stack and hero calls for the rest of theirs', () => {
    const river = resolveActions(input).filter((a) => a.street === 'river');
    expect(river.map((a) => a.amount)).toEqual([5000, 18000, 16000]);
    expect(computePot(input).pot).toBe(36075);
  });
});
