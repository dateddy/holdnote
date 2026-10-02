import type { ActKind, HandInput, Street } from '../types';
import { computePot } from './pot';

export interface Decision {
  /** Index of the hero action in `HandInput.actions`. */
  index: number;
  street: Street;
  act: ActKind;
  toCall: number;
  /** Pot before hero acts, the bet faced included. */
  potBefore: number;
  /** toCall / (potBefore + toCall). */
  potOdds: number;
  /** Pot before the bet / pot after the bet. Null when there is no bet (limped pot). */
  mdf: number | null;
  /** Chips the bettor added / pot before the bet. */
  betFraction: number | null;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Every spot where hero has a price to pay: calls (including completing a limp) and any action
 * against a bet or raise. An open-raise or fold facing only the blinds is not a decision here.
 */
export function potOddsAtDecisions(input: HandInput): Decision[] {
  const { steps } = computePot(input);
  const byIndex = new Map(steps.map((s) => [s.index, s]));
  const out: Decision[] = [];

  for (const s of steps) {
    if (s.action.actor !== 'hero' || s.toCall <= 0) continue;
    if (s.facingIndex === null && s.action.act !== 'call') continue;

    const bet = s.facingIndex === null ? undefined : byIndex.get(s.facingIndex);
    const potBeforeBet = bet?.potBefore;
    out.push({
      index: s.index,
      street: s.action.street,
      act: s.action.act,
      toCall: s.toCall,
      potBefore: s.potBefore,
      potOdds: round4(s.toCall / (s.potBefore + s.toCall)),
      mdf: bet && potBeforeBet ? round4(potBeforeBet / bet.potAfter) : null,
      betFraction:
        bet && potBeforeBet ? round4((bet.potAfter - bet.potBefore) / potBeforeBet) : null,
    });
  }
  return out;
}
