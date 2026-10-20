import { isPostAct } from '../types';
import type { ActionStep } from './pot';

export type PotType = 'limped' | 'single_raised' | 'three_bet' | 'four_bet_plus';

/**
 * How the preflop betting went: nobody raised (limped), one raise, a 3-bet, or more. An all-in
 * above the current level counts as a raise. `bb` is the opening level when the blinds are not
 * recorded as actions.
 */
export function potType(steps: readonly ActionStep[], bb = 0): PotType {
  let level = bb;
  let raises = 0;
  for (const { action: a } of steps) {
    if (a.street !== 'preflop') continue;
    const amount = a.amount ?? 0;
    if (isPostAct(a.act)) {
      level = Math.max(level, amount);
    } else if ((a.act === 'raise' || a.act === 'bet' || a.act === 'all-in') && amount > level) {
      raises++;
      level = amount;
    }
  }
  return raises === 0
    ? 'limped'
    : raises === 1
      ? 'single_raised'
      : raises === 2
        ? 'three_bet'
        : 'four_bet_plus';
}
