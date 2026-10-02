import type { Card, Rank, Suit } from './types';

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
