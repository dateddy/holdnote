import { roundMoney } from '../amount';
import type { HandInput } from '../types';
import { computePot } from './pot';

/**
 * Hero net result in money: win = pot − put in, split = pot/2 − put in, lose/fold = −put in.
 * Null when hero never acts or the outcome is unknown. Win/split need the exact pot; lose/fold only
 * need hero's own chips. No side pots yet.
 */
export function computeResult(input: HandInput): number | null {
  if (!input.outcome) return null;
  const p = computePot(input);
  if (!p.heroSeen) return null;
  switch (input.outcome) {
    case 'win':
      return p.exact ? roundMoney(p.pot - p.heroInvested) : null;
    case 'split':
      return p.exact ? roundMoney(p.pot / 2 - p.heroInvested) : null;
    case 'lose':
    case 'fold':
      return p.heroExact ? roundMoney(-p.heroInvested) : null;
  }
}

/** Hero stack for the next hand. */
export function nextStack(stackBefore: number, result: number): number {
  return roundMoney(stackBefore + result);
}
