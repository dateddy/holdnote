import { roundMoney } from '../amount';

export interface PotEntry<S extends string = string> {
  seat: S;
  /** Everything the seat put in (antes and dead money included), uncalled bets already returned. */
  invested: number;
  folded: boolean;
}

export interface Pot<S extends string = string> {
  amount: number;
  /** Seats that can win it: not folded and in for at least this pot's level. */
  eligible: S[];
}

/**
 * Pots by contribution level. Levels are the different totals of the players still in; a folded
 * player's chips go into every pot up to what they put in but they can win none. Chips a folded
 * player put in above the last level join the last pot. The main pot comes first.
 */
export function buildPots<S extends string>(entries: readonly PotEntry<S>[]): Pot<S>[] {
  const levels = [...new Set(entries.filter((e) => !e.folded).map((e) => e.invested))].sort(
    (a, b) => a - b,
  );
  if (levels.length === 0) {
    const total = roundMoney(entries.reduce((s, e) => s + e.invested, 0));
    return total > 0 ? [{ amount: total, eligible: [] }] : [];
  }
  const pots: Pot<S>[] = [];
  let prev = 0;
  levels.forEach((level, i) => {
    const last = i === levels.length - 1;
    const amount = roundMoney(
      entries.reduce(
        (s, e) => s + Math.max(0, (last ? e.invested : Math.min(e.invested, level)) - prev),
        0,
      ),
    );
    if (amount > 0) {
      pots.push({
        amount,
        eligible: entries.filter((e) => !e.folded && e.invested >= level).map((e) => e.seat),
      });
    }
    prev = level;
  });
  return pots;
}

/** Smallest chip of the game: 1 when every amount is whole, else a cent (NL2 plays 0.25 blinds). */
export function chipUnit(amounts: readonly number[]): 1 | 0.01 {
  return amounts.every((a) => Math.abs(a - Math.round(a)) < 1e-9) ? 1 : 0.01;
}

/**
 * Share `amount` between `winners` in whole `unit`s. Chips that do not divide go one each to the
 * winners first in `oddOrder` (closest to the left of the button first).
 */
export function splitPot<S extends string>(
  amount: number,
  winners: readonly S[],
  oddOrder: readonly S[],
  unit: number,
): Record<S, number> {
  const ordered = [
    ...oddOrder.filter((s) => winners.includes(s)),
    ...winners.filter((s) => !oddOrder.includes(s)),
  ];
  const units = Math.round(amount / unit);
  const base = Math.floor(units / ordered.length);
  const extra = units - base * ordered.length;
  const out = {} as Record<S, number>;
  ordered.forEach((seat, i) => {
    out[seat] = roundMoney((base + (i < extra ? 1 : 0)) * unit);
  });
  return out;
}

export interface SettledPot<S extends string = string> extends Pot<S> {
  /** Null while nobody is known to win it. */
  winners: S[] | null;
}

/**
 * Build the pots and pay each to the winners `winnersOf` names (null = undecided, nobody is paid).
 * The one place chips are divided, shared by the state machine and the shorthand path.
 */
export function settlePots<S extends string>(
  entries: readonly PotEntry<S>[],
  winnersOf: (index: number, pot: Pot<S>) => readonly S[] | null,
  oddOrder: readonly S[],
  unit: number,
): { pots: SettledPot<S>[]; payouts: Partial<Record<S, number>> } {
  const payouts: Partial<Record<S, number>> = {};
  const pots = buildPots(entries).map((pot, i): SettledPot<S> => {
    const picked = winnersOf(i, pot);
    const winners = picked && picked.length > 0 ? [...picked] : null;
    if (winners) {
      const share = splitPot(pot.amount, winners, oddOrder, unit);
      for (const [seat, chips] of Object.entries(share) as [S, number][]) {
        payouts[seat] = roundMoney((payouts[seat] ?? 0) + chips);
      }
    }
    return { ...pot, winners };
  });
  return { pots, payouts };
}
