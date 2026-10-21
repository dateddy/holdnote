import { isPostAct } from '../types';
import type { ActionStep } from './pot';

export type PotType = 'limped' | 'iso' | 'single_raised' | 'three_bet' | 'four_bet_plus';

/**
 * How the preflop betting went: nobody raised (limped), one raise over limpers (iso), one raise,
 * a 3-bet, or more. An all-in above the current level counts as a raise, and so does one whose
 * amount is unknown (no stack recorded). `bb` is the opening level when the blinds are not
 * recorded as actions.
 */
export function potType(steps: readonly ActionStep[], bb = 0): PotType {
  let level = bb;
  let raises = 0;
  let limpers = 0;
  for (const { action: a } of steps) {
    if (a.street !== 'preflop') continue;
    const amount = a.amount ?? 0;
    if (isPostAct(a.act)) {
      level = Math.max(level, amount);
    } else if (a.act === 'call' && raises === 0) {
      limpers++;
    } else if (
      (a.act === 'raise' || a.act === 'bet' || a.act === 'all-in') &&
      (amount > level || (a.act === 'all-in' && amount <= 0))
    ) {
      raises++;
      level = Math.max(level, amount);
    }
  }
  return raises === 0
    ? 'limped'
    : raises === 1
      ? limpers > 0
        ? 'iso'
        : 'single_raised'
      : raises === 2
        ? 'three_bet'
        : 'four_bet_plus';
}
