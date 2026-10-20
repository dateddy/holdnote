import type { Card } from '../types';

export const HAND_CATEGORIES = [
  'high_card',
  'pair',
  'two_pair',
  'trips',
  'straight',
  'flush',
  'full_house',
  'quads',
  'straight_flush',
  'royal_flush',
] as const;
export type HandCategory = (typeof HAND_CATEGORIES)[number];

export interface HandRank {
  category: HandCategory;
  /** `[category index, ...tie-breakers]`; compare lexicographically (see {@link compareRanks}). */
  values: number[];
}

const RANK_VALUE: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** Rank of exactly five cards. */
function rankFive(cards: readonly Card[]): HandRank {
  const ranks = cards.map((c) => RANK_VALUE[c[0] ?? ''] ?? 0);
  const flush = cards.every((c) => c[1] === cards[0]?.[1]);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Groups by size then rank: the order in which cards break ties.
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ordered = groups.map(([r]) => r);
  const sizes = groups.map(([, n]) => n);

  const distinct = [...counts.keys()].sort((a, b) => b - a);
  let straightHigh = 0;
  if (distinct.length === 5) {
    if (distinct[0]! - distinct[4]! === 4) straightHigh = distinct[0]!;
    else if (distinct.join() === '14,5,4,3,2') straightHigh = 5; // the wheel
  }

  const done = (category: HandCategory, values: number[]): HandRank => ({
    category,
    values: [HAND_CATEGORIES.indexOf(category), ...values],
  });
  if (straightHigh && flush) {
    return done(straightHigh === 14 ? 'royal_flush' : 'straight_flush', [straightHigh]);
  }
  if (sizes[0] === 4) return done('quads', ordered);
  if (sizes[0] === 3 && sizes[1] === 2) return done('full_house', ordered);
  if (flush) return done('flush', ordered);
  if (straightHigh) return done('straight', [straightHigh]);
  if (sizes[0] === 3) return done('trips', ordered);
  if (sizes[0] === 2 && sizes[1] === 2) return done('two_pair', ordered);
  if (sizes[0] === 2) return done('pair', ordered);
  return done('high_card', ordered);
}

/** Compare two ranks: positive when `a` is the better hand, 0 for a tie. */
export function compareRanks(a: HandRank, b: HandRank): number {
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i++) {
    const d = (a.values[i] ?? 0) - (b.values[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Best five-card hand out of 5 to 7 cards. Null when there is nothing sure to say: fewer than five
 * cards, a repeated card, or a card whose suit is not known (`K?`).
 */
export function evaluate(cards: readonly Card[]): HandRank | null {
  if (cards.length < 5 || cards.length > 7) return null;
  if (cards.some((c) => c.endsWith('?')) || new Set(cards).size !== cards.length) return null;

  let best: HandRank | null = null;
  const pick: Card[] = [];
  const walk = (from: number) => {
    if (pick.length === 5) {
      const r = rankFive(pick);
      if (!best || compareRanks(r, best) > 0) best = r;
      return;
    }
    for (let i = from; i <= cards.length - (5 - pick.length); i++) {
      pick.push(cards[i] as Card);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return best;
}
