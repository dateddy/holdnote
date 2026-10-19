import { SUITS, type Card, type Rank, type Suit } from './types';

const CARD_RE = /(10|[2-9tjqka])([shdc?])?/gi;

/**
 * Pull cards out of free text: `AhKd`, `10h`, `K?`, lowercase. A rank without a suit (`K22`)
 * becomes an unknown-suit card (`K?`). Anything else is ignored.
 */
export function parseCards(input: string | null | undefined): Card[] {
  if (!input) return [];
  const out: Card[] = [];
  for (const m of input.matchAll(CARD_RE)) {
    const rawRank = (m[1] ?? '').toUpperCase();
    const rank = (rawRank === '10' ? 'T' : rawRank) as Rank;
    const suit = (m[2] ?? '?').toLowerCase() as Suit;
    out.push(`${rank}${suit}`);
  }
  return out;
}

export function isCard(value: string): value is Card {
  return /^[2-9TJQKA][shdc?]$/.test(value);
}

/** Indexes of every card that appears more than once. Unknown-suit cards (`K?`) and empty slots never count. */
export function duplicateCards(cards: readonly string[]): number[] {
  const seen = new Map<string, number>();
  for (const c of cards) if (c && !c.endsWith('?')) seen.set(c, (seen.get(c) ?? 0) + 1);
  return cards.flatMap((c, i) => ((seen.get(c) ?? 0) > 1 ? [i] : []));
}

/** Suits of `rank` that are already on the table, in `s h d c` order (the picker greys them out). */
export function takenSuits(rank: string, used: Iterable<string>): Suit[] {
  const set = new Set(used);
  return SUITS.filter((s) => set.has(`${rank}${s}`));
}
