import { roundMoney } from '../amount';
import type { HandInput } from '../types';
import { computePot } from './pot';
import { settlePots } from './sidepot';

/**
 * Hero net result in money for hands without a seat-by-seat state (shorthand line, hands saved
 * before DEC-045): the pots are built and paid by `settlePots`, the same code `showdown` uses.
 * `outcome` names the winner of every pot: win = hero, lose = villain, split = both. Null when
 * hero never acts or the outcome is unknown. Win/split need the exact pot; lose/fold only need
 * hero's own chips. Chips divide down to cents here (no seat order is known).
 */
export function computeResult(input: HandInput): number | null {
  if (!input.outcome) return null;
  const p = computePot(input);
  if (!p.heroSeen) return null;
  if (input.outcome === 'lose' || input.outcome === 'fold') {
    return p.heroExact ? roundMoney(-p.heroInvested) : null;
  }
  if (!p.exact) return null;

  const out = new Set<string>(
    input.actions
      .filter((a) => a.act === 'fold' && (a.actor === 'hero' || a.actor === 'villain'))
      .map((a) => a.actor),
  );
  const entries = Object.entries(p.invested).map(([seat, invested]) => ({
    seat,
    invested,
    folded: (seat !== 'hero' && seat !== 'villain') || out.has(seat),
  }));
  // Dead money the pot counts but no seat owns (antes of the other players).
  const dead = roundMoney(p.pot - entries.reduce((s, e) => s + e.invested, 0));
  if (dead > 0) entries.push({ seat: 'dead', invested: dead, folded: true });

  const { payouts } = settlePots(
    entries,
    (_, pot) => {
      const both = pot.eligible.filter((s) => s === 'hero' || s === 'villain');
      const mine = both.includes('hero');
      if (input.outcome === 'split') return both.length > 0 ? both : null;
      return mine ? ['hero'] : both.length > 0 ? both : null;
    },
    ['hero', 'villain'],
    0.01,
  );
  return roundMoney((payouts['hero'] ?? 0) - p.heroInvested);
}

/** Hero stack for the next hand. */
export function nextStack(stackBefore: number, result: number): number {
  return roundMoney(stackBefore + result);
}
