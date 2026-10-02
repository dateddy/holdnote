import { roundMoney } from '../amount';
import type { Action, HandInput, Street } from '../types';
import { computePot } from './pot';

/** What the next actor faces on a street. */
export interface NextSpot {
  /** Pot including bets still on the table. */
  pot: number;
  /** Largest bet on the table this street (preflop: the blinds). */
  level: number;
  /** What the next actor must add to call. */
  toCall: number;
  facing: boolean;
}

/**
 * The spot in front of `actor` after the actions entered so far. Probes with a throwaway call so
 * the pot and the street level come from the same walk as the final numbers.
 */
export function previewNext(
  input: HandInput,
  street: Street,
  actor: Pick<Action, 'actor' | 'pos' | 'who'>,
): NextSpot {
  const probe: Action = { street, act: 'call', ...actor };
  const { steps } = computePot({ ...input, actions: [...input.actions, probe] });
  const step = steps[steps.length - 1];
  if (!step) return { pot: 0, level: 0, toCall: 0, facing: false };
  return {
    pot: step.potBefore,
    level: step.level,
    toCall: step.toCall,
    facing: step.toCall > 0,
  };
}

export type SizedAct = 'bet' | 'raise';

/**
 * Quick-size amount as "bet / raise to": a bet is a fraction of the pot; a raise goes to the
 * current level plus that fraction of the pot after calling.
 */
export function suggestAmount(act: SizedAct, fraction: number, spot: NextSpot): number {
  if (act === 'bet') return roundMoney(fraction * spot.pot);
  return roundMoney(spot.level + fraction * (spot.pot + spot.toCall));
}
