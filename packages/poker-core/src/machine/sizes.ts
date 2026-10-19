import { roundMoney } from '../amount';
import type { HandState } from './types';

export type SizeKind = 'open' | 'bet' | 'raise';

export interface QuickSize {
  /** Stable key for labels: `2x`, `2.5x`, `1/3`, `pot`... */
  key: string;
  /** "Up to" amount in chips. */
  to: number;
}

const MULTIPLES: Record<'open' | 'raise', readonly number[]> = {
  open: [2, 2.5, 3],
  raise: [3, 4],
};
const POT_FRACTIONS: ReadonlyArray<[string, number]> = [
  ['1/3', 1 / 3],
  ['1/2', 1 / 2],
  ['2/3', 2 / 3],
  ['pot', 1],
];

/**
 * Shortcut amounts for the keypad (spec section 8): open = multiples of the current bet, raise =
 * multiples of the bet faced, bet = fractions of the pot.
 */
export function quickSizes(state: HandState, kind: SizeKind): QuickSize[] {
  if (kind === 'bet') {
    return POT_FRACTIONS.map(([key, f]) => ({ key, to: roundMoney(state.pot * f) }));
  }
  return MULTIPLES[kind].map((m) => ({ key: `${m}x`, to: roundMoney(state.currentBet * m) }));
}

export interface AmountPreview {
  to: number;
  /** Under the minimum raise: warn, still allowed. */
  belowMin: boolean;
  /** At or over the stack of the seat to act: becomes an all-in. */
  becomesAllIn: boolean;
}

/** What typing `to` would mean for the seat to act, before it is entered. */
export function previewAmount(state: HandState, to: number): AmountPreview {
  const toAct = state.phase.kind === 'act' ? state.phase.toAct : null;
  const seat = state.players.find((p) => p.pos === toAct);
  const cap = seat && seat.behind !== undefined ? seat.streetBet + seat.behind : Infinity;
  const becomesAllIn = to >= cap;
  return { to, belowMin: !becomesAllIn && to < state.minRaiseTo, becomesAllIn };
}
