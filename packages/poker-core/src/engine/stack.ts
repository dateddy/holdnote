import { roundMoney, toBb } from '../amount';
import type { HandInput, Street } from '../types';
import { computePot } from './pot';

export interface EffStack {
  amount: number;
  bb: number;
}

/** Effective stack = the smaller of the two stacks. */
export function computeEff(
  heroStack: number | undefined,
  villStack: number | undefined,
  bb: number,
): EffStack | null {
  if (heroStack === undefined || villStack === undefined) return null;
  const amount = Math.min(heroStack, villStack);
  return { amount, bb: toBb(amount, bb) };
}

export interface StreetSpr {
  street: Exclude<Street, 'preflop'>;
  /** Pot at the start of the street. */
  pot: number;
  /** Effective stack left at the start of the street. */
  effRemaining: number;
  spr: number;
}

/** SPR at the start of each postflop street that has actions. Needs both stacks. */
export function computeSpr(input: HandInput): StreetSpr[] {
  const { heroStack, villStack } = input;
  if (heroStack === undefined || villStack === undefined) return [];
  const out: StreetSpr[] = [];
  for (const s of computePot(input).streets) {
    if (s.street === 'preflop' || s.potStart <= 0) continue;
    const effRemaining = roundMoney(
      Math.min(heroStack - s.heroInvestedAtStart, villStack - s.villainInvestedAtStart),
    );
    out.push({
      street: s.street,
      pot: s.potStart,
      effRemaining,
      spr: roundMoney(effRemaining / s.potStart),
    });
  }
  return out;
}
